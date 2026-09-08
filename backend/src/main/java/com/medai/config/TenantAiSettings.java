package com.medai.config;

import com.medai.common.entity.TenantAwareEntity;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "tenant_ai_settings",
       uniqueConstraints = @UniqueConstraint(name = "uk_tenant_ai_settings_tenant", columnNames = "tenant_id"))
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TenantAiSettings extends TenantAwareEntity {

    @Enumerated(EnumType.STRING)
    @Column(name = "provider", nullable = false, length = 30)
    private AiProvider provider;

    @Column(name = "base_url", nullable = false, length = 500)
    private String baseUrl;

    @Column(name = "chat_model", nullable = false, length = 150)
    private String chatModel;

    @Column(name = "encrypted_api_key", columnDefinition = "TEXT")
    private String encryptedApiKey;

    @Column(name = "api_key_last_four", length = 8)
    private String apiKeyLastFour;

    @Column(name = "enabled", nullable = false)
    private boolean enabled;

    @Column(name = "data_agreement_in_place", nullable = false)
    private boolean dataAgreementInPlace;

    @Column(name = "api_key_updated_at")
    private Instant apiKeyUpdatedAt;
}
