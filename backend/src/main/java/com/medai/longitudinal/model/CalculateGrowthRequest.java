package com.medai.longitudinal.model;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CalculateGrowthRequest {
    private String lesionName;
    private String anatomy;

    @NotNull(message = "priorMeasurementMm is required")
    @Positive(message = "priorMeasurementMm must be positive")
    private Double priorMeasurementMm;

    @NotNull(message = "currentMeasurementMm is required")
    @Positive(message = "currentMeasurementMm must be positive")
    private Double currentMeasurementMm;

    private LocalDate priorDate;
    private LocalDate currentDate;
}
