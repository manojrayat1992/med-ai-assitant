package com.medai.knowledge;

import com.medai.knowledge.entity.DocumentStatus;
import com.medai.knowledge.repository.*;
import com.medai.knowledge.service.*;
import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class ClinicalKnowledgeServiceTest {
    private final KnowledgeDocumentRepository documents = mock(KnowledgeDocumentRepository.class);
    private final DocumentChunkRepository chunks = mock(DocumentChunkRepository.class);
    private final EmbeddingService embeddings = mock(EmbeddingService.class);
    private final ClinicalKnowledgeService service = new ClinicalKnowledgeService(documents, chunks, embeddings);

    @Test void emptyWorkspaceDoesNotEmbedOrRetrieve() {
        assertThat(service.retrieve(UUID.randomUUID(), "report")).isEmpty();
        verifyNoInteractions(embeddings, chunks);
    }
    @Test void rejectsMissingWorkspace() {
        assertThatThrownBy(() -> service.retrieve(null, "report")).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void appliesTenantAndRelevanceFilterAndBoundsContext() {
        UUID tenant = UUID.randomUUID();
        when(documents.existsByTenantIdAndStatus(tenant, DocumentStatus.READY)).thenReturn(true);
        when(embeddings.embedText(anyString())).thenReturn(new float[]{1});
        when(embeddings.toVectorString(any())).thenReturn("[1]");
        var irrelevant = passage(0.1, "irrelevant");
        var relevant = passage(0.8, "a".repeat(2000));
        when(chunks.findSimilarChunks(tenant, "[1]", 6)).thenReturn(List.of(irrelevant, relevant));
        var result = service.retrieve(tenant, "query");
        assertThat(result).hasSize(1);
        assertThat(result.getFirst().text()).hasSize(1600);
        assertThat(service.format(result)).contains("Reference 1", "chunk 1", relevant.getDocumentId().toString());
        verify(chunks).findSimilarChunks(tenant, "[1]", 6);
    }
    private ChunkSimilarityProjection passage(double score, String text) {
        var p = mock(ChunkSimilarityProjection.class);
        when(p.getSimilarityScore()).thenReturn(score);
        if (score >= .3) {
            when(p.getDocumentId()).thenReturn(UUID.randomUUID());
            when(p.getDocTitle()).thenReturn("Protocol");
            when(p.getDocType()).thenReturn("GUARDRAIL");
            when(p.getChunkIndex()).thenReturn(0);
            when(p.getContent()).thenReturn(text);
        }
        return p;
    }
}
