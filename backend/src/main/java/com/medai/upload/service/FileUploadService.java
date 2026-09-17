package com.medai.upload.service;

import com.medai.auth.security.UserPrincipal;
import com.medai.common.dto.PagedResponse;
import com.medai.common.exception.BadRequestException;
import com.medai.common.exception.ResourceNotFoundException;
import com.medai.patient.repository.PatientRepository;
import com.medai.tenant.TenantContext;
import com.medai.upload.dto.FileUploadResponse;
import com.medai.upload.entity.MedicalFile;
import com.medai.upload.enums.FileType;
import com.medai.upload.enums.UploadStatus;
import com.medai.upload.repository.MedicalFileRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashMap;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class FileUploadService {

    private final MedicalFileRepository medicalFileRepository;
    private final PatientRepository patientRepository;
    private final StorageService storageService;
    private final org.springframework.jdbc.core.JdbcTemplate jdbc;
    private final jakarta.persistence.EntityManager entityManager;

    private static final long MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

    @Transactional
    public FileUploadResponse uploadFile(UUID patientId, MultipartFile file,
                                          FileType fileType, String description) {
        UUID tenantId = TenantContext.requireTenantId();
        UserPrincipal principal = getCurrentUser();

        if (patientRepository.findByIdAndTenantId(patientId, tenantId).isEmpty()) {
            throw new ResourceNotFoundException("Patient", "id", patientId);
        }

        if (file.isEmpty()) {
            throw new BadRequestException("File is empty");
        }

        if (file.getSize() > MAX_FILE_SIZE) {
            throw new BadRequestException("File size exceeds 100MB limit");
        }

        String originalFileName = file.getOriginalFilename();
        String extension = getExtension(originalFileName);
        String storedFileName = UUID.randomUUID() + extension;

        String storagePath = storageService.store(tenantId, patientId, storedFileName, file);

        MedicalFile medicalFile = MedicalFile.builder()
                .patientId(patientId)
                .uploadedBy(principal.userId())
                .fileName(storedFileName)
                .originalFileName(originalFileName)
                .fileType(fileType)
                .mimeType(file.getContentType())
                .fileSizeBytes(file.getSize())
                .storagePath(storagePath)
                .description(description)
                .uploadStatus(UploadStatus.UPLOADED)
                .metadata(new HashMap<>())
                .build();
        medicalFile.setTenantId(tenantId);
        medicalFile = medicalFileRepository.save(medicalFile);

        log.info("File uploaded: {} for patient {} (tenant: {})", originalFileName, patientId, tenantId);

        return toResponse(medicalFile);
    }

    @Transactional
    public PagedResponse<FileUploadResponse> listFiles(UUID patientId, int page, int size) {
        UUID tenantId = TenantContext.requireTenantId();
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by("createdAt").descending());
        Page<MedicalFile> files = medicalFileRepository.findByTenantIdAndPatientId(tenantId, patientId, pageRequest);

        files.getContent().forEach(this::migrateInlineText);
        return PagedResponse.<FileUploadResponse>builder()
                .content(files.getContent().stream().map(this::toResponse).toList())
                .page(files.getNumber())
                .size(files.getSize())
                .totalElements(files.getTotalElements())
                .totalPages(files.getTotalPages())
                .last(files.isLast())
                .build();
    }

    /**
     * Loads a file by its full path identity — tenant, patient, and file.
     *
     * <p>Scoping by tenant alone was not enough: the {@code patientId} on the route was ignored,
     * so any authenticated user could read any file in the hospital by guessing file IDs.
     */
    @Transactional
    public MedicalFile getFile(UUID patientId, UUID fileId) {
        UUID tenantId = TenantContext.requireTenantId();
        MedicalFile file = medicalFileRepository.findByIdAndPatientIdAndTenantId(fileId, patientId, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("File", "id", fileId));
        migrateInlineText(file);
        return file;
    }

    @Transactional
    public void deleteFile(UUID patientId, UUID fileId) {
        UUID tenantId = TenantContext.requireTenantId();
        MedicalFile file = medicalFileRepository.findByIdAndPatientIdAndTenantId(fileId, patientId, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("File", "id", fileId));
        storageService.delete(file.getStoragePath());
        medicalFileRepository.delete(file);
        log.info("File deleted: {} for patient {} (tenant: {})", fileId, patientId, tenantId);
    }

    /** Legacy text sources had no stored object. Recover the earliest available saved draft,
     * mark its provenance, upload first, then persist the S3 key. Failed writes leave it retryable. */
    private void migrateInlineText(MedicalFile file) {
        if (file.getStoragePath() == null || !file.getStoragePath().startsWith("inline-report-text://")) return;
        // Serialize simultaneous opens so they do not overwrite the recovered source snapshot.
        entityManager.refresh(file, jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
        if (!file.getStoragePath().startsWith("inline-report-text://")) return;
        var texts = jdbc.queryForList("""
                SELECT COALESCE(NULLIF(r.draft_content, ''), r.final_content)
                FROM report_reviews r JOIN analysis_requests a ON a.id=r.analysis_id AND a.tenant_id=r.tenant_id
                WHERE a.medical_file_id=? AND a.tenant_id=? AND a.patient_id=?
                  AND r.patient_id=?
                ORDER BY r.created_at ASC LIMIT 1
                """, String.class, file.getId(), file.getTenantId(), file.getPatientId(), file.getPatientId());
        if (texts.isEmpty() || texts.getFirst() == null) {
            throw new StorageException("Saved source text is unavailable for file " + file.getId());
        }
        var upload = new TextUpload("recovered-report-" + file.getId() + ".txt", texts.getFirst());
        String key = storageService.store(file.getTenantId(), file.getPatientId(), upload.getOriginalFilename(), upload);
        file.setStoragePath(key);
        file.setMimeType(upload.getContentType());
        file.setFileSizeBytes(upload.getSize());
        var metadata = new HashMap<String, Object>();
        if (file.getMetadata() != null) metadata.putAll(file.getMetadata());
        metadata.put("sourceRecovery", "EARLIEST_AVAILABLE_SAVED_REPORT");
        file.setMetadata(metadata);
        medicalFileRepository.save(file);
    }

    private UserPrincipal getCurrentUser() {
        return (UserPrincipal) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }

    private String getExtension(String fileName) {
        if (fileName != null && fileName.contains(".")) {
            return fileName.substring(fileName.lastIndexOf("."));
        }
        return "";
    }

    private FileUploadResponse toResponse(MedicalFile f) {
        return FileUploadResponse.builder()
                .id(f.getId())
                .tenantId(f.getTenantId())
                .patientId(f.getPatientId())
                .uploadedBy(f.getUploadedBy())
                .fileName(f.getFileName())
                .originalFileName(f.getOriginalFileName())
                .fileType(f.getFileType())
                .mimeType(f.getMimeType())
                .fileSizeBytes(f.getFileSizeBytes())
                .description(f.getDescription())
                .uploadStatus(f.getUploadStatus())
                .metadata(f.getMetadata())
                .createdAt(f.getCreatedAt())
                .build();
    }
}
