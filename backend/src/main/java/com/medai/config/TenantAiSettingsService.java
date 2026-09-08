package com.medai.config;

import com.medai.common.exception.BadRequestException;
import com.medai.compliance.crypto.AesGcmEncryptionService;
import com.medai.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.ai.openai.api.OpenAiApi;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
@Slf4j
public class TenantAiSettingsService {

    private static final String OPENAI_BASE_URL = "https://api.openai.com";
    private static final String GROQ_BASE_URL = "https://api.groq.com/openai";
    private static final String OPENAI_DEFAULT_MODEL = "gpt-4o";
    private static final String GROQ_DEFAULT_MODEL = "qwen/qwen3.6-27b";
    private static final List<String> LOCAL_HOSTS = List.of(
            "localhost", "127.0.0.1", "0.0.0.0", "host.docker.internal");

    private final TenantAiSettingsRepository repository;
    private final AesGcmEncryptionService encryptionService;
    private final Set<UUID> agreementWarnings = ConcurrentHashMap.newKeySet();

    @Value("${spring.ai.openai.base-url:" + GROQ_BASE_URL + "}")
    private String fallbackBaseUrl;

    @Value("${spring.ai.openai.api-key:gsk-placeholder}")
    private String fallbackApiKey;

    @Value("${spring.ai.openai.chat.options.model:" + GROQ_DEFAULT_MODEL + "}")
    private String fallbackModel;

    @Value("${app.ai.data-agreement-in-place:false}")
    private boolean fallbackDataAgreementInPlace;

    @Transactional(readOnly = true)
    public AiSettingsDtos.AiSettingsView getCurrent() {
        UUID tenantId = TenantContext.requireTenantId();
        return repository.findByTenantId(tenantId)
                .map(this::toView)
                .orElseGet(this::fallbackView);
    }

    @Transactional
    public AiSettingsDtos.AiSettingsView updateCurrent(AiSettingsDtos.UpdateAiSettingsRequest request) {
        UUID tenantId = TenantContext.requireTenantId();
        TenantAiSettings settings = repository.findByTenantId(tenantId)
                .orElseGet(TenantAiSettings::new);
        settings.setTenantId(tenantId);

        AiProvider provider = parseProvider(request.provider());
        String baseUrl = clean(request.baseUrl());
        String model = clean(request.chatModel());
        String apiKey = clean(request.apiKey());

        if (baseUrl == null) {
            baseUrl = defaultBaseUrl(provider);
        }
        if (model == null) {
            model = defaultModel(provider);
        }
        if (provider == AiProvider.CUSTOM && baseUrl == null) {
            throw new BadRequestException("Base URL is required for a custom AI provider.");
        }
        if (model == null) {
            throw new BadRequestException("Chat model is required.");
        }
        validateProviderSelection(provider, baseUrl, apiKey);

        if (apiKey != null) {
            settings.setEncryptedApiKey(encryptionService.encrypt(apiKey));
            settings.setApiKeyLastFour(lastFour(apiKey));
            settings.setApiKeyUpdatedAt(Instant.now());
        }

        boolean enabled = request.enabled() == null || request.enabled();
        if (enabled && !hasStoredApiKey(settings)) {
            throw new BadRequestException("API key is required before tenant AI settings can be enabled.");
        }

        settings.setProvider(provider);
        settings.setBaseUrl(baseUrl);
        settings.setChatModel(model);
        settings.setEnabled(enabled);
        settings.setDataAgreementInPlace(Boolean.TRUE.equals(request.dataAgreementInPlace()));

        return toView(repository.save(settings));
    }

    @Transactional
    public AiSettingsDtos.AiSettingsView resetCurrent() {
        repository.deleteByTenantId(TenantContext.requireTenantId());
        return fallbackView();
    }

    public AiSettingsDtos.AiConnectionTestResult testCurrent() {
        UUID tenantId = TenantContext.requireTenantId();
        AiRuntimeConfig config = resolveRuntimeConfig(tenantId);
        if (!isConfiguredKey(config.apiKey())) {
            throw new BadRequestException("No usable AI API key is configured for this hospital.");
        }

        try {
            ChatClient chatClient = createChatClient(config);
            String content = chatClient.prompt()
                    .options(OpenAiChatOptions.builder()
                            .withModel(config.chatModel())
                            .withMaxTokens(12)
                            .build())
                    .user("Reply with exactly: OK")
                    .call()
                    .content();

            return new AiSettingsDtos.AiConnectionTestResult(
                    config.provider().name(),
                    config.baseUrl(),
                    config.chatModel(),
                    config.tenantManaged(),
                    true,
                    content == null || content.isBlank() ? "Provider responded." : "Provider responded: " + content.trim());
        } catch (Exception e) {
            log.warn("AI provider test failed for tenant {} using provider={}, baseUrl={}, model={}: {}",
                    tenantId, config.provider(), config.baseUrl(), config.chatModel(), providerError(e));
            throw new BadRequestException("AI provider test failed: " + providerError(e));
        }
    }

    @Transactional(readOnly = true)
    public AiRuntimeConfig resolveRuntimeConfig(UUID tenantId) {
        TenantAiSettings settings = repository.findByTenantId(tenantId).orElse(null);
        if (settings != null && settings.isEnabled() && hasStoredApiKey(settings)) {
            warnIfAgreementMissing(tenantId, settings.getBaseUrl(), settings.isDataAgreementInPlace());
            log.info("Resolved tenant AI provider for tenant {}: provider={}, baseUrl={}, model={}, tenantManaged=true",
                    tenantId, settings.getProvider(), settings.getBaseUrl(), settings.getChatModel());
            return new AiRuntimeConfig(
                    settings.getProvider(),
                    settings.getBaseUrl(),
                    encryptionService.decrypt(settings.getEncryptedApiKey()),
                    settings.getChatModel(),
                    true,
                    settings.isDataAgreementInPlace());
        }

        warnIfAgreementMissing(tenantId, fallbackBaseUrl, fallbackDataAgreementInPlace);
        log.info("Resolved fallback AI provider for tenant {}: provider={}, baseUrl={}, model={}, tenantManaged=false",
                tenantId, inferProvider(fallbackBaseUrl), fallbackBaseUrl, fallbackModel);
        return new AiRuntimeConfig(
                inferProvider(fallbackBaseUrl),
                fallbackBaseUrl,
                fallbackApiKey,
                fallbackModel,
                false,
                fallbackDataAgreementInPlace);
    }

    public ChatClient createChatClient(AiRuntimeConfig config) {
        OpenAiApi api = new OpenAiApi(config.baseUrl(), config.apiKey(),
                RestClient.builder(), WebClient.builder());
        OpenAiChatOptions options = OpenAiChatOptions.builder()
                .withModel(config.chatModel())
                .build();
        return ChatClient.create(new OpenAiChatModel(api, options));
    }

    private AiSettingsDtos.AiSettingsView toView(TenantAiSettings settings) {
        return new AiSettingsDtos.AiSettingsView(
                settings.getProvider().name(),
                settings.getBaseUrl(),
                settings.getChatModel(),
                settings.isEnabled(),
                hasStoredApiKey(settings),
                preview(settings.getApiKeyLastFour()),
                settings.isDataAgreementInPlace(),
                true,
                settings.getUpdatedAt());
    }

    private AiSettingsDtos.AiSettingsView fallbackView() {
        return new AiSettingsDtos.AiSettingsView(
                inferProvider(fallbackBaseUrl).name(),
                fallbackBaseUrl,
                fallbackModel,
                true,
                isConfiguredKey(fallbackApiKey),
                null,
                fallbackDataAgreementInPlace,
                false,
                null);
    }

    private static AiProvider parseProvider(String value) {
        if (value == null || value.isBlank()) {
            return AiProvider.OPENAI;
        }
        try {
            return AiProvider.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Unsupported AI provider: " + value);
        }
    }

    private static void validateProviderSelection(AiProvider provider, String baseUrl, String apiKey) {
        String normalizedBaseUrl = baseUrl != null ? baseUrl.toLowerCase(Locale.ROOT) : "";
        String normalizedKey = apiKey != null ? apiKey.toLowerCase(Locale.ROOT) : "";

        if (provider == AiProvider.OPENAI && normalizedBaseUrl.contains("groq.com")) {
            throw new BadRequestException("Provider is OpenAI, but the base URL points to Groq.");
        }
        if (provider == AiProvider.GROQ && normalizedBaseUrl.contains("openai.com")) {
            throw new BadRequestException("Provider is Groq, but the base URL points to OpenAI.");
        }
        if (provider == AiProvider.GROQ && normalizedKey.startsWith("sk-")) {
            throw new BadRequestException("This looks like an OpenAI API key. Select OpenAI as the provider.");
        }
        if (provider == AiProvider.OPENAI && normalizedKey.startsWith("gsk_")) {
            throw new BadRequestException("This looks like a Groq API key. Select Groq as the provider.");
        }
    }

    private static String defaultBaseUrl(AiProvider provider) {
        return switch (provider) {
            case OPENAI -> OPENAI_BASE_URL;
            case GROQ -> GROQ_BASE_URL;
            case CUSTOM -> null;
        };
    }

    private static String defaultModel(AiProvider provider) {
        return switch (provider) {
            case OPENAI -> OPENAI_DEFAULT_MODEL;
            case GROQ -> GROQ_DEFAULT_MODEL;
            case CUSTOM -> null;
        };
    }

    private static AiProvider inferProvider(String baseUrl) {
        String normalized = baseUrl != null ? baseUrl.toLowerCase(Locale.ROOT) : "";
        if (normalized.contains("groq.com")) {
            return AiProvider.GROQ;
        }
        if (normalized.contains("openai.com")) {
            return AiProvider.OPENAI;
        }
        return AiProvider.CUSTOM;
    }

    private static boolean hasStoredApiKey(TenantAiSettings settings) {
        return settings.getEncryptedApiKey() != null && !settings.getEncryptedApiKey().isBlank();
    }

    private static boolean isConfiguredKey(String apiKey) {
        return apiKey != null
                && !apiKey.isBlank()
                && !apiKey.toLowerCase(Locale.ROOT).contains("placeholder");
    }

    private static String clean(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String lastFour(String value) {
        return value.length() <= 4 ? value : value.substring(value.length() - 4);
    }

    private static String preview(String lastFour) {
        return lastFour == null || lastFour.isBlank() ? null : "ends in " + lastFour;
    }

    private static String providerError(Exception e) {
        String message = e.getMessage();
        if (message == null || message.isBlank()) {
            return e.getClass().getSimpleName();
        }
        String redacted = message
                .replaceAll("Bearer\\s+[^\\s,;]+", "Bearer [redacted]")
                .replaceAll("sk-[A-Za-z0-9_\\-]+", "[redacted]")
                .replaceAll("gsk_[A-Za-z0-9_\\-]+", "[redacted]");
        return redacted.length() > 300 ? redacted.substring(0, 300) + "..." : redacted;
    }

    private void warnIfAgreementMissing(UUID tenantId, String baseUrl, boolean dataAgreementInPlace) {
        if (dataAgreementInPlace || isLocal(baseUrl) || !agreementWarnings.add(tenantId)) {
            return;
        }
        log.warn("""

                ============================================================================
                 AI provider for tenant {}: {}

                 Medical images, report text, lab values, and clinical notes may be sent to
                 this provider. No data agreement has been declared for this tenant.

                 Use synthetic or de-identified data until a BAA / data processing agreement is
                 signed, then mark the agreement in Settings > AI Provider.
                ============================================================================
                """, tenantId, baseUrl);
    }

    private static boolean isLocal(String url) {
        if (url == null || url.isBlank()) {
            return false;
        }
        String lower = url.toLowerCase(Locale.ROOT);
        return LOCAL_HOSTS.stream().anyMatch(host -> lower.contains("://" + host));
    }
}
