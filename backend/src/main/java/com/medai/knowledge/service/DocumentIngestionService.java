package com.medai.knowledge.service;

import com.medai.auth.security.UserPrincipal;
import com.medai.knowledge.entity.DocumentChunk;
import com.medai.knowledge.entity.DocumentStatus;
import com.medai.knowledge.entity.DocumentType;
import com.medai.knowledge.entity.KnowledgeDocument;
import com.medai.knowledge.repository.DocumentChunkRepository;
import com.medai.knowledge.repository.KnowledgeDocumentRepository;
import com.medai.upload.service.StorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@Slf4j
@RequiredArgsConstructor
public class DocumentIngestionService {

    private final KnowledgeDocumentRepository documentRepository;
    private final DocumentChunkRepository chunkRepository;
    private final StorageService storageService;
    private final EmbeddingService embeddingService;

    private static final int CHUNK_SIZE = 800;
    private static final int CHUNK_OVERLAP = 150;

    @Transactional
    public KnowledgeDocument ingestDocument(
            MultipartFile file,
            String title,
            DocumentType documentType,
            String source,
            UserPrincipal principal
    ) {
        String name = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase(java.util.Locale.ROOT);
        if (file.isEmpty() || file.getSize() > 20L * 1024 * 1024
                || !(name.endsWith(".pdf") || name.endsWith(".txt") || name.endsWith(".md"))) {
            throw new com.medai.common.exception.BadRequestException(
                    "Upload a searchable PDF, TXT or Markdown reference document up to 20 MB.");
        }
        log.info("Ingesting knowledge document '{}' (type: {}) for tenant {}",
                title, documentType, principal.tenantId());

        KnowledgeDocument doc = new KnowledgeDocument();
        doc.setTenantId(principal.tenantId());
        doc.setTitle(title != null && !title.isBlank() ? title : file.getOriginalFilename());
        doc.setDocumentType(documentType != null ? documentType : DocumentType.GUIDELINE);
        doc.setSource(source);
        doc.setFileName(file.getOriginalFilename());
        doc.setFileSizeBytes(file.getSize());
        doc.setMimeType(file.getContentType());
        doc.setCreatedBy(principal.userId());
        doc.setStatus(DocumentStatus.PROCESSING);

        // Store file
        String storagePath = storageService.store(
                principal.tenantId(),
                UUID.randomUUID(),
                file.getOriginalFilename(),
                file
        );
        doc.setStoragePath(storagePath);

        doc = documentRepository.save(doc);

        try {
            // Extract text
            String text = extractText(file);
            if (text == null || text.isBlank()) {
                throw new IllegalArgumentException("Document contains no readable text content.");
            }

            // Chunk text
            List<String> textChunks = chunkText(text, CHUNK_SIZE, CHUNK_OVERLAP);
            log.info("Document '{}' split into {} chunks", doc.getTitle(), textChunks.size());

            // Generate embeddings & save chunks
            for (int i = 0; i < textChunks.size(); i++) {
                String chunkContent = textChunks.get(i);
                float[] embedding = embeddingService.embedText(chunkContent);
                String vectorStr = embeddingService.toVectorString(embedding);

                DocumentChunk chunk = new DocumentChunk();
                chunk.setTenantId(principal.tenantId());
                chunk.setKnowledgeDocument(doc);
                chunk.setChunkIndex(i);
                chunk.setContent(chunkContent);
                chunk.setEmbedding(vectorStr);
                chunk.setEmbeddingModel(embeddingService.modelId());
                chunk.setMetadata(new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(
                        java.util.Map.of("chunk", i, "doc_title", doc.getTitle())));

                chunkRepository.save(chunk);
            }

            doc.setTotalChunks(textChunks.size());
            doc.setStatus(DocumentStatus.READY);
            doc = documentRepository.save(doc);

            log.info("Document '{}' successfully ingested and indexed with {} vector chunks",
                    doc.getTitle(), textChunks.size());

            return doc;
        } catch (Exception e) {
            log.error("Failed to ingest document '{}': {}", doc.getTitle(), e.getMessage(), e);
            doc.setStatus(DocumentStatus.FAILED);
            doc.setErrorMessage(e.getMessage());
            return documentRepository.save(doc);
        }
    }

    private String extractText(MultipartFile file) throws Exception {
        String filename = (file.getOriginalFilename() != null) ? file.getOriginalFilename().toLowerCase() : "";
        String contentType = (file.getContentType() != null) ? file.getContentType().toLowerCase() : "";

        if (filename.endsWith(".pdf") || contentType.contains("pdf")) {
            try (InputStream is = file.getInputStream();
                 PDDocument document = Loader.loadPDF(is.readAllBytes())) {
                PDFTextStripper stripper = new PDFTextStripper();
                return stripper.getText(document);
            }
        }

        // Plain text, Markdown, CSV
        return new String(file.getBytes(), StandardCharsets.UTF_8);
    }

    public List<String> chunkText(String text, int targetChunkSize, int overlap) {
        List<String> chunks = new ArrayList<>();
        if (text == null || text.isBlank()) return chunks;

        if (targetChunkSize < 1 || overlap < 0 || overlap >= targetChunkSize) {
            throw new IllegalArgumentException("Chunk size must be positive and overlap smaller than size");
        }
        // Bound even a PDF extracted as one long paragraph; preserve overlap for boundary context.
        for (int start = 0; start < text.length();) {
            int end = Math.min(start + targetChunkSize, text.length());
            String chunk = text.substring(start, end).trim();
            if (!chunk.isEmpty()) chunks.add(chunk);
            if (end == text.length()) break;
            start = end - overlap;
        }

        return chunks;
    }
}
