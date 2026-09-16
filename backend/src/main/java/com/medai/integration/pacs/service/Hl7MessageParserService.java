package com.medai.integration.pacs.service;

import com.medai.integration.pacs.dto.Hl7ParseResultDto;
import org.springframework.stereotype.Service;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Pattern;

/** A bounded single-patient/single-order ORU/ORM text-report parser, not a general HL7 engine. */
@Service
public class Hl7MessageParserService {
    public Hl7ParseResultDto parseMessage(String input) {
        var result = Hl7ParseResultDto.builder().success(false).findings(List.of()).impression(List.of()).build();
        String[] msh = null;
        boolean validDelimiters = false;
        char separator = '|';
        String enc = "^~\\&";
        try {
            if (input == null || input.isBlank() || input.length() > 262144)
                throw new IllegalArgumentException("Message must contain 1–262144 characters.");
            String raw = input;
            if (raw.startsWith("\u000b")) {
                if (!raw.endsWith("\u001c\r")) throw new IllegalArgumentException("Incomplete MLLP frame.");
                raw = raw.substring(1, raw.length() - 2);
            }
            if (raw.indexOf('\u000b') >= 0 || raw.indexOf('\u001c') >= 0)
                throw new IllegalArgumentException("Only one complete message/frame is supported.");
            if (!raw.startsWith("MSH") || raw.length() < 8) throw new IllegalArgumentException("MSH must be the first segment.");
            separator = raw.charAt(3);
            String[] lines = raw.split("\\r\\n|\\r|\\n");
            msh = split(lines[0], separator);
            enc = field(msh, 1);
            if (enc.length() != 4 || (enc + separator).chars().distinct().count() != 5
                    || (enc + separator).chars().anyMatch(c -> c < 33 || c > 126 || Character.isLetterOrDigit(c)))
                throw new IllegalArgumentException("Invalid HL7 encoding delimiters.");
            validDelimiters = true;
            String[] type = split(field(msh, 8), enc.charAt(0));
            result.setMessageType(field(msh, 8));
            result.setMessageControlId(field(msh, 9));
            result.setSendingFacility(field(msh, 3));
            if (field(msh, 9).isBlank()) throw new IllegalArgumentException("MSH-10 message control ID is required.");
            if (!Set.of("2.3", "2.3.1", "2.4", "2.5", "2.5.1", "2.6").contains(field(msh, 11)))
                throw new IllegalArgumentException("Unsupported HL7 version.");
            if (!Set.of("P", "T", "D").contains(field(msh, 10))) throw new IllegalArgumentException("Invalid processing ID.");
            if (type.length < 2 || !(type[0].equals("ORU") && type[1].equals("R01") || type[0].equals("ORM") && type[1].equals("O01")))
                throw new IllegalArgumentException("Only ORU^R01 and ORM^O01 are supported.");
            int pids = 0, orders = 0;
            List<String> findings = new ArrayList<>(), impressions = new ArrayList<>();
            for (int index = 1; index < lines.length; index++) {
                if (lines[index].isBlank()) continue;
                String[] f = split(lines[index], separator);
                switch (f[0]) {
                    case "MSH", "FHS", "BHS", "BTS", "FTS" -> throw new IllegalArgumentException("Batch/multiple messages are not supported.");
                    case "PID" -> {
                        if (++pids != 1 || orders > 0) throw new IllegalArgumentException("Exactly one patient preceding the order is supported.");
                        String identifier = split(field(f, 3), enc.charAt(1))[0];
                        result.setPatientMrn(component(identifier, enc.charAt(0), 0));
                        result.setPatientIdentifierAuthority(component(identifier, enc.charAt(0), 3));
                        String name = split(field(f, 5), enc.charAt(1))[0];
                        result.setPatientName((component(name, enc.charAt(0), 1) + " " + component(name, enc.charAt(0), 0)).trim());
                        result.setSex(field(f, 8));
                        if (!field(f, 7).isBlank()) {
                            if (!field(f, 7).matches("[0-9]{8}")) throw new IllegalArgumentException("This profile requires a full YYYYMMDD birth date when provided.");
                            result.setDateOfBirth(LocalDate.parse(field(f, 7), DateTimeFormatter.BASIC_ISO_DATE).toString());
                        }
                    }
                    case "OBR" -> {
                        if (pids != 1 || ++orders != 1) throw new IllegalArgumentException("Exactly one OBR per patient is supported; split multi-order messages upstream.");
                        result.setAccessionNumber(component(field(f, 3), enc.charAt(0), 0));
                        result.setPlacerOrderNumber(component(field(f, 2), enc.charAt(0), 0));
                        String description = component(field(f, 4), enc.charAt(0), 1);
                        result.setStudyDescription(description.isBlank() ? component(field(f, 4), enc.charAt(0), 0) : description);
                        // OBR-24 is diagnostic service section, not a guaranteed imaging modality.
                        result.setDiagnosticServiceSection(field(f, 24));
                        String desc = result.getStudyDescription().toUpperCase(Locale.ROOT);
                        result.setModality(desc.matches("^CT(?:\\s.*)?$") ? "CT" : desc.matches("^(?:MR|MRI)(?:\\s.*)?$") ? "MR"
                                : desc.startsWith("US ") || desc.startsWith("ULTRASOUND") ? "US"
                                : desc.startsWith("XR") || desc.startsWith("X-RAY") ? "XR" : null);
                    }
                    case "OBX" -> {
                        if (orders != 1) throw new IllegalArgumentException("OBX must follow OBR.");
                        if (!Set.of("TX", "FT", "ST").contains(field(f, 2))) throw new IllegalArgumentException("Only text OBX types TX, FT and ST are supported by this report profile.");
                        String label = field(f, 3).toUpperCase(Locale.ROOT);
                        for (String value : split(field(f, 5), enc.charAt(1))) {
                            if (!value.isBlank()) (label.contains("IMPRESSION") ? impressions : findings).add(unescape(value, separator, enc));
                        }
                    }
                    case "ORC", "PV1", "NTE" -> { /* Not interpreted by this profile; original input stays in the sandbox. */ }
                    default -> throw new IllegalArgumentException("Unsupported segment in this text-report profile.");
                }
            }
            if (pids != 1 || orders != 1 || result.getPatientMrn() == null || result.getPatientMrn().isBlank())
                throw new IllegalArgumentException("PID-3 and one OBR are required.");
            if (type[0].equals("ORU") && findings.isEmpty() && impressions.isEmpty())
                throw new IllegalArgumentException("ORU report requires at least one nonempty text observation.");
            result.setFindings(findings); result.setImpression(impressions); result.setSuccess(true);
            result.setParseNotes("Validated text-report profile only. No patient record, order or report was saved. ACK below is a preview, not a delivery acknowledgement.");
        } catch (RuntimeException e) {
            result.setSuccess(false);
            result.setParseNotes(e instanceof java.time.DateTimeException ? "Invalid birth date." : e.getMessage());
        }
        if (validDelimiters && msh != null && !field(msh, 9).isBlank()) {
            String trigger = component(field(msh, 8), enc.charAt(0), 1);
            String ack = String.join(String.valueOf(separator), "MSH", enc, field(msh, 4), field(msh, 5),
                    field(msh, 2), field(msh, 3), OffsetDateTime.now(ZoneOffset.UTC).format(DateTimeFormatter.ofPattern("yyyyMMddHHmmssZ")), "",
                    "ACK" + enc.charAt(0) + trigger, UUID.randomUUID().toString(), field(msh, 10), field(msh, 11)) + "\r"
                    + "MSA" + separator + (result.isSuccess() ? "AA" : "AR") + separator + field(msh, 9) + "\r";
            result.setRawAckMessage(ack);
            result.setMllpAckMessage("\u000b" + ack + "\u001c\r");
        }
        return result;
    }
    private String[] split(String value, char delimiter) { return value.split(Pattern.quote(String.valueOf(delimiter)), -1); }
    private String field(String[] values, int index) { return index < values.length ? values[index] : ""; }
    private String component(String value, char delimiter, int index) { return field(split(value, delimiter), index); }
    private String unescape(String value, char separator, String enc) {
        char escape = enc.charAt(2);
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < value.length(); i++) {
            if (value.charAt(i) != escape) { out.append(value.charAt(i)); continue; }
            int end = value.indexOf(escape, i + 1);
            if (end < 0) throw new IllegalArgumentException("Unterminated HL7 escape sequence.");
            String token = value.substring(i + 1, end);
            out.append(switch (token) {
                case "F" -> String.valueOf(separator); case "S" -> String.valueOf(enc.charAt(0));
                case "R" -> String.valueOf(enc.charAt(1)); case "E" -> String.valueOf(escape);
                case "T" -> String.valueOf(enc.charAt(3)); case ".br" -> "\n";
                case "H", "N" -> "";
                default -> throw new IllegalArgumentException("Unsupported HL7 escape sequence.");
            }); i = end;
        }
        return out.toString();
    }
}
