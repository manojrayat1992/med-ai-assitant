package com.medai.integration.pacs.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Hl7ParseRequest {
    @NotBlank(message = "Raw HL7 message text is required")
    @jakarta.validation.constraints.Size(max = 262144)
    private String rawMessage;
}
