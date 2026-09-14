package com.medai.reporting;

import com.medai.auth.security.UserPrincipal;
import com.medai.common.dto.ApiResponse;
import com.medai.common.exception.BadRequestException;
import com.medai.common.exception.ResourceNotFoundException;
import com.medai.report.dto.ReportDtos.*;
import com.medai.report.service.ReportSignOffService;
import com.medai.tenant.TenantContext;
import com.medai.upload.enums.FileType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/reporting")
@PreAuthorize("hasAnyRole('DOCTOR', 'HOSPITAL_ADMIN')")
@RequiredArgsConstructor
public class ReportingController {
    private final JdbcTemplate jdbc;
    private final ReportSignOffService reports;

    public record TemplateRequest(@NotBlank @Size(max=120) String name,
            @NotNull FileType modality, @NotBlank @Size(max=100000) String body) {}
    public record Template(UUID id, String name, FileType modality, String body, Instant createdAt) {}
    public record DraftRequest(@NotNull UUID patientId, @NotNull FileType modality,
            @NotBlank @Size(max=1000) String studyDescription,
            @NotBlank @Size(max=100000) String reportText) {}

    @GetMapping("/templates")
    public ApiResponse<List<Template>> templates() {
        return ApiResponse.success(jdbc.query("""
            SELECT id, name, modality, body, created_at FROM report_templates
            WHERE tenant_id = ? ORDER BY created_at DESC, id
            """, (rs, row) -> new Template(rs.getObject(1, UUID.class), rs.getString(2),
                FileType.valueOf(rs.getString(3)), rs.getString(4), rs.getTimestamp(5).toInstant()),
                TenantContext.requireTenantId()));
    }

    @PostMapping("/templates")
    @Transactional
    public ResponseEntity<ApiResponse<Template>> createTemplate(@Valid @RequestBody TemplateRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        UUID tenant = authenticatedTenant(principal);
        UUID id = UUID.randomUUID();
        Instant now = Instant.now();
        jdbc.update("""
            INSERT INTO report_templates (id, tenant_id, name, modality, body, created_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """, id, tenant, request.name().trim(), request.modality().name(), request.body(),
                principal.userId(), java.sql.Timestamp.from(now));
        return ResponseEntity.status(201).body(ApiResponse.success(
                new Template(id, request.name().trim(), request.modality(), request.body(), now)));
    }

    @DeleteMapping("/templates/{id}")
    @Transactional
    public ApiResponse<Void> deleteTemplate(@PathVariable UUID id,
            @AuthenticationPrincipal UserPrincipal principal) {
        UUID tenant = authenticatedTenant(principal);
        int removed = jdbc.update("""
            DELETE FROM report_templates WHERE id = ? AND tenant_id = ?
            AND (created_by = ? OR ? = 'HOSPITAL_ADMIN')
            """, id, tenant, principal.userId(), principal.role());
        if (removed == 0) throw new ResourceNotFoundException("Owned template", "id", id.toString());
        return ApiResponse.success(null);
    }

    @PostMapping("/drafts")
    public ResponseEntity<ApiResponse<ReviewView>> createDraft(@Valid @RequestBody DraftRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        authenticatedTenant(principal);
        return ResponseEntity.status(201).body(ApiResponse.success(reports.createAuthoredDraft(
                new CreateTextDraftRequest(request.patientId(), request.reportText(), request.modality(),
                        request.studyDescription()), principal)));
    }

    private UUID authenticatedTenant(UserPrincipal principal) {
        UUID tenant = TenantContext.requireTenantId();
        if (principal == null || !tenant.equals(principal.tenantId()))
            throw new BadRequestException("Authenticated tenant context is required.");
        return tenant;
    }
}
