package com.medai.integration.pacs.dto;

import com.medai.integration.pacs.enums.ConnectorStatus;
import com.medai.integration.pacs.enums.PacsConnectorType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PacsConnectorDto {
    private UUID id;
    private UUID tenantId;
    private String name;
    private PacsConnectorType type;
    private String host;
    private Integer port;
    private String aetTitle;
    private String localAet;
    private String endpointUrl;
    private String viewerUrl;
    private ConnectorStatus status;
    private Instant lastPingAt;
    private Integer latencyMs;
    private String description;
    private String metadataJson;
    private boolean credentialsConfigured;
    private String orthancModality;
    private Instant createdAt;
}
