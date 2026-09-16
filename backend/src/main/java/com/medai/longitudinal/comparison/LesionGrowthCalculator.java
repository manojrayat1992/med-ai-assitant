package com.medai.longitudinal.comparison;

import com.medai.longitudinal.model.CalculateGrowthRequest;
import com.medai.longitudinal.model.GrowthDeltaDto;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Locale;

/**
 * Mathematical and clinical growth engine for longitudinal lesion tracking.
 * Implements Schwartz tumor volume doubling time and RECIST 1.1 criteria.
 */
@Component
public class LesionGrowthCalculator {

    private static final double SPHERE_VOLUME_FACTOR = Math.PI / 6.0; // 0.5235987756

    public GrowthDeltaDto calculate(CalculateGrowthRequest request) {
        return calculate(
                request.getLesionName(),
                request.getAnatomy(),
                request.getPriorMeasurementMm(),
                request.getCurrentMeasurementMm(),
                request.getPriorDate(),
                request.getCurrentDate()
        );
    }

    public GrowthDeltaDto calculate(
            String lesionName,
            String anatomy,
            double priorMm,
            double currentMm,
            LocalDate priorDate,
            LocalDate currentDate
    ) {
        if (lesionName == null || lesionName.isBlank()) {
            lesionName = anatomy != null && !anatomy.isBlank() ? anatomy + " lesion" : "Target lesion";
        }
        if (priorDate == null) {
            priorDate = LocalDate.now().minusMonths(4);
        }
        if (currentDate == null) {
            currentDate = LocalDate.now();
        }

        long elapsedDays = Math.max(1, ChronoUnit.DAYS.between(priorDate, currentDate));

        // 1. Linear Diameter Delta
        double linearDelta = currentMm - priorMm;
        double linearPercent = (linearDelta / priorMm) * 100.0;

        // 2. Volumetric Approximations (Spherical: V = pi/6 * d^3)
        double priorVolume = SPHERE_VOLUME_FACTOR * Math.pow(priorMm, 3);
        double currentVolume = SPHERE_VOLUME_FACTOR * Math.pow(currentMm, 3);
        double volumePercent = ((currentVolume - priorVolume) / priorVolume) * 100.0;

        // 3. Tumor Volume Doubling Time (Schwartz formula: VDT = T * ln(2) / ln(V2/V1))
        Double doublingTimeDays = null;
        if (currentMm > priorMm) {
            double vRatio = currentVolume / priorVolume;
            if (vRatio > 1.0) {
                doublingTimeDays = (elapsedDays * Math.log(2.0)) / Math.log(vRatio);
            }
        } else if (currentMm < priorMm) {
            // Halving time
            double vRatio = currentVolume / priorVolume;
            if (vRatio > 0.0) {
                doublingTimeDays = (elapsedDays * Math.log(0.5)) / Math.log(vRatio);
            }
        }

        // 4. Growth Velocity (mm per 30-day month)
        double velocityMmMonth = (linearDelta / elapsedDays) * 30.4375;

        // 5. RECIST 1.1 Classification
        String recistCategory;
        String recistLabel;
        if (currentMm <= 0.0) {
            recistCategory = "COMPLETE_RESPONSE";
            recistLabel = "Complete Response (CR)";
        } else if (linearPercent <= -30.0) {
            recistCategory = "PARTIAL_RESPONSE";
            recistLabel = "Partial Response (PR)";
        } else if (linearPercent >= 20.0 && linearDelta >= 5.0) {
            recistCategory = "PROGRESSIVE_DISEASE";
            recistLabel = "Progressive Disease (PD)";
        } else {
            recistCategory = "STABLE_DISEASE";
            recistLabel = "Stable Disease (SD)";
        }

        // 6. Clinical Significance
        String significance;
        if (doublingTimeDays != null && doublingTimeDays > 0 && doublingTimeDays < 400.0) {
            significance = "RAPID_GROWTH";
        } else if (linearDelta > 0.0) {
            significance = "INDOLENT_GROWTH";
        } else if (linearDelta < 0.0) {
            significance = "REGRESSION";
        } else {
            significance = "STABLE";
        }

        // 7. Generate Radiologist Narrative Sentence
        String narrative = generateNarrative(
                lesionName,
                priorMm,
                currentMm,
                priorDate,
                linearPercent,
                volumePercent,
                doublingTimeDays,
                recistLabel
        );

        return GrowthDeltaDto.builder()
                .lesionName(lesionName)
                .anatomy(anatomy)
                .priorDate(priorDate)
                .currentDate(currentDate)
                .elapsedDays(elapsedDays)
                .priorMeasurementMm(round1(priorMm))
                .currentMeasurementMm(round1(currentMm))
                .linearDeltaMm(round1(linearDelta))
                .linearPercentChange(round1(linearPercent))
                .priorVolumeMm3(round1(priorVolume))
                .currentVolumeMm3(round1(currentVolume))
                .volumePercentChange(round1(volumePercent))
                .volumeDoublingTimeDays(doublingTimeDays != null ? round1(doublingTimeDays) : null)
                .growthVelocityMmPerMonth(round2(velocityMmMonth))
                .recistCategory(recistCategory)
                .recistLabel(recistLabel)
                .clinicalSignificance(significance)
                .narrative(narrative)
                .build();
    }

    private String generateNarrative(
            String lesionName,
            double priorMm,
            double currentMm,
            LocalDate priorDate,
            double linearPercent,
            double volumePercent,
            Double doublingTimeDays,
            String recistLabel
    ) {
        String capitalizedLesion = Character.toUpperCase(lesionName.charAt(0)) + lesionName.substring(1);
        String direction = currentMm > priorMm ? "grown" : currentMm < priorMm ? "decreased" : "remained stable";

        if (currentMm > priorMm) {
            String vdtClause = doublingTimeDays != null
                    ? String.format(Locale.ROOT, " Tumor volume doubling time is %.0f days.", doublingTimeDays)
                    : "";

            return String.format(
                    Locale.ROOT,
                    "%s has %s from %.1f mm (%s) to %.1f mm today (+%.0f%% diameter, +%.0f%% volume).%s RECIST 1.1 category: %s.",
                    capitalizedLesion,
                    direction,
                    priorMm,
                    priorDate.toString(),
                    currentMm,
                    linearPercent,
                    volumePercent,
                    vdtClause,
                    recistLabel
            );
        } else if (currentMm < priorMm) {
            return String.format(
                    Locale.ROOT,
                    "%s has %s from %.1f mm (%s) to %.1f mm today (%.0f%% diameter regression). RECIST 1.1 category: %s.",
                    capitalizedLesion,
                    direction,
                    priorMm,
                    priorDate.toString(),
                    currentMm,
                    linearPercent,
                    recistLabel
            );
        } else {
            return String.format(
                    Locale.ROOT,
                    "%s is stable at %.1f mm, unchanged compared to prior examination dated %s. RECIST 1.1 category: %s.",
                    capitalizedLesion,
                    currentMm,
                    priorDate.toString(),
                    recistLabel
            );
        }
    }

    private double round1(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

    private double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
