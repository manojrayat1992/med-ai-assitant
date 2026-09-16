package com.medai.qa.rules;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.medai.analysis.dto.AnalysisResultDto;
import com.medai.analysis.util.AiJsonExtractor;
import com.medai.config.AiRuntimeConfig;
import com.medai.config.TenantAiSettingsService;
import com.medai.qa.model.QaIssue;
import com.medai.qa.model.QaIssueType;
import com.medai.qa.model.QaSeverity;
import com.medai.tenant.TenantContext;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.ai.openai.api.ResponseFormat;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Multimodal QA Rule verifying Radiologist Written Draft Text against DICOM Image Vision Findings.
 *
 * <p>Detects:
 * 1. UNREPORTED_IMAGE_FINDING: High-confidence image findings omitted from report text.
 * 2. MEASUREMENT_DISCREPANCY: Dimension mismatches between DICOM scan and report text.
 * 3. IMAGE_TEXT_LOCATION_MISMATCH: Anatomical location/side discrepancies.
 */
@Component
@Slf4j
public class MultimodalQaRule {

    private static final String DETECTOR_AI = "AiMultimodalVerifier";
    private static final String DETECTOR_VERSION = "1.0.0-multimodal";

    private static final String AI_MULTIMODAL_PROMPT = """
            You are an expert clinical quality assurance AI specializing in multimodal radiology report verification.
            Cross-verify the radiologist's written draft report against the AI vision analysis of the DICOM scan.

            Draft Report Findings:
            %s

            Draft Report Impression:
            %s

            DICOM Image Vision Findings:
            %s

            Verification Task:
            1. Identify UNREPORTED_IMAGE_FINDING: Significant abnormalities (MODERATE, SEVERE, CRITICAL severity, or high confidence > 0.7) present in the DICOM image findings that are completely omitted or unaddressed in the draft report text.
            2. Identify MEASUREMENT_DISCREPANCY: Measurement differences between dimensions stated in draft report vs DICOM findings.
            3. Identify IMAGE_TEXT_LOCATION_MISMATCH: Anatomical side/location discrepancies between DICOM image finding and draft report text.

            Respond with ONLY a JSON object in this exact schema:
            {
              "discrepancies": [
                {
                  "type": "UNREPORTED_IMAGE_FINDING | MEASUREMENT_DISCREPANCY | IMAGE_TEXT_LOCATION_MISMATCH",
                  "severity": "HIGH | MEDIUM | LOW",
                  "reportExcerpt": "sentence from report if applicable, or 'OMITTED FROM REPORT'",
                  "imageFindingExcerpt": "description of finding from DICOM image analysis",
                  "anatomy": "anatomical region (e.g. LUNG, KIDNEY, FEMUR, BRAIN)",
                  "explanation": "concise clinical explanation of the discrepancy"
                }
              ]
            }
            If no discrepancy exists, return {"discrepancies": []}.
            """;

    private final TenantAiSettingsService aiSettingsService;
    private final ObjectMapper objectMapper;

    public MultimodalQaRule() {
        this(null, null);
    }

    public MultimodalQaRule(
            @Autowired(required = false) TenantAiSettingsService aiSettingsService,
            @Autowired(required = false) ObjectMapper objectMapper) {
        this.aiSettingsService = aiSettingsService;
        this.objectMapper = objectMapper != null ? objectMapper : new ObjectMapper();
    }

    public List<QaIssue> evaluate(List<String> findings, String impressionText, AnalysisResultDto imageResult) {
        String findingsText = findings != null ? String.join("\n", findings) : "";
        return evaluate(findingsText, impressionText, imageResult);
    }

    public List<QaIssue> evaluate(String findingsText, String impressionText, AnalysisResultDto imageResult) {
        if (imageResult == null || imageResult.getFindings() == null || imageResult.getFindings().isEmpty()) {
            return List.of();
        }

        UUID tenantId = TenantContext.getCurrentTenantId();
        if (aiSettingsService != null && tenantId != null) {
            try {
                List<QaIssue> aiIssues = evaluateWithAi(findingsText, impressionText, imageResult, tenantId);
                if (aiIssues != null) {
                    return aiIssues;
                }
            } catch (Exception e) {
                log.warn("AI multimodal evaluation failed for tenant {}; using fallback rule: {}",
                        tenantId, e.getMessage());
            }
        }

        return evaluateDeterministic(findingsText, impressionText, imageResult);
    }

    private List<QaIssue> evaluateWithAi(
            String findingsText, String impressionText, AnalysisResultDto imageResult, UUID tenantId) {
        AiRuntimeConfig config = aiSettingsService.resolveRuntimeConfig(tenantId);
        ChatClient chatClient = aiSettingsService.createChatClient(config);

        String imageFindingsJson;
        try {
            imageFindingsJson = objectMapper.writeValueAsString(imageResult.getFindings());
        } catch (Exception e) {
            imageFindingsJson = imageResult.getFindings().toString();
        }

        String prompt = String.format(AI_MULTIMODAL_PROMPT,
                findingsText != null ? findingsText : "None provided",
                impressionText != null ? impressionText : "None provided",
                imageFindingsJson);

        if (config.chatModel() != null && config.chatModel().toLowerCase(Locale.ROOT).contains("qwen")) {
            prompt += "\n\n/no_think";
        }

        OpenAiChatOptions jsonOptions = OpenAiChatOptions.builder()
                .withModel(config.chatModel())
                .withMaxTokens(1000)
                .withResponseFormat(ResponseFormat.builder().type(ResponseFormat.Type.JSON_OBJECT).build())
                .build();

        ChatResponse response = chatClient.prompt()
                .options(jsonOptions)
                .user(prompt)
                .call()
                .chatResponse();

        if (response == null || response.getResult() == null || response.getResult().getOutput() == null) {
            return null;
        }

        String jsonContent = AiJsonExtractor.extractJsonObject(response.getResult().getOutput().getContent());

        try {
            AiDiscrepancyResult result = objectMapper.readValue(jsonContent, AiDiscrepancyResult.class);
            if (result.discrepancies == null || result.discrepancies.isEmpty()) {
                return List.of();
            }

            List<QaIssue> issues = new ArrayList<>();
            for (int i = 0; i < result.discrepancies.size(); i++) {
                AiDiscrepancyItem item = result.discrepancies.get(i);
                QaIssueType issueType = parseIssueType(item.type);
                QaSeverity severity = parseSeverity(item.severity);

                String anatomy = item.anatomy != null && !item.anatomy.isBlank()
                        ? item.anatomy.strip().toUpperCase(Locale.ROOT)
                        : "DICOM IMAGE";

                String message = String.format("[%s] Ground-truth verification issue: %s",
                        issueType.name(),
                        item.explanation != null ? item.explanation : "Discrepancy between DICOM image findings and written report text.");

                issues.add(new QaIssue(
                        "multimodal-qa-" + (i + 1),
                        issueType,
                        severity,
                        message,
                        item.reportExcerpt != null ? item.reportExcerpt : (findingsText != null ? findingsText : "Omitted"),
                        item.imageFindingExcerpt != null ? item.imageFindingExcerpt : "DICOM image finding",
                        "REPORT_TEXT",
                        "DICOM_IMAGE",
                        null,
                        null,
                        anatomy,
                        null,
                        0.95d,
                        DETECTOR_AI,
                        DETECTOR_VERSION
                ));
            }
            return issues;
        } catch (Exception e) {
            log.warn("Failed to parse AI multimodal QA response: {}", e.getMessage());
            return null;
        }
    }

    private List<QaIssue> evaluateDeterministic(String findingsText, String impressionText, AnalysisResultDto imageResult) {
        List<QaIssue> issues = new ArrayList<>();
        String combinedReportText = ((findingsText != null ? findingsText : "") + " " + (impressionText != null ? impressionText : "")).toLowerCase(Locale.ROOT);

        int count = 1;
        for (AnalysisResultDto.Finding imageFinding : imageResult.getFindings()) {
            if (imageFinding.getRegion() == null || imageFinding.getDescription() == null) {
                continue;
            }

            String region = imageFinding.getRegion().toLowerCase(Locale.ROOT);
            String severity = imageFinding.getSeverity() != null ? imageFinding.getSeverity().toUpperCase(Locale.ROOT) : "NORMAL";

            if (("MODERATE".equals(severity) || "SEVERE".equals(severity) || "CRITICAL".equals(severity))
                    && !combinedReportText.contains(region)) {

                String message = String.format("Unreported DICOM Finding: Vision AI detected a %s severity finding in region '%s' (%s), which is unaddressed in the draft report text.",
                        severity, imageFinding.getRegion(), imageFinding.getDescription());

                issues.add(new QaIssue(
                        "multimodal-qa-fallback-" + (count++),
                        QaIssueType.UNREPORTED_IMAGE_FINDING,
                        "CRITICAL".equals(severity) || "SEVERE".equals(severity) ? QaSeverity.HIGH : QaSeverity.MEDIUM,
                        message,
                        "OMITTED FROM DRAFT REPORT",
                        imageFinding.getDescription(),
                        "REPORT_TEXT",
                        "DICOM_IMAGE",
                        null,
                        null,
                        imageFinding.getRegion().toUpperCase(Locale.ROOT),
                        null,
                        0.88d,
                        "MultimodalQaRuleFallback",
                        "1.0.0"
                ));
            }
        }
        return issues;
    }

    private QaIssueType parseIssueType(String raw) {
        if (raw == null) return QaIssueType.UNREPORTED_IMAGE_FINDING;
        String s = raw.strip().toUpperCase(Locale.ROOT);
        if (s.contains("MEASUREMENT")) return QaIssueType.MEASUREMENT_DISCREPANCY;
        if (s.contains("LOCATION") || s.contains("MISMATCH")) return QaIssueType.IMAGE_TEXT_LOCATION_MISMATCH;
        return QaIssueType.UNREPORTED_IMAGE_FINDING;
    }

    private QaSeverity parseSeverity(String raw) {
        if (raw == null) return QaSeverity.MEDIUM;
        String s = raw.strip().toUpperCase(Locale.ROOT);
        if (s.contains("HIGH") || s.contains("CRITICAL") || s.contains("SEVERE")) return QaSeverity.HIGH;
        if (s.contains("LOW")) return QaSeverity.LOW;
        return QaSeverity.MEDIUM;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record AiDiscrepancyResult(List<AiDiscrepancyItem> discrepancies) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record AiDiscrepancyItem(
            String type,
            String severity,
            String reportExcerpt,
            String imageFindingExcerpt,
            String anatomy,
            String explanation
    ) {}
}
