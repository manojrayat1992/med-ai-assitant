package com.medai.anatomy.controller;

import com.medai.anatomy.model.AnatomyTarget;
import com.medai.anatomy.service.AnatomyService;
import com.medai.common.dto.ApiResponse;
import com.medai.common.exception.ResourceNotFoundException;
import com.medai.finding.service.FindingExtractionService;
import com.medai.report.repository.ReportReviewRepository;
import com.medai.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/reports")
public class ReportAnatomyController {
    private final ReportReviewRepository reports;
    private final FindingExtractionService extraction;
    private final AnatomyService anatomy;
    public record FindingView(String id, String sourceText, String status, String certainty,
                              String sourceSection, AnatomyTarget anatomyTarget) {}

    @GetMapping("/{reviewId}/anatomy-findings")
    @PreAuthorize("hasAnyRole('HOSPITAL_ADMIN','DOCTOR','LAB_TECH')")
    @Transactional(readOnly = true)
    public ResponseEntity<ApiResponse<List<FindingView>>> findings(@PathVariable UUID reviewId) {
        var review = reports.findByIdAndTenantId(reviewId, TenantContext.requireTenantId())
                .orElseThrow(() -> new ResourceNotFoundException("Report", "id", reviewId));
        var findings = extraction.extract(review).stream().map(f -> new FindingView(
                f.id(), f.sourceText(), f.status().name(), f.certainty().name(), f.sourceSection().name(),
                anatomy.targetFor(f).orElse(null))).toList();
        return ResponseEntity.ok().header("Cache-Control", "no-store").body(ApiResponse.success(findings));
    }
}
