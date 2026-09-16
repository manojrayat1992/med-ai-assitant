package com.medai.incidental.repository;

import com.medai.incidental.entity.IncidentalFindingEntity;
import com.medai.incidental.enums.IncidentalFollowUpStatus;
import com.medai.incidental.enums.IncidentalGuidelineSystem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface IncidentalFindingRepository extends JpaRepository<IncidentalFindingEntity, UUID> {

    List<IncidentalFindingEntity> findByTenantIdOrderByCreatedAtDesc(UUID tenantId);

    Optional<IncidentalFindingEntity> findByIdAndTenantId(UUID id, UUID tenantId);

    List<IncidentalFindingEntity> findByTenantIdAndStatusOrderByCreatedAtDesc(
            UUID tenantId, IncidentalFollowUpStatus status);

    List<IncidentalFindingEntity> findByTenantIdAndGuidelineSystemOrderByCreatedAtDesc(
            UUID tenantId, IncidentalGuidelineSystem guidelineSystem);

    List<IncidentalFindingEntity> findByTenantIdAndPatientIdOrderByCreatedAtDesc(
            UUID tenantId, UUID patientId);

    List<IncidentalFindingEntity> findByTenantIdAndDueDateBeforeAndStatusIn(
            UUID tenantId, LocalDate date, List<IncidentalFollowUpStatus> statuses);

    long countByTenantId(UUID tenantId);

    long countByTenantIdAndStatus(UUID tenantId, IncidentalFollowUpStatus status);

    long countByTenantIdAndGuidelineSystem(UUID tenantId, IncidentalGuidelineSystem guidelineSystem);
}
