package com.medai.qa.controller;

import com.medai.common.dto.ApiResponse;
import com.medai.qa.model.QaResult;
import com.medai.qa.service.QaService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
@Tag(name = "Report QA", description = "On-demand report quality checks before clinician sign-off")
public class QaController {

    private final QaService qaService;
    private final com.medai.pilot.results.PilotEventRecorder pilotEvents;

    @PostMapping("/{reviewId}/qa")
    @PreAuthorize("hasAnyRole('DOCTOR','HOSPITAL_ADMIN','LAB_TECH')")
    @Operation(summary = "Run report consistency and workspace-reference QA checks",
               description = "Returns potential issues and supporting evidence. The report is not modified.")
    public ResponseEntity<ApiResponse<QaResult>> evaluateReport(
            @PathVariable UUID reviewId,
            @org.springframework.security.core.annotation.AuthenticationPrincipal com.medai.auth.security.UserPrincipal principal,
            @RequestBody(required = false) Map<String, String> body) {
        String customText = body != null ? body.get("reportText") : null;
        return ResponseEntity.ok(ApiResponse.success(pilotEvents.qa(qaService.evaluateReport(reviewId, customText), principal)));
    }
}
