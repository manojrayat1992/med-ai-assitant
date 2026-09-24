package com.medai.integration.pacs.service;

import com.medai.common.exception.BadRequestException;
import com.medai.common.exception.ResourceNotFoundException;
import com.medai.integration.pacs.repository.PacsConnectorRepository;
import com.medai.report.entity.ReportReview;
import com.medai.report.repository.ReportReviewRepository;
import com.medai.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ReportPacsService {
    private final ReportReviewRepository reports;
    private final PacsConnectorRepository connectors;
    private final OrthancStudyService studies;
    private final JdbcTemplate jdbc;
    public record Link(UUID connectorId, String studyId, String studyInstanceUid, String viewerUrl) {}
    private ReportReview report(UUID id) {
        return reports.findByIdAndTenantId(id, TenantContext.requireTenantId())
                .orElseThrow(() -> new ResourceNotFoundException("Report", "id", id.toString()));
    }
    public Link get(UUID reportId) {
        var report = report(reportId);
        if (report.getPacsConnectorId() == null) return null;
        var connector = connectors.findByIdAndTenantId(report.getPacsConnectorId(), TenantContext.requireTenantId())
                .orElseThrow(() -> new ResourceNotFoundException("PacsConnector", "id", report.getPacsConnectorId().toString()));
        String url = connector.getViewerUrl() == null || connector.getViewerUrl().isBlank() ? null
                : PacsViewerUrl.launch(connector.getViewerUrl(), report.getPacsStudyUid());
        return new Link(connector.getId(), report.getPacsStudyId(), report.getPacsStudyUid(), url);
    }
    public Link link(UUID reportId, UUID connectorId, String studyId, boolean patientConfirmed) {
        report(reportId);
        if (connectorId == null || !patientConfirmed) throw new BadRequestException("Confirm that the selected study belongs to this report's patient.");
        var study = studies.study(connectorId, studyId);
        var connector = connectors.findByIdAndTenantId(connectorId, TenantContext.requireTenantId())
                .orElseThrow(() -> new ResourceNotFoundException("PacsConnector", "id", connectorId.toString()));
        String url = PacsViewerUrl.launch(connector.getViewerUrl(), study.studyInstanceUid());
        // Update only link metadata: never overwrite a concurrent sign-off or report edit.
        int changed = jdbc.update("UPDATE report_reviews SET pacs_connector_id=?, pacs_study_id=?, pacs_study_uid=?, updated_at=now() WHERE id=? AND tenant_id=?",
                connectorId, studyId, study.studyInstanceUid(), reportId, TenantContext.requireTenantId());
        if (changed != 1) throw new ResourceNotFoundException("Report", "id", reportId.toString());
        return new Link(connectorId, studyId, study.studyInstanceUid(), url);
    }
    public void unlink(UUID reportId) {
        report(reportId);
        jdbc.update("UPDATE report_reviews SET pacs_connector_id=NULL, pacs_study_id=NULL, pacs_study_uid=NULL, updated_at=now() WHERE id=? AND tenant_id=?", reportId, TenantContext.requireTenantId());
    }
    public Link launch(UUID reportId) {
        var link = get(reportId);
        if (link == null) throw new BadRequestException("Link a PACS study to this report first.");
        var study = studies.study(link.connectorId(), link.studyId());
        if (!link.studyInstanceUid().equals(study.studyInstanceUid())) throw new BadRequestException("The linked study has changed. Ask an administrator to verify the link.");
        if (link.viewerUrl() == null) throw new BadRequestException("Configure the OHIF viewer URL in Integrations first.");
        return link;
    }
}
