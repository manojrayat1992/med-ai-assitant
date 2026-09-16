package com.medai.incidental.service;

import com.medai.incidental.dto.IncidentalFindingDto;
import com.medai.incidental.enums.IncidentalFollowUpStatus;
import com.medai.incidental.enums.IncidentalGuidelineSystem;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Clinical Guideline Engine for Incidental Findings.
 * Automatically parses radiology report narrative and categorizes findings according to:
 * - Fleischner Society 2017 Guidelines for Pulmonary Nodules
 * - ACR TI-RADS for Thyroid Nodules
 * - ACR BI-RADS for Breast Lesions
 * - Lung-RADS for Lung Screening
 * - General Evidence-Based Radiologic Follow-up Recommendations
 */
@Slf4j
@Service
public class FleischnerGuidelineEngine {

    // Nodule regex patterns
    private static final Pattern NODULE_SIZE_PATTERN = Pattern.compile(
            "(?i)(?:lung|pulmonary)?\\s*nodule[s]?\\s*(?:measuring|of)?\\s*(\\d+(?:\\.\\d+)?)\\s*(mm|cm)",
            Pattern.CASE_INSENSITIVE);

    private static final Pattern SIZE_THEN_NODULE_PATTERN = Pattern.compile(
            "(?i)(\\d+(?:\\.\\d+)?)\\s*(mm|cm)\\s*(?:solid|subsolid|ground[- ]glass)?\\s*(?:pulmonary|lung)?\\s*nodule",
            Pattern.CASE_INSENSITIVE);

    private static final Pattern THYROID_TIRADS_PATTERN = Pattern.compile(
            "(?i)(?:ti[- ]?rads|tirads)\\s*(?:category\\s*)?([1-5])",
            Pattern.CASE_INSENSITIVE);

    private static final Pattern THYROID_NODULE_SIZE_PATTERN = Pattern.compile(
            "(?i)thyroid\\s*(?:nodule|lesion|mass)\\s*(?:measuring|of)?\\s*(\\d+(?:\\.\\d+)?)\\s*(mm|cm)",
            Pattern.CASE_INSENSITIVE);

    private static final Pattern BIRADS_PATTERN = Pattern.compile(
            "(?i)(?:bi[- ]?rads|birads)\\s*(?:category\\s*)?([0-6])",
            Pattern.CASE_INSENSITIVE);

    private static final Pattern LUNGRADS_PATTERN = Pattern.compile(
            "(?i)(?:lung[- ]?rads|lungrads)\\s*(?:category\\s*)?(1|2|3|4[abcx]?)",
            Pattern.CASE_INSENSITIVE);

    private static final Pattern EXPLICIT_FOLLOWUP_PATTERN = Pattern.compile(
            "(?i)recommend(?:ed|s)?\\s*(?:follow[- ]up|repeat)?\\s*([a-z0-9\\s/\\-]+?)\\s*(?:in|after|at)\\s*(\\d+)\\s*(month|year|wk|week)s?",
            Pattern.CASE_INSENSITIVE);

    /**
     * Parses the clinical report text and returns detected incidental findings mapped to clinical guidelines.
     */
    public List<IncidentalFindingDto> parseReport(String reportText) {
        if (reportText == null || reportText.isBlank()) {
            return List.of();
        }

        List<IncidentalFindingDto> findings = new ArrayList<>();
        String[] sentences = reportText.split("(?<=[.!?])\\s+");

        for (String sentence : sentences) {
            String trimmed = sentence.trim();
            if (trimmed.isBlank()) continue;

            // 1. Evaluate Fleischner Criteria (Pulmonary Nodules)
            IncidentalFindingDto fleischnerFinding = evaluateFleischner(trimmed, reportText);
            if (fleischnerFinding != null) {
                findings.add(fleischnerFinding);
                continue;
            }

            // 2. Evaluate ACR TI-RADS (Thyroid Nodules)
            IncidentalFindingDto tiRadsFinding = evaluateTiRads(trimmed, reportText);
            if (tiRadsFinding != null) {
                findings.add(tiRadsFinding);
                continue;
            }

            // 3. Evaluate ACR BI-RADS (Breast Findings)
            IncidentalFindingDto biRadsFinding = evaluateBiRads(trimmed, reportText);
            if (biRadsFinding != null) {
                findings.add(biRadsFinding);
                continue;
            }

            // 4. Evaluate Lung-RADS (Lung Screening)
            IncidentalFindingDto lungRadsFinding = evaluateLungRads(trimmed, reportText);
            if (lungRadsFinding != null) {
                findings.add(lungRadsFinding);
                continue;
            }

            // 5. Evaluate Explicit Generic Follow-Up Recommendations
            IncidentalFindingDto genericFinding = evaluateExplicitFollowUp(trimmed);
            if (genericFinding != null) {
                findings.add(genericFinding);
            }
        }

        log.debug("Extracted {} incidental follow-up findings from report", findings.size());
        return findings;
    }

    /**
     * Evaluates Fleischner 2017 Society Guidelines for Pulmonary Nodules.
     */
    public IncidentalFindingDto evaluateFleischner(String sentence, String fullReport) {
        Double sizeMm = extractNoduleSizeMm(sentence);
        if (sizeMm == null) {
            return null;
        }

        String lowerSentence = sentence.toLowerCase(Locale.ROOT);
        boolean isSubsolid = lowerSentence.contains("subsolid") || lowerSentence.contains("ground glass") || lowerSentence.contains("ground-glass") || lowerSentence.contains("ggn");
        boolean isMultiple = lowerSentence.contains("multiple") || lowerSentence.contains("innumerable") || lowerSentence.contains("several nodules");

        int timeframeMonths;
        String recommendation;
        String modality = "CT Chest Low Dose without IV Contrast";
        double revenue = 780.0;

        if (isSubsolid) {
            if (sizeMm < 6.0) {
                timeframeMonths = 12;
                recommendation = String.format(Locale.ROOT,
                        "Fleischner 2017: Subsolid/ground-glass nodule (%.1f mm < 6mm). Routine follow-up optional unless persistent or clinical concern.", sizeMm);
            } else {
                timeframeMonths = 6;
                recommendation = String.format(Locale.ROOT,
                        "Fleischner 2017: Subsolid nodule (%.1f mm >= 6mm). Follow-up CT at 3-6 months to confirm persistence, then every 2 years for 5 years.", sizeMm);
            }
        } else if (isMultiple) {
            if (sizeMm < 6.0) {
                timeframeMonths = 12;
                recommendation = String.format(Locale.ROOT,
                        "Fleischner 2017: Multiple solid nodules (largest %.1f mm < 6mm). Optional CT at 12 months based on high-risk clinical features.", sizeMm);
            } else {
                timeframeMonths = 4;
                recommendation = String.format(Locale.ROOT,
                        "Fleischner 2017: Multiple solid nodules (largest %.1f mm >= 6mm). Follow-up CT at 3-6 months, then at 18-24 months if stable.", sizeMm);
                modality = "CT Chest with IV Contrast";
                revenue = 890.0;
            }
        } else {
            // Solitary Solid Nodule
            if (sizeMm < 6.0) {
                timeframeMonths = 12;
                recommendation = String.format(Locale.ROOT,
                        "Fleischner 2017: Solid nodule (%.1f mm < 6mm). In high-risk patients, optional follow-up CT at 12 months.", sizeMm);
            } else if (sizeMm <= 8.0) {
                timeframeMonths = 6;
                recommendation = String.format(Locale.ROOT,
                        "Fleischner 2017: Solid nodule (%.1f mm). Follow-up CT at 6-12 months; consider repeat CT at 18-24 months.", sizeMm);
            } else {
                timeframeMonths = 3;
                recommendation = String.format(Locale.ROOT,
                        "Fleischner 2017: Solid nodule (%.1f mm > 8mm). Consider CT at 3 months, PET/CT, or tissue biopsy.", sizeMm);
                modality = "CT Chest with Contrast / PET-CT";
                revenue = 1250.0;
            }
        }

        LocalDate dueDate = LocalDate.now().plusMonths(timeframeMonths);

        return IncidentalFindingDto.builder()
                .findingText(sentence)
                .guidelineSystem(IncidentalGuidelineSystem.FLEISCHNER)
                .recommendationText(recommendation)
                .timeframeMonths(timeframeMonths)
                .dueDate(dueDate)
                .status(IncidentalFollowUpStatus.PENDING_SCHEDULING)
                .followUpModality(modality)
                .estimatedRevenueRecapture(revenue)
                .build();
    }

    /**
     * Evaluates ACR TI-RADS for Thyroid Nodules.
     */
    public IncidentalFindingDto evaluateTiRads(String sentence, String fullReport) {
        Matcher trMatcher = THYROID_TIRADS_PATTERN.matcher(sentence);
        Double sizeMm = extractThyroidSizeMm(sentence);

        if (!trMatcher.find() && sizeMm == null) {
            return null;
        }

        int tiradsScore = 3; // default moderate if thyroid nodule detected
        if (trMatcher.find(0)) {
            try {
                tiradsScore = Integer.parseInt(trMatcher.group(1));
            } catch (NumberFormatException ignored) {}
        }

        int timeframeMonths = 12;
        String modality = "Ultrasound Neck / Thyroid";
        double revenue = 450.0;
        String recommendation;

        switch (tiradsScore) {
            case 1, 2 -> {
                timeframeMonths = 24;
                recommendation = "ACR TI-RADS 1/2 (Benign/Not Suspicious): No FNA or routine follow-up indicated unless clinical change.";
            }
            case 3 -> {
                timeframeMonths = 12;
                recommendation = (sizeMm != null && sizeMm >= 25.0)
                        ? "ACR TI-RADS 3 (Mildly Suspicious, >=2.5cm): Recommend fine needle aspiration (FNA) biopsy."
                        : "ACR TI-RADS 3 (Mildly Suspicious): Follow-up ultrasound in 12 months if >=1.5cm.";
                if (sizeMm != null && sizeMm >= 25.0) {
                    modality = "Ultrasound-guided Thyroid FNA Biopsy";
                    revenue = 980.0;
                }
            }
            case 4 -> {
                timeframeMonths = 12;
                recommendation = (sizeMm != null && sizeMm >= 15.0)
                        ? "ACR TI-RADS 4 (Moderately Suspicious, >=1.5cm): Recommend fine needle aspiration (FNA) biopsy."
                        : "ACR TI-RADS 4 (Moderately Suspicious): Follow-up ultrasound at 1, 2, 3, and 5 years.";
                if (sizeMm != null && sizeMm >= 15.0) {
                    modality = "Ultrasound-guided Thyroid FNA Biopsy";
                    revenue = 980.0;
                }
            }
            case 5 -> {
                timeframeMonths = 6;
                recommendation = (sizeMm != null && sizeMm >= 10.0)
                        ? "ACR TI-RADS 5 (Highly Suspicious, >=1.0cm): Recommend urgent FNA biopsy."
                        : "ACR TI-RADS 5 (Highly Suspicious): Annual ultrasound follow-up for 5 years if <1.0cm.";
                modality = "Ultrasound-guided Thyroid FNA Biopsy";
                revenue = 1150.0;
            }
            default -> {
                recommendation = "ACR TI-RADS Evaluation: Follow-up thyroid ultrasound in 12 months.";
            }
        }

        return IncidentalFindingDto.builder()
                .findingText(sentence)
                .guidelineSystem(IncidentalGuidelineSystem.TI_RADS)
                .recommendationText(recommendation)
                .timeframeMonths(timeframeMonths)
                .dueDate(LocalDate.now().plusMonths(timeframeMonths))
                .status(IncidentalFollowUpStatus.PENDING_SCHEDULING)
                .followUpModality(modality)
                .estimatedRevenueRecapture(revenue)
                .build();
    }

    /**
     * Evaluates ACR BI-RADS for Breast Lesions.
     */
    public IncidentalFindingDto evaluateBiRads(String sentence, String fullReport) {
        Matcher biMatcher = BIRADS_PATTERN.matcher(sentence);
        if (!biMatcher.find()) {
            return null;
        }

        int score = 3;
        try {
            score = Integer.parseInt(biMatcher.group(1));
        } catch (NumberFormatException ignored) {}

        int timeframeMonths;
        String recommendation;
        String modality;
        double revenue;

        switch (score) {
            case 0 -> {
                timeframeMonths = 1;
                recommendation = "ACR BI-RADS 0 (Incomplete): Prompt additional diagnostic imaging (diagnostic mammography and targeted breast ultrasound).";
                modality = "Diagnostic Mammography & Breast Ultrasound";
                revenue = 620.0;
            }
            case 3 -> {
                timeframeMonths = 6;
                recommendation = "ACR BI-RADS 3 (Probably Benign): Short-interval follow-up diagnostic imaging in 6 months.";
                modality = "Diagnostic Mammography / Breast Ultrasound";
                revenue = 620.0;
            }
            case 4 -> {
                timeframeMonths = 1;
                recommendation = "ACR BI-RADS 4 (Suspicious): Tissue biopsy recommended (core needle biopsy).";
                modality = "Image-guided Core Needle Breast Biopsy";
                revenue = 1850.0;
            }
            case 5 -> {
                timeframeMonths = 1;
                recommendation = "ACR BI-RADS 5 (Highly Suggestive of Malignancy): Urgent tissue sampling and surgical oncologic consultation.";
                modality = "Core Needle Biopsy & Oncologic Consult";
                revenue = 2400.0;
            }
            default -> {
                timeframeMonths = 12;
                recommendation = "ACR BI-RADS Routine Annual Screening Mammography.";
                modality = "Screening Mammography";
                revenue = 350.0;
            }
        }

        return IncidentalFindingDto.builder()
                .findingText(sentence)
                .guidelineSystem(IncidentalGuidelineSystem.BI_RADS)
                .recommendationText(recommendation)
                .timeframeMonths(timeframeMonths)
                .dueDate(LocalDate.now().plusMonths(timeframeMonths))
                .status(IncidentalFollowUpStatus.PENDING_SCHEDULING)
                .followUpModality(modality)
                .estimatedRevenueRecapture(revenue)
                .build();
    }

    /**
     * Evaluates Lung-RADS for Screening Studies.
     */
    public IncidentalFindingDto evaluateLungRads(String sentence, String fullReport) {
        Matcher matcher = LUNGRADS_PATTERN.matcher(sentence);
        if (!matcher.find()) {
            return null;
        }

        String cat = matcher.group(1).toUpperCase(Locale.ROOT);
        int timeframeMonths = 12;
        String recommendation = "Lung-RADS follow-up protocol.";
        String modality = "Low-Dose Chest CT (LDCT)";
        double revenue = 550.0;

        if (cat.startsWith("3")) {
            timeframeMonths = 6;
            recommendation = "Lung-RADS 3 (Probably Benign): 6-month follow-up low-dose CT.";
            revenue = 550.0;
        } else if (cat.startsWith("4A")) {
            timeframeMonths = 3;
            recommendation = "Lung-RADS 4A (Suspicious): 3-month follow-up low-dose CT or PET/CT.";
            modality = "Low-Dose Chest CT or PET/CT";
            revenue = 850.0;
        } else if (cat.startsWith("4B") || cat.startsWith("4X")) {
            timeframeMonths = 1;
            recommendation = "Lung-RADS 4B/4X (Very Suspicious): Diagnostic chest CT with IV contrast, PET/CT, and tissue sampling.";
            modality = "Chest CT with Contrast / PET-CT / Biopsy";
            revenue = 1950.0;
        }

        return IncidentalFindingDto.builder()
                .findingText(sentence)
                .guidelineSystem(IncidentalGuidelineSystem.LUNG_RADS)
                .recommendationText(recommendation)
                .timeframeMonths(timeframeMonths)
                .dueDate(LocalDate.now().plusMonths(timeframeMonths))
                .status(IncidentalFollowUpStatus.PENDING_SCHEDULING)
                .followUpModality(modality)
                .estimatedRevenueRecapture(revenue)
                .build();
    }

    /**
     * Evaluates explicit follow-up phrases in narrative reports.
     */
    public IncidentalFindingDto evaluateExplicitFollowUp(String sentence) {
        Matcher matcher = EXPLICIT_FOLLOWUP_PATTERN.matcher(sentence);
        if (!matcher.find()) {
            return null;
        }

        String modality = matcher.group(1).trim();
        int amount;
        try {
            amount = Integer.parseInt(matcher.group(2));
        } catch (NumberFormatException e) {
            amount = 6;
        }

        String unit = matcher.group(3).toLowerCase(Locale.ROOT);
        int months = unit.startsWith("year") ? amount * 12 : (unit.startsWith("wk") || unit.startsWith("week") ? Math.max(1, amount / 4) : amount);

        double revenue = estimateRevenueForModality(modality);

        return IncidentalFindingDto.builder()
                .findingText(sentence)
                .guidelineSystem(IncidentalGuidelineSystem.GENERAL)
                .recommendationText(String.format(Locale.ROOT, "Follow-up recommended: %s in %d months.", modality, months))
                .timeframeMonths(months)
                .dueDate(LocalDate.now().plusMonths(months))
                .status(IncidentalFollowUpStatus.PENDING_SCHEDULING)
                .followUpModality(capitalizeModality(modality))
                .estimatedRevenueRecapture(revenue)
                .build();
    }

    // Helper extractors
    private Double extractNoduleSizeMm(String text) {
        Matcher m1 = NODULE_SIZE_PATTERN.matcher(text);
        if (m1.find()) {
            double val = Double.parseDouble(m1.group(1));
            String unit = m1.group(2).toLowerCase(Locale.ROOT);
            return unit.equals("cm") ? val * 10.0 : val;
        }
        Matcher m2 = SIZE_THEN_NODULE_PATTERN.matcher(text);
        if (m2.find()) {
            double val = Double.parseDouble(m2.group(1));
            String unit = m2.group(2).toLowerCase(Locale.ROOT);
            return unit.equals("cm") ? val * 10.0 : val;
        }
        return null;
    }

    private Double extractThyroidSizeMm(String text) {
        Matcher m = THYROID_NODULE_SIZE_PATTERN.matcher(text);
        if (m.find()) {
            double val = Double.parseDouble(m.group(1));
            String unit = m.group(2).toLowerCase(Locale.ROOT);
            return unit.equals("cm") ? val * 10.0 : val;
        }
        return null;
    }

    private double estimateRevenueForModality(String modality) {
        String lower = modality.toLowerCase(Locale.ROOT);
        if (lower.contains("pet")) return 2200.0;
        if (lower.contains("mri") || lower.contains("mr")) return 1350.0;
        if (lower.contains("ct") || lower.contains("computed tomography")) return 820.0;
        if (lower.contains("mammogra") || lower.contains("mammo")) return 620.0;
        if (lower.contains("ultrasound") || lower.contains("us") || lower.contains("sonogram")) return 450.0;
        if (lower.contains("biopsy")) return 1800.0;
        return 700.0;
    }

    private String capitalizeModality(String mod) {
        if (mod == null || mod.isBlank()) return "Follow-up Imaging";
        String[] words = mod.trim().split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (String w : words) {
            if (w.equalsIgnoreCase("ct") || w.equalsIgnoreCase("mri") || w.equalsIgnoreCase("us") || w.equalsIgnoreCase("fna") || w.equalsIgnoreCase("pet")) {
                sb.append(w.toUpperCase(Locale.ROOT)).append(" ");
            } else {
                sb.append(Character.toUpperCase(w.charAt(0))).append(w.substring(1).toLowerCase(Locale.ROOT)).append(" ");
            }
        }
        return sb.toString().trim();
    }
}
