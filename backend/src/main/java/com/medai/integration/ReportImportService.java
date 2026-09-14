package com.medai.integration;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.medai.auth.security.UserPrincipal;
import com.medai.common.exception.BadRequestException;
import com.medai.common.exception.ResourceNotFoundException;
import com.medai.report.dto.ReportDtos.CreateTextDraftRequest;
import com.medai.report.dto.ReportDtos.ReviewView;
import com.medai.report.service.ReportSignOffService;
import com.medai.tenant.TenantContext;
import com.medai.upload.enums.FileType;
import jakarta.persistence.EntityManager;
import jakarta.validation.constraints.*;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ReportImportService {
    private final JdbcTemplate jdbc;
    private final ReportSignOffService reports;
    private final ObjectMapper mapper;
    private final EntityManager entityManager;

    public record ImportRequest(
            @NotBlank @Pattern(regexp = "[A-Za-z0-9._-]{1,64}") String sourceSystem,
            @NotBlank @Size(max = 128) String externalReportId,
            @NotNull UUID patientId,
            @NotBlank @Size(max = 100000) String reportText,
            FileType modality,
            @Size(max = 1000) String studyDescription) {}

    public record ImportResult(boolean duplicate, ReviewView review) {}
    private record Receipt(String payload, UUID reviewId) {}

    @Transactional
    public ImportResult ingest(ImportRequest request, UserPrincipal principal) {
        UUID tenant = TenantContext.requireTenantId();
        if (principal == null || !tenant.equals(principal.tenantId())) {
            throw new BadRequestException("Authenticated tenant context is required.");
        }
        String payload;
        try {
            // Store a digest, never a second copy of the report or patient details.
            payload = java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256")
                    .digest(mapper.writeValueAsBytes(request)));
        } catch (JsonProcessingException | java.security.NoSuchAlgorithmException ex) {
            throw new IllegalStateException("Could not fingerprint report import", ex);
        }
        // PostgreSQL waits for a concurrent insert on this key. Both receipt and draft commit
        // together; a failure rolls back the reservation so the sender can safely retry.
        int inserted = jdbc.update("""
                INSERT INTO report_imports (tenant_id, source_system, external_report_id, payload_hash)
                VALUES (?, ?, ?, ?) ON CONFLICT (tenant_id, source_system, external_report_id) DO NOTHING
                """, tenant, request.sourceSystem(), request.externalReportId(), payload);
        if (inserted == 0) {
            Receipt receipt = receipt(tenant, request.sourceSystem(), request.externalReportId());
            if (!payload.equals(receipt.payload())) {
                throw new ImportConflictException();
            }
            return new ImportResult(true, reports.get(receipt.reviewId()));
        }
        ReviewView review = reports.createTextDraft(new CreateTextDraftRequest(request.patientId(),
                request.reportText(), request.modality(), request.studyDescription()), principal);
        entityManager.flush();
        jdbc.update("""
                UPDATE report_imports SET review_id = ?
                WHERE tenant_id = ? AND source_system = ? AND external_report_id = ?
                """, review.id(), tenant, request.sourceSystem(), request.externalReportId());
        return new ImportResult(false, review);
    }

    @Transactional(readOnly = true)
    public ReviewView status(String sourceSystem, String externalReportId) {
        return reports.get(receipt(TenantContext.requireTenantId(), sourceSystem, externalReportId).reviewId());
    }

    private Receipt receipt(UUID tenant, String source, String externalId) {
        return jdbc.query("""
                SELECT payload_hash, review_id FROM report_imports
                WHERE tenant_id = ? AND source_system = ? AND external_report_id = ?
                """, (rs, row) -> new Receipt(rs.getString(1), rs.getObject(2, UUID.class)),
                tenant, source, externalId).stream().findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Report import", "externalReportId", externalId));
    }

    public static class ImportConflictException extends RuntimeException {
        public ImportConflictException() {
            super("This external report ID was already imported with different content. Submit a new revision ID.");
        }
    }
}
