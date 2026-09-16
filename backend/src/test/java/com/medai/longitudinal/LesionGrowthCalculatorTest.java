package com.medai.longitudinal;

import com.medai.longitudinal.comparison.LesionGrowthCalculator;
import com.medai.longitudinal.model.CalculateGrowthRequest;
import com.medai.longitudinal.model.GrowthDeltaDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class LesionGrowthCalculatorTest {

    private LesionGrowthCalculator calculator;

    @BeforeEach
    void setUp() {
        calculator = new LesionGrowthCalculator();
    }

    @Test
    @DisplayName("Calculates growth from 8mm to 14mm (+75% diameter, +436% volume, Progressive Disease)")
    void testAdrenalLesionGrowth() {
        CalculateGrowthRequest request = CalculateGrowthRequest.builder()
                .lesionName("Right adrenal lesion")
                .anatomy("Adrenal Gland")
                .priorMeasurementMm(8.0)
                .currentMeasurementMm(14.0)
                .priorDate(LocalDate.of(2024, 5, 10))
                .currentDate(LocalDate.of(2024, 9, 15))
                .build();

        GrowthDeltaDto result = calculator.calculate(request);

        assertThat(result).isNotNull();
        assertThat(result.getPriorMeasurementMm()).isEqualTo(8.0);
        assertThat(result.getCurrentMeasurementMm()).isEqualTo(14.0);
        assertThat(result.getLinearDeltaMm()).isEqualTo(6.0);
        assertThat(result.getLinearPercentChange()).isEqualTo(75.0);
        assertThat(result.getVolumePercentChange()).isGreaterThan(430.0);
        assertThat(result.getRecistCategory()).isEqualTo("PROGRESSIVE_DISEASE");
        assertThat(result.getRecistLabel()).contains("Progressive Disease");
        assertThat(result.getVolumeDoublingTimeDays()).isNotNull();
        assertThat(result.getVolumeDoublingTimeDays()).isLessThan(100.0);
        assertThat(result.getNarrative()).contains("Right adrenal lesion has grown from 8.0 mm");
        assertThat(result.getNarrative()).contains("+75% diameter");
    }

    @Test
    @DisplayName("Calculates tumor regression for Partial Response (>30% reduction)")
    void testPartialResponse() {
        CalculateGrowthRequest request = CalculateGrowthRequest.builder()
                .lesionName("Hepatic metastasis")
                .priorMeasurementMm(20.0)
                .currentMeasurementMm(12.0)
                .priorDate(LocalDate.now().minusMonths(3))
                .currentDate(LocalDate.now())
                .build();

        GrowthDeltaDto result = calculator.calculate(request);

        assertThat(result.getLinearPercentChange()).isEqualTo(-40.0);
        assertThat(result.getRecistCategory()).isEqualTo("PARTIAL_RESPONSE");
        assertThat(result.getRecistLabel()).contains("Partial Response");
        assertThat(result.getNarrative()).contains("decreased");
    }

    @Test
    @DisplayName("Calculates stable disease when change is minimal")
    void testStableDisease() {
        CalculateGrowthRequest request = CalculateGrowthRequest.builder()
                .lesionName("Thyroid nodule")
                .priorMeasurementMm(12.0)
                .currentMeasurementMm(12.5)
                .priorDate(LocalDate.now().minusMonths(6))
                .currentDate(LocalDate.now())
                .build();

        GrowthDeltaDto result = calculator.calculate(request);

        assertThat(result.getRecistCategory()).isEqualTo("STABLE_DISEASE");
        assertThat(result.getRecistLabel()).contains("Stable Disease");
    }
}
