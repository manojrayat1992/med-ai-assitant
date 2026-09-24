package com.medai.integration.pacs.service;

import com.medai.common.exception.ResourceNotFoundException;
import com.medai.integration.pacs.dto.*;
import com.medai.integration.pacs.entity.PacsConnectorEntity;
import com.medai.integration.pacs.enums.ConnectorStatus;
import com.medai.integration.pacs.enums.PacsConnectorType;
import com.medai.integration.pacs.repository.PacsConnectorRepository;
import com.medai.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;


@Slf4j
@Service
@RequiredArgsConstructor
public class PacsIntegrationService {

    private final PacsConnectorRepository connectorRepository;
    private final Hl7MessageParserService hl7MessageParserService;
    private final ConnectorProbe probe;
    private final com.medai.compliance.crypto.AesGcmEncryptionService encryption;

    private UUID resolveTenantId() { return TenantContext.requireTenantId(); }

    @Transactional(readOnly = true)
    public List<PacsConnectorDto> getConnectors() {
        return connectorRepository.findByTenantIdOrderByCreatedAtAsc(resolveTenantId())
                .stream().map(this::toDto).toList();
    }

    @Transactional
    public PacsConnectorDto saveConnector(SaveConnectorRequest request) {
        UUID tenantId = resolveTenantId();
        PacsConnectorEntity entity;

        if (request.getId() != null) {
            entity = connectorRepository.findByIdAndTenantId(request.getId(), tenantId)
                    .orElseThrow(() -> new ResourceNotFoundException("PacsConnector", "id", request.getId().toString()));
        } else {
            entity = new PacsConnectorEntity();
            entity.setTenantId(tenantId);

        }

        if (request.getEndpointUrl() != null && !request.getEndpointUrl().isBlank()) probe.validateEndpoint(request.getEndpointUrl());
        else if (request.getType() != PacsConnectorType.HL7_V2_MLLP && request.getType() != PacsConnectorType.POWERSCRIBE_360)
            throw new com.medai.common.exception.BadRequestException("Endpoint URL is required.");
        boolean basic = request.getUsername() != null && !request.getUsername().isBlank();
        boolean password = request.getPassword() != null && !request.getPassword().isBlank();
        boolean bearer = request.getBearerToken() != null && !request.getBearerToken().isBlank();
        if (bearer && (basic || password) || password && !basic)
            throw new com.medai.common.exception.BadRequestException("Provide either username and password or a bearer token.");
        if (basic && request.getUsername().contains(":"))
            throw new com.medai.common.exception.BadRequestException("Basic authentication username cannot contain a colon.");
        if (!Objects.equals(entity.getEndpointUrl(), request.getEndpointUrl())) entity.setEncryptedAuth(null);
        if (Boolean.TRUE.equals(request.getClearCredentials())) entity.setEncryptedAuth(null);
        if (request.getBearerToken() != null && !request.getBearerToken().isBlank()) {
            entity.setEncryptedAuth(encryption.encrypt("Bearer " + request.getBearerToken()));
        } else if (request.getUsername() != null && !request.getUsername().isBlank()) {
            if (request.getPassword() == null || request.getPassword().isBlank())
                throw new com.medai.common.exception.BadRequestException("Password is required with a username.");
            entity.setEncryptedAuth(encryption.encrypt("Basic " + Base64.getEncoder().encodeToString(
                (request.getUsername() + ":" + request.getPassword()).getBytes(java.nio.charset.StandardCharsets.UTF_8))));
        }
        entity.setViewerUrl(PacsViewerUrl.validate(request.getViewerUrl()));
        entity.setOrthancModality(request.getOrthancModality());
        entity.setStatus(ConnectorStatus.DISCONNECTED);
        entity.setLatencyMs(null); entity.setLastPingAt(null);
        entity.setName(request.getName());
        entity.setType(request.getType());
        entity.setHost(request.getHost());
        entity.setPort(request.getPort());
        entity.setAetTitle(request.getAetTitle());
        entity.setLocalAet(request.getLocalAet() != null ? request.getLocalAet() : "MEDAI_ROUTER");
        entity.setEndpointUrl(request.getEndpointUrl());
        entity.setDescription(request.getDescription());

        PacsConnectorEntity saved = connectorRepository.save(entity);
        log.info("Saved PACS connector {} for tenant {}", saved.getId(), tenantId);
        return toDto(saved);
    }

    @Transactional
    public PingResultDto pingConnector(UUID id) {
        UUID tenantId = resolveTenantId();
        PacsConnectorEntity entity = connectorRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("PacsConnector", "id", id.toString()));

        long start = System.nanoTime();
        String message;
        try {
            message = probe.probe(entity);
            entity.setStatus(ConnectorStatus.CONNECTED);
            entity.setLatencyMs((int) ((System.nanoTime() - start) / 1_000_000));
        } catch (UnsupportedOperationException ex) {
            entity.setStatus(ConnectorStatus.DISCONNECTED); entity.setLatencyMs(null); message = ex.getMessage();
        } catch (Exception ex) {
            entity.setStatus(ConnectorStatus.ERROR); entity.setLatencyMs(null);
            message = ex instanceof IllegalStateException || ex instanceof com.medai.common.exception.BadRequestException
                    ? ex.getMessage() : "Connection check failed. Verify network access, remote service and credentials.";
        }
        entity.setLastPingAt(Instant.now());
        connectorRepository.save(entity);
        return PingResultDto.builder().connectorId(id).status(entity.getStatus()).latencyMs(entity.getLatencyMs())
                .message(message).timestamp(entity.getLastPingAt()).build();
    }

    public Hl7ParseResultDto parseHl7(Hl7ParseRequest request) {
        return hl7MessageParserService.parseMessage(request.getRawMessage());
    }

    public Map<String, Object> syncPowerScribe(Map<String, Object> payload) {
        throw new UnsupportedOperationException("PowerScribe workstation adapter is not installed. No templates or reports were synchronized.");
    }

    private PacsConnectorDto toDto(PacsConnectorEntity e) {
        return PacsConnectorDto.builder()
                .id(e.getId())
                .tenantId(e.getTenantId())
                .name(e.getName())
                .type(e.getType())
                .host(e.getHost())
                .port(e.getPort())
                .aetTitle(e.getAetTitle())
                .localAet(e.getLocalAet())
                .endpointUrl(e.getEndpointUrl())
                .viewerUrl(e.getViewerUrl())
                .status(e.getStatus())
                .lastPingAt(e.getLastPingAt())
                .latencyMs(e.getLatencyMs())
                .description(e.getDescription())
                .credentialsConfigured(e.getEncryptedAuth() != null)
                .orthancModality(e.getOrthancModality())
                .createdAt(e.getCreatedAt())
                .build();
    }
}
