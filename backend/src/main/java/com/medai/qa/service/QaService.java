package com.medai.qa.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.medai.analysis.dto.AnalysisResultDto;
import com.medai.analysis.entity.AnalysisRequest;
import com.medai.analysis.repository.AnalysisRequestRepository;
import com.medai.common.exception.ResourceNotFoundException;
import com.medai.finding.extraction.ReportSectionParser;
import com.medai.finding.extraction.ReportSectionText;
import com.medai.finding.model.FindingSourceSection;
import com.medai.finding.service.FindingExtractionService;
import com.medai.qa.engine.QaEngine;
import com.medai.qa.model.QaReportText;
import com.medai.qa.model.QaResult;
import com.medai.report.entity.ReportReview;
import com.medai.report.repository.ReportReviewRepository;
import com.medai.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class QaService {

    private final ReportReviewRepository reviewRepository;
    private final AnalysisRequestRepository analysisRequestRepository;
    private final QaEngine qaEngine;
    private final ReportSectionParser sectionParser;
    private final FindingExtractionService findingExtractionService;
    private final QaEvidenceEnricher evidenceEnricher;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public QaResult evaluateReport(UUID reviewId) {
        return evaluateReport(reviewId, null);
    }

    @Transactional(readOnly = true)
    public QaResult evaluateReport(UUID reviewId, String customText) {
        UUID tenantId = TenantContext.requireTenantId();
        ReportReview review = reviewRepository.findByIdAndTenantId(reviewId, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("ReportReview", "id", reviewId.toString()));

        AnalysisResultDto imageResult = null;
        if (review.getAnalysisId() != null) {
            try {
                AnalysisRequest analysisRequest = analysisRequestRepository.findByIdAndTenantId(review.getAnalysisId(), tenantId).orElse(null);
                if (analysisRequest != null && analysisRequest.getResult() != null && !analysisRequest.getResult().isBlank()) {
                    imageResult = objectMapper.readValue(analysisRequest.getResult(), AnalysisResultDto.class);
                }
            } catch (Exception e) {
                log.warn("Failed to load or parse image analysis {} for QA evaluation: {}", review.getAnalysisId(), e.getMessage());
            }
        }

        QaResult result = qaEngine.evaluate(review.getId(), extractReportText(review, customText), imageResult);
        return evidenceEnricher.enrich(result, findingExtractionService.extract(review));
    }

    private QaReportText extractReportText(ReportReview review, String customText) {
        String source = hasText(customText) ? customText : sourceText(review);
        if (source.isBlank()) {
            return new QaReportText(List.of(), "");
        }

        List<ReportSectionText> sections = sectionParser.parse(source);
        List<String> findings = sections.stream()
                .filter(section -> section.sourceSection() == FindingSourceSection.FINDINGS)
                .map(ReportSectionText::text)
                .filter(this::hasText)
                .toList();
        String impression = sections.stream()
                .filter(section -> section.sourceSection() == FindingSourceSection.IMPRESSION)
                .map(ReportSectionText::text)
                .filter(this::hasText)
                .collect(Collectors.joining("\n"));
        return new QaReportText(findings, impression);
    }

    private String sourceText(ReportReview review) {
        if ("SIGNED".equals(review.getStatus()) && hasText(review.getFinalContent())) {
            return review.getFinalContent();
        }
        if (hasText(review.getDraftContent())) {
            return review.getDraftContent();
        }
        return hasText(review.getFinalContent()) ? review.getFinalContent() : "";
    }

    private boolean hasText(String text) {
        return text != null && !text.isBlank();
    }
}
