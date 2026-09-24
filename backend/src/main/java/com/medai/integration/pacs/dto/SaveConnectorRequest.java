package com.medai.integration.pacs.dto;

import com.medai.integration.pacs.enums.PacsConnectorType;
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
public class SaveConnectorRequest {
    private UUID id;

    @NotBlank(message = "Connector name is required")
    @jakarta.validation.constraints.Size(max = 120)
    private String name;

    @NotNull(message = "Connector type is required")
    private PacsConnectorType type;

    @jakarta.validation.constraints.Size(max = 255)
    private String host;
    @jakarta.validation.constraints.Min(1)
    @jakarta.validation.constraints.Max(65535)
    private Integer port;
    @jakarta.validation.constraints.Size(max = 16)
    private String aetTitle;
    @jakarta.validation.constraints.Size(max = 16)
    private String localAet;
    @jakarta.validation.constraints.Size(max = 512)
    private String endpointUrl;
    private String viewerUrl;
    @jakarta.validation.constraints.Size(max = 500)
    private String description;
    @jakarta.validation.constraints.Pattern(regexp = "[A-Za-z0-9_-]{0,64}")
    private String orthancModality;
    @jakarta.validation.constraints.Size(max = 256)
    private String username;
    @jakarta.validation.constraints.Size(max = 2048)
    @lombok.ToString.Exclude
    private String password;
    @jakarta.validation.constraints.Size(max = 8192)
    @jakarta.validation.constraints.Pattern(regexp = "[^\\r\\n]*")
    @lombok.ToString.Exclude
    private String bearerToken;
    private Boolean clearCredentials;
}
