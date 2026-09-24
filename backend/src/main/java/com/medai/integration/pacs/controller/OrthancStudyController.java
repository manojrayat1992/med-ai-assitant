package com.medai.integration.pacs.controller;

import com.medai.common.dto.ApiResponse;
import com.medai.integration.pacs.service.OrthancStudyService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/integrations/connectors/{connectorId}/studies")
@RequiredArgsConstructor
@PreAuthorize("hasRole('HOSPITAL_ADMIN')")
public class OrthancStudyController {
    private final OrthancStudyService studies;

    @GetMapping
    public ResponseEntity<ApiResponse<OrthancStudyService.StudyPage>> list(
            @PathVariable UUID connectorId, @RequestParam(defaultValue = "0") int offset,
            @RequestParam(defaultValue = "20") int limit) {
        return ResponseEntity.ok().header("Cache-Control", "no-store")
                .body(ApiResponse.success(studies.studies(connectorId, offset, limit)));
    }

    @GetMapping("/{studyId}")
    public ResponseEntity<ApiResponse<OrthancStudyService.Study>> detail(
            @PathVariable UUID connectorId, @PathVariable String studyId) {
        return ResponseEntity.ok().header("Cache-Control", "no-store")
                .body(ApiResponse.success(studies.study(connectorId, studyId)));
    }

    @GetMapping("/{studyId}/series")
    public ResponseEntity<ApiResponse<List<OrthancStudyService.Series>>> series(
            @PathVariable UUID connectorId, @PathVariable String studyId) {
        return ResponseEntity.ok().header("Cache-Control", "no-store")
                .body(ApiResponse.success(studies.series(connectorId, studyId)));
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiResponse<Void>> upstreamFailure(ResponseStatusException ex) {
        return ResponseEntity.status(ex.getStatusCode()).header("Cache-Control", "no-store")
                .body(ApiResponse.error(ex.getReason()));
    }
}
