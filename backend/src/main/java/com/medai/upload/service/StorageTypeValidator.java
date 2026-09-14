package com.medai.upload.service;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;

@Configuration
@RequiredArgsConstructor
public class StorageTypeValidator {
    private final StorageProperties properties;

    @PostConstruct
    void validate() {
        if (!"s3".equalsIgnoreCase(properties.getType())) {
            throw new IllegalStateException("Only S3 storage is supported. Set STORAGE_TYPE=s3 and configure STORAGE_S3_BUCKET. Local upload storage has been removed.");
        }
    }
}
