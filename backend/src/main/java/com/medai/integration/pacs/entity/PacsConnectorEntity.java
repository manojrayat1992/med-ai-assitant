package com.medai.integration.pacs.entity;

import com.medai.integration.pacs.enums.ConnectorStatus;
import com.medai.integration.pacs.enums.PacsConnectorType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "pacs_connectors", indexes = {
        @Index(name = "idx_pacs_connectors_tenant", columnList = "tenant_id"),
        @Index(name = "idx_pacs_connectors_type", columnList = "type"),
        @Index(name = "idx_pacs_connectors_status", columnList = "status")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PacsConnectorEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "name", nullable = false, length = 120)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 64)
    private PacsConnectorType type;

    @Column(name = "host", length = 255)
    private String host;

    @Column(name = "port")
    private Integer port;

    @Column(name = "aet_title", length = 64)
    private String aetTitle;

    @Column(name = "local_aet", length = 64)
    private String localAet;

    @Column(name = "endpoint_url", length = 512)
    private String endpointUrl;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private ConnectorStatus status;

    @Column(name = "last_ping_at")
    private Instant lastPingAt;

    @Column(name = "latency_ms")
    private Integer latencyMs;

    @Column(name = "description", length = 500)
    private String description;

    @Column(name = "metadata_json", columnDefinition = "TEXT")
    private String metadataJson;

    @Column(name = "encrypted_auth", columnDefinition = "TEXT")
    private String encryptedAuth;

    @Column(name = "orthanc_modality", length = 64)
    private String orthancModality;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
