package com.medai.integration.pacs.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Hl7ParseResultDto {
    private String messageType;
    private String messageControlId;
    private String sendingFacility;
    private String patientMrn;
    private String patientName;
    private String dateOfBirth;
    private String sex;
    private String patientIdentifierAuthority;
    private String placerOrderNumber;
    private String diagnosticServiceSection;
    private String mllpAckMessage;
    private String accessionNumber;
    private String modality;
    private String studyDescription;
    private List<String> findings;
    private List<String> impression;
    private String rawAckMessage;
    private boolean success;
    private String parseNotes;
}
