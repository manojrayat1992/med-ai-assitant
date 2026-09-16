package com.medai.incidental.service;

import com.medai.common.exception.ResourceNotFoundException;
import com.medai.incidental.dto.IncidentalFindingDto;
import com.medai.incidental.dto.IncidentalTrackerSummaryDto;
import com.medai.incidental.dto.ParseReportRequest;
import com.medai.incidental.dto.UpdateStatusRequest;
import com.medai.incidental.entity.IncidentalFindingEntity;
import com.medai.incidental.enums.IncidentalFollowUpStatus;
import com.medai.incidental.enums.IncidentalGuidelineSystem;
import com.medai.incidental.repository.IncidentalFindingRepository;
import com.medai.patient.entity.Patient;
import com.medai.patient.repository.PatientRepository;
import com.medai.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class IncidentalTrackerService {

    private static final UUID DEFAULT_DEMO_TENANT = UUID.fromString("00000000-0000-0000-0000-000000000001");

    private final IncidentalFindingRepository incidentalFindingRepository;
    private final PatientRepository patientRepository;
    private final FleischnerGuidelineEngine guidelineEngine;

    private UUID resolveTenantId() {
        UUID current = TenantContext.getCurrentTenantId();
        return current != null ? current : DEFAULT_DEMO_TENANT;
    }

    @Transactional
    public List<IncidentalFindingDto> getFindings(UUID patientId, IncidentalFollowUpStatus status, IncidentalGuidelineSystem guideline) {
        UUID tenantId = resolveTenantId();

        // Seed demo data if tenant has no findings yet
        if (incidentalFindingRepository.countByTenantId(tenantId) == 0) {
            seedSampleData(tenantId);
        }

        // Auto-check and transition overdue items
        checkAndMarkOverdueFindings(tenantId);

        List<IncidentalFindingEntity> list;
        if (patientId != null) {
            list = incidentalFindingRepository.findByTenantIdAndPatientIdOrderByCreatedAtDesc(tenantId, patientId);
        } else if (status != null) {
            list = incidentalFindingRepository.findByTenantIdAndStatusOrderByCreatedAtDesc(tenantId, status);
        } else if (guideline != null) {
            list = incidentalFindingRepository.findByTenantIdAndGuidelineSystemOrderByCreatedAtDesc(tenantId, guideline);
        } else {
            list = incidentalFindingRepository.findByTenantIdOrderByCreatedAtDesc(tenantId);
        }

        return list.stream().map(this::toDto).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public IncidentalTrackerSummaryDto getSummary() {
        UUID tenantId = resolveTenantId();
        if (incidentalFindingRepository.countByTenantId(tenantId) == 0) {
            // Read-only fallback query doesn't crash
            return IncidentalTrackerSummaryDto.builder()
                    .totalCount(0)
                    .pendingCount(0)
                    .scheduledCount(0)
                    .completedCount(0)
                    .overdueCount(0)
                    .totalRevenueOpportunity(0.0)
                    .recapturedRevenue(0.0)
                    .guidelineBreakdown(Map.of())
                    .build();
        }

        List<IncidentalFindingEntity> all = incidentalFindingRepository.findByTenantIdOrderByCreatedAtDesc(tenantId);
        long total = all.size();
        long pending = all.stream().filter(f -> f.getStatus() == IncidentalFollowUpStatus.PENDING_SCHEDULING).count();
        long scheduled = all.stream().filter(f -> f.getStatus() == IncidentalFollowUpStatus.SCHEDULED).count();
        long completed = all.stream().filter(f -> f.getStatus() == IncidentalFollowUpStatus.COMPLETED).count();
        long overdue = all.stream().filter(f -> f.getStatus() == IncidentalFollowUpStatus.OVERDUE).count();

        double totalRevenue = all.stream()
                .mapToDouble(f -> f.getEstimatedRevenueRecapture() != null ? f.getEstimatedRevenueRecapture() : 0.0)
                .sum();

        double recapturedRevenue = all.stream()
                .filter(f -> f.getStatus() == IncidentalFollowUpStatus.COMPLETED)
                .mapToDouble(f -> f.getEstimatedRevenueRecapture() != null ? f.getEstimatedRevenueRecapture() : 0.0)
                .sum();

        Map<String, Long> breakdown = all.stream()
                .collect(Collectors.groupingBy(f -> f.getGuidelineSystem().name(), Collectors.counting()));

        return IncidentalTrackerSummaryDto.builder()
                .totalCount(total)
                .pendingCount(pending)
                .scheduledCount(scheduled)
                .completedCount(completed)
                .overdueCount(overdue)
                .totalRevenueOpportunity(totalRevenue)
                .recapturedRevenue(recapturedRevenue)
                .guidelineBreakdown(breakdown)
                .build();
    }

    @Transactional
    public List<IncidentalFindingDto> parseAndTrackReport(ParseReportRequest request) {
        UUID tenantId = resolveTenantId();
        List<IncidentalFindingDto> parsed = guidelineEngine.parseReport(request.getReportText());
        if (parsed.isEmpty()) {
            return List.of();
        }

        String patientName = request.getPatientName();
        String mrn = request.getMrn();

        if (request.getPatientId() != null && (patientName == null || mrn == null)) {
            Optional<Patient> pOpt = patientRepository.findByIdAndTenantId(request.getPatientId(), tenantId);
            if (pOpt.isPresent()) {
                Patient p = pOpt.get();
                if (patientName == null) patientName = p.getFullName();
                if (mrn == null) mrn = p.getMedicalRecordNumber();
            }
        }

        List<IncidentalFindingEntity> savedEntities = new ArrayList<>();
        for (IncidentalFindingDto dto : parsed) {
            IncidentalFindingEntity entity = IncidentalFindingEntity.builder()
                    .tenantId(tenantId)
                    .patientId(request.getPatientId())
                    .reportId(request.getReportId())
                    .patientName(patientName != null ? patientName : "Patient")
                    .mrn(mrn != null ? mrn : "MRN-UNKNOWN")
                    .findingText(dto.getFindingText())
                    .guidelineSystem(dto.getGuidelineSystem())
                    .recommendationText(dto.getRecommendationText())
                    .timeframeMonths(dto.getTimeframeMonths())
                    .dueDate(dto.getDueDate())
                    .status(IncidentalFollowUpStatus.PENDING_SCHEDULING)
                    .followUpModality(dto.getFollowUpModality())
                    .estimatedRevenueRecapture(dto.getEstimatedRevenueRecapture())
                    .notes(dto.getNotes())
                    .build();

            savedEntities.add(incidentalFindingRepository.save(entity));
        }

        log.info("Saved and tracked {} incidental findings for patient {}", savedEntities.size(), request.getPatientId());
        return savedEntities.stream().map(this::toDto).collect(Collectors.toList());
    }

    @Transactional
    public IncidentalFindingDto updateStatus(UUID findingId, UpdateStatusRequest request) {
        UUID tenantId = resolveTenantId();
        IncidentalFindingEntity entity = incidentalFindingRepository.findByIdAndTenantId(findingId, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("IncidentalFinding", "id", findingId.toString()));

        entity.setStatus(request.getStatus());

        if (request.getStatus() == IncidentalFollowUpStatus.SCHEDULED) {
            entity.setScheduledDate(request.getScheduledDate() != null ? request.getScheduledDate() : LocalDate.now().plusWeeks(2));
        } else if (request.getStatus() == IncidentalFollowUpStatus.COMPLETED) {
            entity.setCompletedDate(request.getCompletedDate() != null ? request.getCompletedDate() : LocalDate.now());
        }

        if (request.getNotes() != null && !request.getNotes().isBlank()) {
            entity.setNotes(request.getNotes());
        }

        IncidentalFindingEntity saved = incidentalFindingRepository.save(entity);
        log.info("Updated incidental finding {} status to {}", findingId, request.getStatus());
        return toDto(saved);
    }

    private void checkAndMarkOverdueFindings(UUID tenantId) {
        LocalDate today = LocalDate.now();
        List<IncidentalFindingEntity> overdueList = incidentalFindingRepository.findByTenantIdAndDueDateBeforeAndStatusIn(
                tenantId, today, List.of(IncidentalFollowUpStatus.PENDING_SCHEDULING, IncidentalFollowUpStatus.SCHEDULED));

        for (IncidentalFindingEntity entity : overdueList) {
            entity.setStatus(IncidentalFollowUpStatus.OVERDUE);
            incidentalFindingRepository.save(entity);
        }
    }

    private void seedSampleData(UUID tenantId) {
        log.info("Seeding initial incidental findings dataset for tenant {}", tenantId);
        List<Patient> patients = patientRepository.findByTenantId(tenantId, org.springframework.data.domain.PageRequest.of(0, 5)).getContent();
        UUID samplePatientId = !patients.isEmpty() ? patients.get(0).getId() : UUID.randomUUID();
        String samplePatientName = !patients.isEmpty() ? patients.get(0).getFullName() : "Eleanor Vance";
        String sampleMrn = !patients.isEmpty() ? patients.get(0).getMedicalRecordNumber() : "MRN-449102";

        List<IncidentalFindingEntity> seedList = List.of(
                IncidentalFindingEntity.builder()
                        .tenantId(tenantId)
                        .patientId(samplePatientId)
                        .patientName(samplePatientName)
                        .mrn(sampleMrn)
                        .findingText("Incidental 7.2 mm non-calcified solid nodule in the right lower lobe.")
                        .guidelineSystem(IncidentalGuidelineSystem.FLEISCHNER)
                        .recommendationText("Fleischner 2017: Solid nodule (7.2 mm). Recommend follow-up low-dose CT chest in 6 to 12 months.")
                        .timeframeMonths(6)
                        .dueDate(LocalDate.now().plusMonths(6))
                        .status(IncidentalFollowUpStatus.PENDING_SCHEDULING)
                        .followUpModality("CT Chest Low Dose without IV Contrast")
                        .estimatedRevenueRecapture(780.0)
                        .notes("High risk smoker profile. Order placed via closed-loop tracker.")
                        .build(),

                IncidentalFindingEntity.builder()
                        .tenantId(tenantId)
                        .patientId(samplePatientId)
                        .patientName(samplePatientName)
                        .mrn(sampleMrn)
                        .findingText("14 mm well-circumscribed hypoechoic nodule in the right thyroid lobe. ACR TI-RADS 4.")
                        .guidelineSystem(IncidentalGuidelineSystem.TI_RADS)
                        .recommendationText("ACR TI-RADS 4 (Moderately Suspicious, 14 mm): Recommend follow-up thyroid ultrasound in 12 months.")
                        .timeframeMonths(12)
                        .dueDate(LocalDate.now().plusMonths(12))
                        .status(IncidentalFollowUpStatus.SCHEDULED)
                        .scheduledDate(LocalDate.now().plusMonths(11))
                        .followUpModality("Ultrasound Neck / Thyroid")
                        .estimatedRevenueRecapture(450.0)
                        .notes("Appointment confirmed with Endocrine Clinic.")
                        .build(),

                IncidentalFindingEntity.builder()
                        .tenantId(tenantId)
                        .patientId(samplePatientId)
                        .patientName(samplePatientName)
                        .mrn(sampleMrn)
                        .findingText("Focal architectural asymmetry in the upper outer quadrant of the left breast. ACR BI-RADS 3.")
                        .guidelineSystem(IncidentalGuidelineSystem.BI_RADS)
                        .recommendationText("ACR BI-RADS 3 (Probably Benign): Short-interval follow-up diagnostic mammography and ultrasound in 6 months.")
                        .timeframeMonths(6)
                        .dueDate(LocalDate.now().minusDays(14)) // Overdue case demonstration
                        .status(IncidentalFollowUpStatus.OVERDUE)
                        .followUpModality("Diagnostic Mammography & Breast Ultrasound")
                        .estimatedRevenueRecapture(620.0)
                        .notes("Patient outreach SMS & letter dispatched. Scheduling coordinator flagged.")
                        .build(),

                IncidentalFindingEntity.builder()
                        .tenantId(tenantId)
                        .patientId(samplePatientId)
                        .patientName(samplePatientName)
                        .mrn(sampleMrn)
                        .findingText("Indeterminate 11 mm liver lesion in segment VI seen on non-contrast chest CT.")
                        .guidelineSystem(IncidentalGuidelineSystem.GENERAL)
                        .recommendationText("Follow-up recommended: Triphasic Liver MRI with IV contrast in 3 months for characterization.")
                        .timeframeMonths(3)
                        .dueDate(LocalDate.now().minusMonths(1))
                        .status(IncidentalFollowUpStatus.COMPLETED)
                        .completedDate(LocalDate.now().minusWeeks(1))
                        .followUpModality("MRI Abdomen with and without IV Contrast")
                        .estimatedRevenueRecapture(1350.0)
                        .notes("Follow-up study completed. Proven benign hepatic hemangioma. Revenue recaptured.")
                        .build()
        );

        incidentalFindingRepository.saveAll(seedList);
    }

    private IncidentalFindingDto toDto(IncidentalFindingEntity e) {
        return IncidentalFindingDto.builder()
                .id(e.getId())
                .tenantId(e.getTenantId())
                .patientId(e.getPatientId())
                .reportId(e.getReportId())
                .patientName(e.getPatientName())
                .mrn(e.getMrn())
                .findingText(e.getFindingText())
                .guidelineSystem(e.getGuidelineSystem())
                .recommendationText(e.getRecommendationText())
                .timeframeMonths(e.getTimeframeMonths())
                .dueDate(e.getDueDate())
                .status(e.getStatus())
                .followUpModality(e.getFollowUpModality())
                .estimatedRevenueRecapture(e.getEstimatedRevenueRecapture())
                .scheduledDate(e.getScheduledDate())
                .completedDate(e.getCompletedDate())
                .notes(e.getNotes())
                .createdAt(e.getCreatedAt())
                .updatedAt(e.getUpdatedAt())
                .build();
    }
}
