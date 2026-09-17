package com.medai.qa.rules;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.medai.config.*;
import com.medai.knowledge.service.ClinicalKnowledgeService;
import com.medai.qa.model.QaIssueType;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.client.ChatClient;
import java.util.List;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class KnowledgeQaRuleTest {
    private final ClinicalKnowledgeService knowledge = mock(ClinicalKnowledgeService.class);
    private final TenantAiSettingsService settings = mock(TenantAiSettingsService.class);
    private final KnowledgeQaRule rule = new KnowledgeQaRule(knowledge, settings, new ObjectMapper());
    private final UUID tenant = UUID.randomUUID();
    private final String report = "Use unrestricted reporting.";

    @Test void skipsModelWhenNoRelevantReferencesExist() {
        when(knowledge.retrieve(tenant, report)).thenReturn(List.of());
        assertThat(rule.evaluate(tenant, report)).isEmpty();
        verifyNoInteractions(settings);
    }
    @Test void requiresVerbatimEvidenceAndReturnsReferenceAttribution() {
        setup("""
                {"issues":[
                {"reference":1,"reportQuote":"Use unrestricted reporting.","referenceQuote":"Require review.","explanation":"Review required"},
                {"reference":1,"reportQuote":"Invented quote","referenceQuote":"Require review.","explanation":"Invalid"},
                {"reference":7,"reportQuote":"Use unrestricted reporting.","referenceQuote":"Require review.","explanation":"Invalid"}]}
                """);
        var result = rule.evaluate(tenant, report);
        assertThat(result).hasSize(1);
        assertThat(result.getFirst().type()).isEqualTo(QaIssueType.PROTOCOL_DEVIATION);
        assertThat(result.getFirst().message()).contains("Source: Reporting policy");
        assertThat(result.getFirst().impressionText()).isEqualTo("Require review.");
    }
    @Test void malformedResponseDoesNotBecomeCleanQa() {
        setup("{\"invalid\":true}");
        assertThatThrownBy(() -> rule.evaluate(tenant, report)).isInstanceOf(IllegalStateException.class);
    }
    private void setup(String response) {
        var passages = List.of(new ClinicalKnowledgeService.Passage(UUID.randomUUID(), "Reporting policy", "GUARDRAIL",1,"Require review.",.9));
        when(knowledge.retrieve(tenant, report)).thenReturn(passages);
        when(knowledge.format(passages)).thenReturn("references");
        var config = new AiRuntimeConfig(AiProvider.OPENAI,"unused","unused","test-model",false,false);
        when(settings.resolveRuntimeConfig(tenant)).thenReturn(config);
        ChatClient client = mock(ChatClient.class, RETURNS_DEEP_STUBS);
        when(settings.createChatClient(config)).thenReturn(client);
        when(client.prompt().system(anyString()).options(any()).user(anyString()).call().content()).thenReturn(response);
    }
}
