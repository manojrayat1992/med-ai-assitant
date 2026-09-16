package com.medai.incidental.entity;

import com.medai.incidental.enums.IncidentalFollowUpStatus;
import com.medai.incidental.enums.IncidentalGuidelineSystem;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "incidental_findings", indexes = {
        @Index(name = "idx_incidental_tenant", columnList = "tenant_id"),
        @Index(name = "idx_incidental_patient", columnList = "patient_id"),
        @Index(name = "idx_incidental_status", columnList = "status"),
        @Index(name = "idx_incidental_due_date", columnList = "due_date")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class IncidentalFindingEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "patient_id", nullable = false)
    private UUID patientId;

    @Column(name = "report_id")
    private UUID reportId;

    @Column(name = "patient_name")
    private String patientName;

    @Column(name = "mrn")
    private String mrn;

    @Column(name = "finding_text", length = 2000, nullable = false)
    private String findingText;

    @Enumerated(EnumType.STRING)
    @Column(name = "guideline_system", nullable = false)
    private IncidentalGuidelineSystem guidelineSystem;

    @Column(name = "recommendation_text", length = 1500, nullable = false)
    private String recommendationText;

    @Column(name = "timeframe_months")
    private Integer timeframeMonths;

    @Column(name = "due_date")
    private LocalDate dueDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private IncidentalFollowUpStatus status;

    @Column(name = "follow_up_modality")
    private String followUpModality;

    @Column(name = "estimated_revenue_recapture")
    private Double estimatedRevenueRecapture;

    @Column(name = "scheduled_date")
    private LocalDate scheduledDate;

    @Column(name = "completed_date")
    private LocalDate completedDate;

    @Column(name = "notes", length = 1000)
    private String notes;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
