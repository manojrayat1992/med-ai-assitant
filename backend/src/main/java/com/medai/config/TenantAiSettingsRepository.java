package com.medai.config;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface TenantAiSettingsRepository extends JpaRepository<TenantAiSettings, UUID> {

    Optional<TenantAiSettings> findByTenantId(UUID tenantId);

    void deleteByTenantId(UUID tenantId);
}
