package com.medai.incidental.dto;

import com.medai.incidental.enums.IncidentalFollowUpStatus;
import com.medai.incidental.enums.IncidentalGuidelineSystem;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IncidentalFindingDto {
    private UUID id;
    private UUID tenantId;
    private UUID patientId;
    private UUID reportId;
    private String patientName;
    private String mrn;
    private String findingText;
    private IncidentalGuidelineSystem guidelineSystem;
    private String recommendationText;
    private Integer timeframeMonths;
    private LocalDate dueDate;
    private IncidentalFollowUpStatus status;
    private String followUpModality;
    private Double estimatedRevenueRecapture;
    private LocalDate scheduledDate;
    private LocalDate completedDate;
    private String notes;
    private Instant createdAt;
    private Instant updatedAt;
}
