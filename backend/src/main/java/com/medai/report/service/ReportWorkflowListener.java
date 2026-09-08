package com.medai.report.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.medai.analysis.entity.AnalysisRequest;
import com.medai.notification.event.AnalysisCompletedEvent;
import com.medai.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Puts a completed analysis onto the reading worklist, and pages the ward if it is critical.
 *
 * <p>Hangs off the existing completion event rather than being called from the analysis services,
 * for the same reason the notification listener does: the analysis path should not know that a
 * sign-off workflow exists. Adding a review and an escalation to three services would have meant
 * three places to forget it.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ReportWorkflowListener {

    private final ReportSignOffService signOffService;
    private final CriticalResultService criticalResultService;
    private final ObjectMapper objectMapper;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onAnalysisCompleted(AnalysisCompletedEvent event) {
        AnalysisRequest analysis = event.getAnalysisRequest();
        if (analysis == null || !event.isSuccess()) {
            return;
        }

        // The event is handled on a pool thread, where the caller's ThreadLocal does not exist —
        // and every table touched below is behind forced row-level security.
        TenantContext.setCurrentTenantId(analysis.getTenantId());
        try {
            signOffService.openReview(analysis.getTenantId(), analysis.getId());

            criticalResultService.raiseIfCritical(
                    analysis.getTenantId(),
                    analysis.getId(),
                    analysis.getUrgency(),
                    summaryOf(analysis));

        } catch (Exception e) {
            // A failure here must not lose the analysis, but it does mean a report is not on
            // anyone's worklist — or worse, a critical finding was not raised. Loud.
            log.error("Could not open the review workflow for analysis {} in tenant {}",
                    analysis.getId(), analysis.getTenantId(), e);
        } finally {
            TenantContext.clear();
        }
    }

    /** The model's summary, which is what a clinician needs to see on urgent notifications. */
    private String summaryOf(AnalysisRequest analysis) {
        if (analysis.getResult() == null || analysis.getResult().isBlank()) {
            return null;
        }
        try {
            JsonNode result = objectMapper.readTree(analysis.getResult());
            String summary = firstText(result,
                    "impression",
                    "overall_impression",
                    "interpretation",
                    "overallAssessment",
                    "clinicalCorrelation");
            if (summary != null) {
                return summary;
            }

            JsonNode criticalFindings = result.get("criticalFindings");
            if (criticalFindings != null && criticalFindings.isArray() && !criticalFindings.isEmpty()) {
                String finding = criticalFindings.get(0).asText();
                return finding.isBlank() ? null : finding;
            }
        } catch (Exception e) {
            return null;
        }
        return null;
    }

    private static String firstText(JsonNode node, String... fieldNames) {
        for (String fieldName : fieldNames) {
            JsonNode value = node.get(fieldName);
            if (value != null && value.isTextual() && !value.asText().isBlank()) {
                return value.asText();
            }
        }
        return null;
    }
}
