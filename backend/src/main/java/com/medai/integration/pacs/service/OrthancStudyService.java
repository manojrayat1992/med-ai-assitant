package com.medai.integration.pacs.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.medai.common.exception.BadRequestException;
import com.medai.common.exception.ResourceNotFoundException;
import com.medai.integration.pacs.entity.PacsConnectorEntity;
import com.medai.integration.pacs.enums.PacsConnectorType;
import com.medai.integration.pacs.repository.PacsConnectorRepository;
import com.medai.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;

/** Read-only browsing. The configured Orthanc archive must belong exclusively to this tenant. */
@Service
@RequiredArgsConstructor
public class OrthancStudyService {
    private final PacsConnectorRepository connectors;
    private final ConnectorProbe client;

    public record Study(String id, String studyInstanceUid, String accessionNumber, String studyDate,
                        String description, String patientId, String patientName, int seriesCount) {}
    public record Series(String id, String seriesInstanceUid, String modality, String description,
                         String seriesNumber, int instanceCount) {}
    public record StudyPage(List<Study> content, int offset, int limit, boolean hasMore) {}

    public StudyPage studies(UUID connectorId, int offset, int limit) {
        if (offset < 0 || offset > 1000000 || limit < 1 || limit > 100)
            throw new BadRequestException("Use offset 0–1000000 and limit 1–100.");
        var connector = connector(connectorId);
        var result = read(connector, "/studies?expand&since=" + offset + "&limit=" + (limit + 1));
        requireArray(result);
        List<Study> rows = new ArrayList<>();
        for (int i = 0; i < Math.min(limit, result.size()); i++) rows.add(study(result.get(i)));
        return new StudyPage(rows, offset, limit, result.size() > limit);
    }

    public Study study(UUID connectorId, String studyId) {
        validId(studyId);
        var connector = connector(connectorId);
        var item = read(connector, "/studies/" + studyId);
        requireObject(item);
        if (!item.path("PatientMainDicomTags").isObject()) {
            String patientId = item.path("ParentPatient").asText();
            if (!patientId.matches("[a-f0-9]{8}(-[a-f0-9]{8}){4}")) throw invalidResponse();
            var patient = read(connector, "/patients/" + patientId);
            requireObject(patient);
            ((com.fasterxml.jackson.databind.node.ObjectNode) item).set("PatientMainDicomTags", patient.get("MainDicomTags"));
        }
        return study(item);
    }

    public List<Series> series(UUID connectorId, String studyId) {
        validId(studyId);
        var result = read(connector(connectorId), "/studies/" + studyId + "/series");
        requireArray(result);
        List<Series> rows = new ArrayList<>();
        for (var item : result) {
            requireObject(item);
            if (!studyId.equals(item.path("ParentStudy").asText())) throw invalidResponse();
            var tags = item.path("MainDicomTags");
            rows.add(new Series(item.path("ID").asText(), tag(tags, "SeriesInstanceUID"),
                    tag(tags, "Modality"), tag(tags, "SeriesDescription"), tag(tags, "SeriesNumber"),
                    item.path("Instances").size()));
        }
        return rows;
    }

    private PacsConnectorEntity connector(UUID id) {
        var connector = connectors.findByIdAndTenantId(id, TenantContext.requireTenantId())
                .orElseThrow(() -> new ResourceNotFoundException("PacsConnector", "id", id.toString()));
        if (connector.getType() != PacsConnectorType.ORTHANC)
            throw new BadRequestException("Study browsing currently supports Orthanc connectors only.");
        return connector;
    }

    private JsonNode read(PacsConnectorEntity connector, String path) {
        try { return client.request(connector, path, false, "application/json"); }
        catch (BadRequestException ex) { throw ex; }
        catch (Exception ex) {
            // Never expose upstream bodies, credentials or patient data in an error.
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Could not read Orthanc studies. Check the connection, credentials and study availability.");
        }
    }

    private Study study(JsonNode item) {
        requireObject(item);
        var tags = item.path("MainDicomTags");
        var patient = item.path("PatientMainDicomTags");
        return new Study(item.path("ID").asText(), tag(tags, "StudyInstanceUID"),
                tag(tags, "AccessionNumber"), tag(tags, "StudyDate"), tag(tags, "StudyDescription"),
                tag(patient, "PatientID"), tag(patient, "PatientName"), item.path("Series").size());
    }
    private static String tag(JsonNode tags, String key) { return tags.path(key).asText(""); }
    private static void validId(String id) {
        if (id == null || !id.matches("[a-f0-9]{8}(-[a-f0-9]{8}){4}"))
            throw new BadRequestException("Use the Orthanc study ID returned by the studies API, not the DICOM UID.");
    }
    private static void requireObject(JsonNode node) {
        if (node == null || !node.isObject() || !node.path("ID").isTextual()
                || !node.path("MainDicomTags").isObject()) throw invalidResponse();
    }
    private static void requireArray(JsonNode node) { if (node == null || !node.isArray()) throw invalidResponse(); }
    private static ResponseStatusException invalidResponse() {
        return new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Orthanc returned an invalid study response.");
    }
}
