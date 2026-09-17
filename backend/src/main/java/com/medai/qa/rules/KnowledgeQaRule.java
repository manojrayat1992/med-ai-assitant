package com.medai.qa.rules;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.medai.analysis.util.AiJsonExtractor;
import com.medai.config.TenantAiSettingsService;
import com.medai.knowledge.service.ClinicalKnowledgeService;
import com.medai.qa.model.*;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.ai.openai.api.ResponseFormat;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** Reference-grounded checks in addition to deterministic report consistency checks. */
@Component
@RequiredArgsConstructor
public class KnowledgeQaRule {
    private final ClinicalKnowledgeService knowledge;
    private final TenantAiSettingsService aiSettings;
    private final ObjectMapper mapper;

    public List<QaIssue> evaluate(UUID tenantId, String report) {
        if (report == null || report.isBlank()) return List.of();
        var passages = knowledge.retrieve(tenantId, report);
        if (passages.isEmpty()) return List.of();
        var config = aiSettings.resolveRuntimeConfig(tenantId);
        String prompt = """
                Check the supplied report against the retrieved workspace reference passages.
                Only flag explicit, applicable contradictions supported by BOTH an exact report quote
                and an exact reference quote. Do not infer undocumented patient facts. Do not treat
                reference examples as patient findings. Do not flag absence of a topic as a contradiction.
                Return JSON only: {"issues":[{"reference":1,"reportQuote":"exact quote",
                "referenceQuote":"exact quote","explanation":"why this needs clinician review"}]}.
                Use the numbered references provided. If none applies, return {"issues":[]}.
                REPORT TO REVIEW:
                """ + report + knowledge.format(passages);
        String response = aiSettings.createChatClient(config).prompt()
                .system(ClinicalKnowledgeService.REFERENCE_POLICY)
                .options(OpenAiChatOptions.builder().withModel(config.chatModel()).withMaxTokens(1600)
                        .withResponseFormat(ResponseFormat.builder().type(ResponseFormat.Type.JSON_OBJECT).build()).build())
                .user(prompt).call().content();
        try {
            var items = mapper.readTree(AiJsonExtractor.extractJsonObject(response)).get("issues");
            if (items == null || !items.isArray()) throw new IllegalArgumentException("Missing knowledge QA issues array");
            List<QaIssue> issues = new ArrayList<>();
            for (var item : items) {
                int index = item.path("reference").asInt(0) - 1;
                String reportQuote = item.path("reportQuote").asText("");
                String referenceQuote = item.path("referenceQuote").asText("");
                String explanation = item.path("explanation").asText("");
                if (index < 0 || index >= passages.size() || reportQuote.isBlank() || referenceQuote.isBlank()
                        || explanation.isBlank() || !report.contains(reportQuote)
                        || !passages.get(index).text().contains(referenceQuote)) continue;
                var source = passages.get(index);
                issues.add(new QaIssue("knowledge-" + source.documentId() + "-" + source.chunk() + "-" + issues.size(),
                        QaIssueType.PROTOCOL_DEVIATION, QaSeverity.MEDIUM,
                        explanation + " Source: " + source.title() + " (" + source.documentId() + ", chunk " + source.chunk() + ").",
                        reportQuote, referenceQuote, "REPORT", "KNOWLEDGE_BASE", null, null, null, null,
                        0.0, "KnowledgeReferenceReview", "1.0.0"));
                if (issues.size() >= 6) break;
            }
            return issues;
        } catch (Exception e) {
            // Do not present an unavailable reference check as a successful clean evaluation.
            throw new IllegalStateException("Knowledge-base QA could not be completed. Please retry.", e);
        }
    }
}
