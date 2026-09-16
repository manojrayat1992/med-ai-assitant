package com.medai.integration;

import com.medai.integration.pacs.service.Hl7MessageParserService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import static org.assertj.core.api.Assertions.assertThat;

class Hl7MessageParserServiceTest {
    private final Hl7MessageParserService parser = new Hl7MessageParserService();
    private static final String HEADER = "MSH|^~\\&|EPIC_RAD|HOSPITAL_MAIN|MEDAI|PACS|20260915103000||ORU^R01|MSG009412|T|2.5.1\r";
    private static final String PATIENT = "PID|1||MRN-449102^^^HOSPITAL||Vance^Eleanor||19780412|F\r";
    private static final String ORDER = "OBR|1|ORD-9182|ACC-9182|71250^CT CHEST^CPT\r";
    private static final String OBSERVATIONS = "OBX|1|TX|FINDINGS^Findings||Lungs clear.||||||F\rOBX|2|TX|IMPRESSION^Impression||No acute finding.||||||F\r";
    private static final String MESSAGE = HEADER + PATIENT + ORDER + OBSERVATIONS;

    @Test void parsesDemographicsOrdersAndTextAndCorrelatesAck() {
        var r = parser.parseMessage(MESSAGE);
        assertThat(r.isSuccess()).isTrue();
        assertThat(r.getPatientMrn()).isEqualTo("MRN-449102");
        assertThat(r.getPatientIdentifierAuthority()).isEqualTo("HOSPITAL");
        assertThat(r.getPatientName()).isEqualTo("Eleanor Vance");
        assertThat(r.getDateOfBirth()).isEqualTo("1978-04-12");
        assertThat(r.getSex()).isEqualTo("F");
        assertThat(r.getAccessionNumber()).isEqualTo("ACC-9182");
        assertThat(r.getPlacerOrderNumber()).isEqualTo("ORD-9182");
        assertThat(r.getModality()).isEqualTo("CT");
        assertThat(r.getFindings()).containsExactly("Lungs clear.");
        assertThat(r.getImpression()).containsExactly("No acute finding.");
        assertThat(r.getRawAckMessage()).startsWith("MSH|^~\\&|MEDAI|PACS|EPIC_RAD|HOSPITAL_MAIN|").contains("|ACK^R01|").endsWith("MSA|AA|MSG009412\r");
        String[] ack = r.getRawAckMessage().split("\r")[0].split("\\|");
        assertThat(ack[9]).isNotBlank().isNotEqualTo("MSG009412");
        assertThat(ack[10]).isEqualTo("T");
        assertThat(ack[11]).isEqualTo("2.5.1");
        assertThat(r.getParseNotes()).contains("No patient record, order or report was saved");
    }
    @Test void acceptsMllpAndReturnsFramedPreview() {
        var r = parser.parseMessage("\u000b" + MESSAGE + "\u001c\r");
        assertThat(r.isSuccess()).isTrue();
        assertThat(r.getMllpAckMessage()).isEqualTo("\u000b" + r.getRawAckMessage() + "\u001c\r");
    }
    @Test void handlesAlternateDelimitersEscapesAndRepetitions() {
        var r = parser.parseMessage((HEADER + PATIENT + ORDER + "OBX|1|FT|FINDINGS||A\\F\\B~C\\S\\D\\.br\\E\r").replace('|', '*').replace('^', '%'));
        assertThat(r.isSuccess()).isTrue();
        assertThat(r.getFindings()).containsExactly("A*B", "C%D\nE");
        assertThat(r.getRawAckMessage()).contains("MSA*AA*MSG009412");
    }
    @Test void acceptsOrderWithoutResultsAndDoesNotInventAccessionOrModality() {
        var r = parser.parseMessage((HEADER + PATIENT + "OBR|1|ORD-9182||CBC^Blood count\r").replace("ORU^R01", "ORM^O01"));
        assertThat(r.isSuccess()).isTrue();
        assertThat(r.getAccessionNumber()).isEmpty();
        assertThat(r.getModality()).isNull();
        assertThat(r.getFindings()).isEmpty();
        assertThat(r.getRawAckMessage()).contains("ACK^O01");
    }
    @Test void doesNotMistakeMrsaForAnMrModality() {
        var r = parser.parseMessage((HEADER + PATIENT + "OBR|1|ORD-9182||MRSA^MRSA culture\r").replace("ORU^R01", "ORM^O01"));
        assertThat(r.isSuccess()).isTrue();
        assertThat(r.getModality()).isNull();
    }
    @Test void rejectsMultiplePatientsOrOrdersRatherThanMerging() {
        assertThat(parser.parseMessage(MESSAGE + PATIENT + ORDER).isSuccess()).isFalse();
        assertThat(parser.parseMessage(MESSAGE + ORDER + OBSERVATIONS).isSuccess()).isFalse();
    }
    @Test void rejectsMissingIdentityAndObservationsAndInvalidDate() {
        assertThat(parser.parseMessage(MESSAGE.replace("MRN-449102", "")).isSuccess()).isFalse();
        assertThat(parser.parseMessage(HEADER + PATIENT + ORDER).isSuccess()).isFalse();
        assertThat(parser.parseMessage(MESSAGE.replace("19780412", "19780230")).isSuccess()).isFalse();
    }
    @Test void rejectsNumericObxAndCorrelatesNegativeAck() {
        var r = parser.parseMessage(MESSAGE.replace("|TX|", "|NM|"));
        assertThat(r.isSuccess()).isFalse();
        assertThat(r.getRawAckMessage()).contains("MSA|AR|MSG009412");
    }
    @Test void rejectsBrokenDelimitersWithoutFabricatingAck() {
        var r = parser.parseMessage(MESSAGE.replace("^~\\&", "^^^^"));
        assertThat(r.isSuccess()).isFalse();
        assertThat(r.getRawAckMessage()).isNull();
    }
    @ParameterizedTest @ValueSource(strings = {"", "PID|1", "\u000bMSH|^~\\&", "junk", "MSH|^^^^"})
    void rejectsMalformedInput(String input) { assertThat(parser.parseMessage(input).isSuccess()).isFalse(); }
    @Test void rejectsUnsupportedTypeVersionEscapesAndBatches() {
        assertThat(parser.parseMessage(MESSAGE.replace("ORU^R01", "ADT^A01")).isSuccess()).isFalse();
        assertThat(parser.parseMessage(MESSAGE.replace("2.5.1", "9.9")).isSuccess()).isFalse();
        assertThat(parser.parseMessage(MESSAGE.replace("Lungs clear.", "\\Zcustom\\")).isSuccess()).isFalse();
        assertThat(parser.parseMessage(MESSAGE + MESSAGE).isSuccess()).isFalse();
        assertThat(parser.parseMessage("x".repeat(262145)).isSuccess()).isFalse();
        assertThat(parser.parseMessage(null).isSuccess()).isFalse();
    }
}
