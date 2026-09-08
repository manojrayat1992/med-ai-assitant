package com.medai.config;

/**
 * Runtime AI provider details for a single tenant-scoped model call.
 *
 * <p>The API key is intentionally present only in this server-side object and is never serialized
 * to the frontend.
 */
public record AiRuntimeConfig(
        AiProvider provider,
        String baseUrl,
        String apiKey,
        String chatModel,
        boolean tenantManaged,
        boolean dataAgreementInPlace
) {
}
