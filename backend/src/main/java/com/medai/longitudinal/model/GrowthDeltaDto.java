package com.medai.longitudinal.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GrowthDeltaDto {
    private String lesionName;
    private String anatomy;
    private LocalDate priorDate;
    private LocalDate currentDate;
    private Long elapsedDays;
    private Double priorMeasurementMm;
    private Double currentMeasurementMm;
    private Double linearDeltaMm;
    private Double linearPercentChange;
    private Double priorVolumeMm3;
    private Double currentVolumeMm3;
    private Double volumePercentChange;
    private Double volumeDoublingTimeDays;
    private Double growthVelocityMmPerMonth;
    private String recistCategory;
    private String recistLabel;
    private String clinicalSignificance;
    private String narrative;
}
