package com.medai.integration.pacs.dto;

import com.medai.integration.pacs.enums.ConnectorStatus;
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
public class PingResultDto {
    private UUID connectorId;
    private ConnectorStatus status;
    private Integer latencyMs;
    private String message;
    private Instant timestamp;
}
