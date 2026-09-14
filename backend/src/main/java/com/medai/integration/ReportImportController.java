package com.medai.integration;

import com.medai.auth.security.UserPrincipal;
import com.medai.common.dto.ApiResponse;
import com.medai.report.dto.ReportDtos.ReviewView;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/integrations/reports")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('HOSPITAL_ADMIN', 'DOCTOR', 'LAB_TECH')")
public class ReportImportController {
    private final ReportImportService service;

    @PostMapping
    public ResponseEntity<ApiResponse<ReportImportService.ImportResult>> ingest(
            @Valid @RequestBody ReportImportService.ImportRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        var result = service.ingest(request, principal);
        return ResponseEntity.status(result.duplicate() ? 200 : 201).body(ApiResponse.success(result));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<ReviewView>> status(@RequestParam String sourceSystem,
                                                         @RequestParam String externalReportId) {
        return ResponseEntity.ok(ApiResponse.success(service.status(sourceSystem, externalReportId)));
    }

    @ExceptionHandler(ReportImportService.ImportConflictException.class)
    public ResponseEntity<ApiResponse<Void>> conflict(ReportImportService.ImportConflictException ex) {
        return ResponseEntity.status(409).body(ApiResponse.error(ex.getMessage()));
    }
}
