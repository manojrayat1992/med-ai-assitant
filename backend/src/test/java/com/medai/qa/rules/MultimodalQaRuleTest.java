package com.medai.qa.rules;

import com.medai.analysis.dto.AnalysisResultDto;
import com.medai.qa.model.QaIssue;
import com.medai.qa.model.QaIssueType;
import com.medai.qa.model.QaSeverity;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class MultimodalQaRuleTest {

    private final MultimodalQaRule rule = new MultimodalQaRule();

    @Test
    @DisplayName("returns empty list when image analysis result is null or has no findings")
    void returnsEmptyWhenAnalysisResultIsNull() {
        List<QaIssue> issues = rule.evaluate("No acute cardiopulmonary disease.", "Normal chest radiograph.", null);
        assertThat(issues).isEmpty();

        AnalysisResultDto emptyResult = new AnalysisResultDto();
        emptyResult.setFindings(List.of());
        issues = rule.evaluate("No acute cardiopulmonary disease.", "Normal chest radiograph.", emptyResult);
        assertThat(issues).isEmpty();
    }

    @Test
    @DisplayName("flags unreported severe finding in fallback deterministic mode when report omits region")
    void flagsUnreportedSevereFinding() {
        AnalysisResultDto imageResult = new AnalysisResultDto();
        AnalysisResultDto.Finding item = new AnalysisResultDto.Finding();
        item.setRegion("right lower lung");
        item.setSeverity("SEVERE");
        item.setDescription("1.5cm pulmonary nodule in the right lower lung");
        item.setConfidence(0.92d);
        imageResult.setFindings(List.of(item));

        String findingsText = "Clear lung fields bilaterally. No pleural effusion or pneumothorax.";
        String impressionText = "Unremarkable chest X-ray.";

        List<QaIssue> issues = rule.evaluate(findingsText, impressionText, imageResult);

        assertThat(issues).hasSize(1);
        QaIssue issue = issues.getFirst();
        assertThat(issue.type()).isEqualTo(QaIssueType.UNREPORTED_IMAGE_FINDING);
        assertThat(issue.severity()).isEqualTo(QaSeverity.HIGH);
        assertThat(issue.anatomyCode()).contains("RIGHT LOWER LUNG");
        assertThat(issue.message()).contains("Unreported DICOM Finding");
    }

    @Test
    @DisplayName("does not flag finding when report text explicitly mentions the anatomical region")
    void ignoresReportedRegion() {
        AnalysisResultDto imageResult = new AnalysisResultDto();
        AnalysisResultDto.Finding item = new AnalysisResultDto.Finding();
        item.setRegion("right lower lung");
        item.setSeverity("MODERATE");
        item.setDescription("Subtle focal opacity right lower lung");
        item.setConfidence(0.85d);
        imageResult.setFindings(List.of(item));

        String findingsText = "Subtle focal opacity in the right lower lung.";
        String impressionText = "Possible right lower lung infiltrate.";

        List<QaIssue> issues = rule.evaluate(findingsText, impressionText, imageResult);

        assertThat(issues).isEmpty();
    }
}
