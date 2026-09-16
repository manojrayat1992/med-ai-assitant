package com.medai.integration.pacs.repository;

import com.medai.integration.pacs.entity.PacsConnectorEntity;
import com.medai.integration.pacs.enums.ConnectorStatus;
import com.medai.integration.pacs.enums.PacsConnectorType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PacsConnectorRepository extends JpaRepository<PacsConnectorEntity, UUID> {

    List<PacsConnectorEntity> findByTenantIdOrderByCreatedAtAsc(UUID tenantId);

    Optional<PacsConnectorEntity> findByIdAndTenantId(UUID id, UUID tenantId);

    List<PacsConnectorEntity> findByTenantIdAndType(UUID tenantId, PacsConnectorType type);

    List<PacsConnectorEntity> findByTenantIdAndStatus(UUID tenantId, ConnectorStatus status);

    long countByTenantId(UUID tenantId);
}
