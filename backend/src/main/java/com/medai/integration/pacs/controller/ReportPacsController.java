package com.medai.integration.pacs.controller;

import com.medai.common.dto.ApiResponse;
import com.medai.integration.pacs.service.ReportPacsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.UUID;

@RestController
@RequestMapping("/api/reports/{reportId}/pacs")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('HOSPITAL_ADMIN','DOCTOR')")
public class ReportPacsController {
    private final ReportPacsService service;
    public record LinkRequest(UUID connectorId, String studyId, boolean patientConfirmed) {}
    private ResponseEntity<ApiResponse<ReportPacsService.Link>> response(ReportPacsService.Link link) {
        return ResponseEntity.ok().header("Cache-Control", "no-store").body(ApiResponse.success(link));
    }
    @GetMapping public ResponseEntity<ApiResponse<ReportPacsService.Link>> get(@PathVariable UUID reportId) { return response(service.get(reportId)); }
    @PutMapping @PreAuthorize("hasRole('HOSPITAL_ADMIN')")
    public ResponseEntity<ApiResponse<ReportPacsService.Link>> link(@PathVariable UUID reportId, @RequestBody LinkRequest request) {
        return response(service.link(reportId, request.connectorId(), request.studyId(), request.patientConfirmed()));
    }
    @DeleteMapping @PreAuthorize("hasRole('HOSPITAL_ADMIN')")
    public ResponseEntity<ApiResponse<ReportPacsService.Link>> unlink(@PathVariable UUID reportId) { service.unlink(reportId); return response(null); }
    @PostMapping("/launch") public ResponseEntity<ApiResponse<ReportPacsService.Link>> launch(@PathVariable UUID reportId) { return response(service.launch(reportId)); }
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiResponse<Void>> upstream(ResponseStatusException ex) { return ResponseEntity.status(ex.getStatusCode()).body(ApiResponse.error(ex.getReason())); }
}
