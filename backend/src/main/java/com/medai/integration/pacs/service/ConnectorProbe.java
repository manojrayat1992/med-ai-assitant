package com.medai.integration.pacs.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.medai.common.exception.BadRequestException;
import com.medai.compliance.crypto.AesGcmEncryptionService;
import com.medai.integration.pacs.entity.PacsConnectorEntity;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Outbound destinations must be provisioned by the deployer, not arbitrary tenant input. */
@Component
@RequiredArgsConstructor
public class ConnectorProbe {
    private final ObjectMapper mapper;
    private final AesGcmEncryptionService encryption;
    @Value("${app.integrations.allowed-origins:}")
    private String allowedOrigins;

    public URI validateEndpoint(String endpoint) {
        try {
            URI uri = URI.create(endpoint);
            if (!Set.of("http", "https").contains(uri.getScheme()) || uri.getHost() == null
                    || uri.getUserInfo() != null || uri.getQuery() != null || uri.getFragment() != null)
                throw new IllegalArgumentException();
            String origin = uri.getScheme() + "://" + uri.getRawAuthority();
            if (Arrays.stream(allowedOrigins.split(",")).map(String::trim).noneMatch(origin::equals))
                throw new BadRequestException("Endpoint origin is not permitted. Ask the deployment administrator to configure PACS_ALLOWED_ORIGINS.");
            return uri;
        } catch (BadRequestException e) { throw e; }
        catch (RuntimeException e) { throw new BadRequestException("Use an HTTP(S) base URL without credentials, query parameters or fragments."); }
    }

    public String probe(PacsConnectorEntity e) throws Exception {
        return switch (e.getType()) {
            case ORTHANC -> {
                JsonNode system = request(e, "/system", false, "application/json");
                if (!system.has("Version") || !system.has("DicomAet")) throw new IllegalStateException("Response is not an Orthanc system document.");
                if (e.getOrthancModality() == null || e.getOrthancModality().isBlank()) {
                    yield "Orthanc REST /system verified. DICOM C-ECHO was not tested; configure an Orthanc modality ID to test it.";
                }
                JsonNode modalities = request(e, "/modalities", false, "application/json");
                boolean found = false;
                for (JsonNode modality : modalities) if (e.getOrthancModality().equals(modality.asText())) found = true;
                if (!found) throw new IllegalStateException("Configured modality ID is not registered in Orthanc.");
                request(e, "/modalities/" + e.getOrthancModality() + "/echo", true, "application/json");
                yield "Orthanc REST verified and Orthanc-initiated DICOM C-ECHO succeeded for the configured modality. Study retrieval was not tested.";
            }
            case DCM4CHEE -> {
                JsonNode studies = request(e, "/studies?limit=1", false, "application/dicom+json");
                if (!studies.isArray()) throw new IllegalStateException("QIDO response is not a DICOM JSON array.");
                for (JsonNode study : studies) if (!study.isObject() || !study.has("0020000D"))
                    throw new IllegalStateException("QIDO study is missing StudyInstanceUID.");
                yield "DICOMweb QIDO-RS study query verified. WADO retrieval and DICOM C-ECHO were not tested.";
            }
            case FHIR_R4_EPIC, FHIR_R4_CERNER -> {
                JsonNode metadata = request(e, "/metadata", false, "application/fhir+json");
                if (!"CapabilityStatement".equals(metadata.path("resourceType").asText())
                        || !"4.0.1".equals(metadata.path("fhirVersion").asText()))
                    throw new IllegalStateException("Endpoint did not return an FHIR R4 CapabilityStatement.");
                yield "FHIR R4 metadata verified. This does not verify SMART OAuth, patient access, vendor certification or report synchronization.";
            }
            case HL7_V2_MLLP -> throw new UnsupportedOperationException("No production MLLP receiver is configured. The HL7 sandbox only validates messages over authenticated HTTP.");
            case POWERSCRIBE_360 -> throw new UnsupportedOperationException("PowerScribe requires a vendor-supported workstation adapter. No adapter is installed; no sync was performed.");
        };
    }

    private JsonNode request(PacsConnectorEntity e, String path, boolean post, String accept) throws Exception {
        String base = validateEndpoint(e.getEndpointUrl()).toString().replaceAll("/+$", "");
        HttpURLConnection connection = (HttpURLConnection) URI.create(base + path).toURL().openConnection();
        connection.setInstanceFollowRedirects(false);
        connection.setConnectTimeout(3000); connection.setReadTimeout(5000);
        connection.setRequestProperty("Accept", accept);
        if (e.getEncryptedAuth() != null) connection.setRequestProperty("Authorization", encryption.decrypt(e.getEncryptedAuth()));
        try {
            if (post) {
                connection.setRequestMethod("POST"); connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/json");
                try (var out = connection.getOutputStream()) { out.write("{\"Timeout\":3}".getBytes(StandardCharsets.UTF_8)); }
            }
            int status = connection.getResponseCode();
            if (status < 200 || status >= 300) throw new IllegalStateException("Remote check returned HTTP " + status + ". Check endpoint, credentials and remote permissions.");
            try (var in = connection.getInputStream()) {
                byte[] data = in.readNBytes(1048577);
                if (data.length > 1048576) throw new IllegalStateException("Probe response exceeded 1 MB.");
                JsonNode json = mapper.readTree(data);
                if (json == null) throw new IllegalStateException("Remote check returned an empty response.");
                return json;
            }
        } finally { connection.disconnect(); }
    }
}
