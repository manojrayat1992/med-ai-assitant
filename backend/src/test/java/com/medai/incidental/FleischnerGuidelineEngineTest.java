package com.medai.incidental;

import com.medai.incidental.dto.IncidentalFindingDto;
import com.medai.incidental.enums.IncidentalFollowUpStatus;
import com.medai.incidental.enums.IncidentalGuidelineSystem;
import com.medai.incidental.service.FleischnerGuidelineEngine;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class FleischnerGuidelineEngineTest {

    private FleischnerGuidelineEngine engine;

    @BeforeEach
    void setUp() {
        engine = new FleischnerGuidelineEngine();
    }

    @Test
    @DisplayName("Parses 7mm pulmonary nodule according to Fleischner 2017 Guidelines")
    void testFleischnerIntermediateNodule() {
        String report = "Lungs: An incidental 7.2 mm solid pulmonary nodule is noted in the right lower lobe. " +
                "Heart size is within normal limits. No pleural effusion.";

        List<IncidentalFindingDto> findings = engine.parseReport(report);

        assertThat(findings).isNotEmpty();
        IncidentalFindingDto finding = findings.get(0);
        assertThat(finding.getGuidelineSystem()).isEqualTo(IncidentalGuidelineSystem.FLEISCHNER);
        assertThat(finding.getTimeframeMonths()).isEqualTo(6);
        assertThat(finding.getFollowUpModality()).contains("CT Chest");
        assertThat(finding.getRecommendationText()).contains("Fleischner 2017");
        assertThat(finding.getStatus()).isEqualTo(IncidentalFollowUpStatus.PENDING_SCHEDULING);
        assertThat(finding.getEstimatedRevenueRecapture()).isGreaterThan(700.0);
    }

    @Test
    @DisplayName("Parses large >8mm pulmonary nodule requiring prompt 3-month follow-up / PET-CT")
    void testFleischnerLargeNodule() {
        String report = "Impression: Solitary 12 mm pulmonary nodule in left upper lobe, suspicious for malignancy.";

        List<IncidentalFindingDto> findings = engine.parseReport(report);

        assertThat(findings).isNotEmpty();
        IncidentalFindingDto finding = findings.get(0);
        assertThat(finding.getGuidelineSystem()).isEqualTo(IncidentalGuidelineSystem.FLEISCHNER);
        assertThat(finding.getTimeframeMonths()).isEqualTo(3);
        assertThat(finding.getRecommendationText()).contains("> 8mm");
    }

    @Test
    @DisplayName("Parses ACR TI-RADS thyroid nodule")
    void testTiRadsThyroidNodule() {
        String report = "Neck: 16 mm hypoechoic nodule in the right thyroid lobe, ACR TI-RADS 4.";

        List<IncidentalFindingDto> findings = engine.parseReport(report);

        assertThat(findings).isNotEmpty();
        IncidentalFindingDto finding = findings.get(0);
        assertThat(finding.getGuidelineSystem()).isEqualTo(IncidentalGuidelineSystem.TI_RADS);
        assertThat(finding.getRecommendationText()).contains("TI-RADS 4");
        assertThat(finding.getFollowUpModality()).contains("Thyroid");
    }

    @Test
    @DisplayName("Parses ACR BI-RADS 3 breast finding with 6-month short interval recommendation")
    void testBiRadsBreastLesion() {
        String report = "Breasts: Focal asymmetry in the right upper outer quadrant. ACR BI-RADS 3 category.";

        List<IncidentalFindingDto> findings = engine.parseReport(report);

        assertThat(findings).isNotEmpty();
        IncidentalFindingDto finding = findings.get(0);
        assertThat(finding.getGuidelineSystem()).isEqualTo(IncidentalGuidelineSystem.BI_RADS);
        assertThat(finding.getTimeframeMonths()).isEqualTo(6);
        assertThat(finding.getRecommendationText()).contains("Probably Benign");
    }

    @Test
    @DisplayName("Parses explicit clinical follow-up recommendations")
    void testExplicitGenericFollowUp() {
        String report = "Recommend follow-up MRI brain in 6 months to evaluate stability of cerebellar lesion.";

        List<IncidentalFindingDto> findings = engine.parseReport(report);

        assertThat(findings).isNotEmpty();
        IncidentalFindingDto finding = findings.get(0);
        assertThat(finding.getGuidelineSystem()).isEqualTo(IncidentalGuidelineSystem.GENERAL);
        assertThat(finding.getTimeframeMonths()).isEqualTo(6);
        assertThat(finding.getFollowUpModality()).contains("MRI");
    }
}
