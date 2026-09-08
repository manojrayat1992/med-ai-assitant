package com.medai.config;

import java.time.Instant;

public final class AiSettingsDtos {

    private AiSettingsDtos() {
    }

    public record AiSettingsView(
            String provider,
            String baseUrl,
            String chatModel,
            boolean enabled,
            boolean keyConfigured,
            String apiKeyPreview,
            boolean dataAgreementInPlace,
            boolean usingTenantSettings,
            Instant updatedAt
    ) {
    }

    public record UpdateAiSettingsRequest(
            String provider,
            String baseUrl,
            String chatModel,
            String apiKey,
            Boolean enabled,
            Boolean dataAgreementInPlace
    ) {
    }

    public record AiConnectionTestResult(
            String provider,
            String baseUrl,
            String chatModel,
            boolean tenantManaged,
            boolean success,
            String message
    ) {
    }
}
