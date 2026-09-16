package com.medai.incidental.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ParseReportRequest {
    @NotNull(message = "patientId is required")
    private UUID patientId;

    private UUID reportId;

    @NotBlank(message = "reportText is required")
    private String reportText;

    private String patientName;
    private String mrn;
}
