package com.medai.incidental.enums;

public enum IncidentalFollowUpStatus {
    PENDING_SCHEDULING("Pending Scheduling"),
    SCHEDULED("Scheduled"),
    COMPLETED("Completed"),
    OVERDUE("Overdue"),
    DISMISSED("Dismissed");

    private final String displayName;

    IncidentalFollowUpStatus(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }
}
