package com.medai.knowledge.repository;

import com.medai.knowledge.entity.DocumentType;
import com.medai.knowledge.entity.KnowledgeDocument;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface KnowledgeDocumentRepository extends JpaRepository<KnowledgeDocument, UUID> {

    boolean existsByTenantIdAndStatus(UUID tenantId, com.medai.knowledge.entity.DocumentStatus status);

    Page<KnowledgeDocument> findByTenantIdOrderByCreatedAtDesc(UUID tenantId, Pageable pageable);

    Page<KnowledgeDocument> findByTenantIdAndDocumentTypeOrderByCreatedAtDesc(
            UUID tenantId, DocumentType documentType, Pageable pageable);

    Optional<KnowledgeDocument> findByIdAndTenantId(UUID id, UUID tenantId);

    void deleteByIdAndTenantId(UUID id, UUID tenantId);
}
