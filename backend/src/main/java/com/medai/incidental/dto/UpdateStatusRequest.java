package com.medai.incidental.dto;

import com.medai.incidental.enums.IncidentalFollowUpStatus;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateStatusRequest {
    @NotNull(message = "status is required")
    private IncidentalFollowUpStatus status;

    private LocalDate scheduledDate;
    private LocalDate completedDate;
    private String notes;
}
