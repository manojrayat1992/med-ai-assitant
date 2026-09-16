package com.medai.report.feedback;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.medai.auth.security.UserPrincipal;
import com.medai.common.exception.BadRequestException;
import com.medai.common.exception.ResourceNotFoundException;
import com.medai.compliance.crypto.AesGcmEncryptionService;
import com.medai.report.repository.ReportReviewRepository;
import com.medai.tenant.TenantContext;
import jakarta.validation.constraints.*;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
public class ReportFeedbackService {
    private final JdbcTemplate jdbc;
    private final ReportReviewRepository reports;
    private final AesGcmEncryptionService encryption;
    private final ObjectMapper mapper;
    public enum Category { WRONG_SUGGESTION, MISSED_FINDING, OTHER }
    public record Request(@NotNull UUID submissionId, @NotNull Category category,
            @Size(max=5000) String originalSuggestion, @NotBlank @Size(max=5000) String explanation,
            @NotBlank @Size(max=10000) String correction) {}
    public record Content(String originalSuggestion, String explanation, String correction,
            String reportSnapshot, String reportStatus, Instant reportUpdatedAt) {}
    public record View(UUID id, UUID reportId, UUID submittedBy, Category category, Instant createdAt, Content content) {}

    @Transactional
    public View submit(UUID reportId, Request request, UserPrincipal principal) {
        UUID tenant = TenantContext.requireTenantId();
        if (!tenant.equals(principal.tenantId())) throw new BadRequestException("Tenant context mismatch.");
        var report = reports.findByIdAndTenantId(reportId, tenant)
                .orElseThrow(() -> new ResourceNotFoundException("Report", "id", reportId.toString()));
        String original = request.originalSuggestion() == null ? "" : request.originalSuggestion().trim();
        if (request.category() == Category.WRONG_SUGGESTION && original.isBlank())
            throw new BadRequestException("Quote the suggestion you are flagging.");
        var content = new Content(original, request.explanation().trim(), request.correction().trim(),
                report.getFinalContent() != null ? report.getFinalContent() : report.getDraftContent(), report.getStatus(), report.getUpdatedAt());
        // The client retains this ID on network failure. Retrying cannot create duplicate feedback.
        jdbc.update("""
            INSERT INTO report_feedback(id,tenant_id,report_id,submitted_by,category,encrypted_content)
            VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING
            """, request.submissionId(), tenant, reportId, principal.userId(), request.category().name(), encode(content));
        var existing = read("SELECT * FROM report_feedback WHERE id=? AND tenant_id=? AND report_id=?", request.submissionId(), tenant, reportId);
        if (existing.isEmpty()) throw new BadRequestException("Submission ID is already in use; start a new feedback submission.");
        View saved = existing.getFirst();
        if (!saved.submittedBy().equals(principal.userId()) || saved.category() != request.category()
                || !saved.content().originalSuggestion().equals(original)
                || !saved.content().explanation().equals(content.explanation())
                || !saved.content().correction().equals(content.correction()))
            throw new BadRequestException("Submission ID belongs to different feedback; start a new submission.");
        return saved;
    }
    @Transactional(readOnly=true)
    public List<View> list(UUID reportId, int page) {
        UUID tenant = TenantContext.requireTenantId();
        reports.findByIdAndTenantId(reportId, tenant)
                .orElseThrow(() -> new ResourceNotFoundException("Report", "id", reportId.toString()));
        if (page < 0 || page > 10000) throw new BadRequestException("Invalid feedback page.");
        return read("SELECT * FROM report_feedback WHERE tenant_id=? AND report_id=? ORDER BY created_at DESC,id DESC LIMIT 20 OFFSET ?", tenant, reportId, page * 20);
    }
    private List<View> read(String sql, Object... args) {
        return jdbc.query(sql, (rs, row) -> new View(rs.getObject("id", UUID.class), rs.getObject("report_id", UUID.class),
                rs.getObject("submitted_by", UUID.class), Category.valueOf(rs.getString("category")),
                rs.getTimestamp("created_at").toInstant(), decode(rs.getString("encrypted_content"))), args);
    }
    private String encode(Content content) {
        try { return encryption.encrypt(mapper.writeValueAsString(content)); }
        catch (JsonProcessingException e) { throw new IllegalStateException("Could not store feedback."); }
    }
    private Content decode(String value) {
        try { return mapper.readValue(encryption.decrypt(value), Content.class); }
        catch (JsonProcessingException e) { throw new IllegalStateException("Could not read feedback."); }
    }
}
