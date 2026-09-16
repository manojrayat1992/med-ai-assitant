package com.medai.incidental.enums;

public enum IncidentalGuidelineSystem {
    FLEISCHNER("Fleischner 2017 (Pulmonary Nodule)"),
    TI_RADS("ACR TI-RADS (Thyroid Nodule)"),
    BI_RADS("ACR BI-RADS (Breast Mass/Density)"),
    LUNG_RADS("ACR Lung-RADS (Lung Screening)"),
    GENERAL("General Clinical Recommendation");

    private final String displayName;

    IncidentalGuidelineSystem(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }
}
