package com.medai.integration.pacs.controller;

import com.medai.common.dto.ApiResponse;
import com.medai.integration.pacs.dto.*;
import com.medai.integration.pacs.service.PacsIntegrationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/integrations/connectors")
@RequiredArgsConstructor
@Tag(name = "PACS & EHR Connectors", description = "Tenant connector configuration, remote checks and HL7 text-report validation")
public class PacsIntegrationController {

    private final PacsIntegrationService integrationService;

    @GetMapping
    @PreAuthorize("hasRole('HOSPITAL_ADMIN')")
    @Operation(summary = "List all configured PACS and EHR connectors with last checked connection status")
    public ResponseEntity<ApiResponse<List<PacsConnectorDto>>> getConnectors() {
        return ResponseEntity.ok(ApiResponse.success(integrationService.getConnectors()));
    }

    @PostMapping
    @PreAuthorize("hasRole('HOSPITAL_ADMIN')")
    @Operation(summary = "Create or update a PACS / EHR connector configuration")
    public ResponseEntity<ApiResponse<PacsConnectorDto>> saveConnector(
            @Valid @RequestBody SaveConnectorRequest request) {
        return ResponseEntity.ok(ApiResponse.success(integrationService.saveConnector(request)));
    }

    @PostMapping("/{id}/ping")
    @PreAuthorize("hasRole('HOSPITAL_ADMIN')")
    @Operation(summary = "Execute live handshake test (C-ECHO DICOM verification / HTTP ping)")
    public ResponseEntity<ApiResponse<PingResultDto>> pingConnector(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(integrationService.pingConnector(id)));
    }

    @PostMapping("/hl7/parse")
    @PreAuthorize("hasRole('HOSPITAL_ADMIN')")
    @Operation(summary = "Validate one ORU/ORM text-report message and preview an ACK; does not ingest")
    public ResponseEntity<ApiResponse<Hl7ParseResultDto>> parseHl7(
            @Valid @RequestBody Hl7ParseRequest request) {
        return ResponseEntity.ok(ApiResponse.success(integrationService.parseHl7(request)));
    }

    @PostMapping("/powerscribe/sync")
    @PreAuthorize("hasRole('HOSPITAL_ADMIN')")
    @Operation(summary = "Unavailable: PowerScribe workstation adapter is required (501)")
    public ResponseEntity<ApiResponse<Map<String, Object>>> syncPowerScribe(
            @RequestBody Map<String, Object> payload) {
        return ResponseEntity.ok(ApiResponse.success(integrationService.syncPowerScribe(payload)));
    }
    @ExceptionHandler(UnsupportedOperationException.class)
    public ResponseEntity<ApiResponse<Void>> unsupported(UnsupportedOperationException ex) {
        return ResponseEntity.status(501).body(ApiResponse.error(ex.getMessage()));
    }
}
