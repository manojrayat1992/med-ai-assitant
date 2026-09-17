package com.medai.knowledge.entity;

import com.medai.common.entity.TenantAwareEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "document_chunks")
@Getter
@Setter
@NoArgsConstructor
public class DocumentChunk extends TenantAwareEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "document_id", nullable = false)
    private KnowledgeDocument knowledgeDocument;

    @Column(name = "chunk_index", nullable = false)
    private Integer chunkIndex;

    @Column(name = "content", nullable = false, columnDefinition = "TEXT")
    private String content;

    @org.hibernate.annotations.ColumnTransformer(write = "cast(? as jsonb)")
    @Column(name = "metadata", columnDefinition = "JSONB")
    private String metadata;

    @org.hibernate.annotations.ColumnTransformer(write = "cast(? as vector)")
    @Column(name = "embedding", columnDefinition = "vector(384)")
    private String embedding;

    /** Model that produced {@link #embedding}; see V8 for why this is tracked. */
    @Column(name = "embedding_model", length = 100)
    private String embeddingModel;
}
