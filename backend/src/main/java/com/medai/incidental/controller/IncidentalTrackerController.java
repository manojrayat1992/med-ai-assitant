package com.medai.incidental.controller;

import com.medai.common.dto.ApiResponse;
import com.medai.incidental.dto.IncidentalFindingDto;
import com.medai.incidental.dto.IncidentalTrackerSummaryDto;
import com.medai.incidental.dto.ParseReportRequest;
import com.medai.incidental.dto.UpdateStatusRequest;
import com.medai.incidental.enums.IncidentalFollowUpStatus;
import com.medai.incidental.enums.IncidentalGuidelineSystem;
import com.medai.incidental.service.IncidentalTrackerService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/incidental-findings")
@RequiredArgsConstructor
@Tag(name = "Incidental Finding Tracker", description = "Closed-loop tracking and revenue recapture for incidental findings")
public class IncidentalTrackerController {

    private final IncidentalTrackerService trackerService;

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Get all incidental findings for the active tenant with optional filters")
    public ResponseEntity<ApiResponse<List<IncidentalFindingDto>>> getFindings(
            @RequestParam(required = false) UUID patientId,
            @RequestParam(required = false) IncidentalFollowUpStatus status,
            @RequestParam(required = false) IncidentalGuidelineSystem guideline) {
        return ResponseEntity.ok(ApiResponse.success(trackerService.getFindings(patientId, status, guideline)));
    }

    @GetMapping("/summary")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Get high-level closed-loop summary metrics and recaptured hospital revenue")
    public ResponseEntity<ApiResponse<IncidentalTrackerSummaryDto>> getSummary() {
        return ResponseEntity.ok(ApiResponse.success(trackerService.getSummary()));
    }

    @PostMapping("/parse")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Extract incidental findings from report narrative and initiate tracking")
    public ResponseEntity<ApiResponse<List<IncidentalFindingDto>>> parseAndTrack(
            @Valid @RequestBody ParseReportRequest request) {
        return ResponseEntity.ok(ApiResponse.success(trackerService.parseAndTrackReport(request)));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Update tracking status (e.g. SCHEDULED, COMPLETED, DISMISSED)")
    public ResponseEntity<ApiResponse<IncidentalFindingDto>> updateStatus(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateStatusRequest request) {
        return ResponseEntity.ok(ApiResponse.success(trackerService.updateStatus(id, request)));
    }
}
