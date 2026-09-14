package com.medai.report;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.medai.BaseIntegrationTest;
import com.medai.auth.security.JwtService;
import com.medai.tenant.TenantContext;
import com.medai.user.enums.UserRole;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ReportingControllerTest extends BaseIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private JwtService jwtService;
    @Autowired private JdbcTemplate jdbcTemplate;

    @AfterEach
    void clearTenant() {
        TenantContext.clear();
    }

    @Test
    void templatePersistsAndAuthoredReportEntersWorklist() throws Exception {
        var world = seedWorld();
        TenantContext.clear();
        String template = "{\"name\":\"Chest structure\",\"modality\":\"XRAY\",\"body\":\"FINDINGS\\n\\nIMPRESSION\\n\"}";
        var result = mockMvc.perform(post("/api/reporting/templates")
                .header("Authorization", "Bearer " + world.token())
                .contentType(MediaType.APPLICATION_JSON).content(template))
                .andExpect(status().isCreated()).andReturn();
        String templateId = objectMapper.readTree(result.getResponse().getContentAsString()).at("/data/id").asText();
        mockMvc.perform(get("/api/reporting/templates").header("Authorization", "Bearer " + world.token()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data[0].id").value(templateId));
        String payload = objectMapper.writeValueAsString(java.util.Map.of("patientId", world.patientId(),
                "modality", "XRAY", "studyDescription", "Chest", "reportText", "FINDINGS\nClear lungs.\nIMPRESSION\nNo acute abnormality."));
        var draft = mockMvc.perform(post("/api/reporting/drafts")
                .header("Authorization", "Bearer " + world.token())
                .contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.data.status").value("DRAFT")).andReturn();
        String id = objectMapper.readTree(draft.getResponse().getContentAsString()).at("/data/id").asText();
        mockMvc.perform(get("/api/reports/worklist").header("Authorization", "Bearer " + world.token()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.content[0].id").value(id));
        mockMvc.perform(post("/api/reports/" + id + "/sign").header("Authorization", "Bearer " + world.token())
                .contentType(MediaType.APPLICATION_JSON).content("{\"action\":\"ACCEPTED\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("SIGNED"));
        var other = seedWorld();
        TenantContext.clear();
        mockMvc.perform(get("/api/reporting/templates").header("Authorization", "Bearer " + other.token()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.length()").value(0));
        mockMvc.perform(post("/api/reporting/drafts").header("Authorization", "Bearer " + other.token())
                .contentType(MediaType.APPLICATION_JSON).content(payload)).andExpect(status().isNotFound());
    }

    @Test
    void rejectsBlankTemplatesAndPatientRole() throws Exception {
        var world = seedWorld();
        TenantContext.clear();
        mockMvc.perform(post("/api/reporting/templates").header("Authorization", "Bearer " + world.token())
                .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\" \",\"body\":\" \",\"modality\":\"XRAY\"}"))
                .andExpect(status().isBadRequest());
        String token = jwtService.generateAccessToken(UUID.randomUUID(), world.tenantId(), "patient@test.test", "PATIENT");
        mockMvc.perform(get("/api/reporting/templates").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    private SeededWorld seedWorld() {
        UUID tenantId = UUID.randomUUID();
        jdbcTemplate.update("""
                INSERT INTO tenants (id, name, subdomain, contact_email)
                VALUES (?, 'Text Draft Hospital', ?, 'text@example.test')
                """, tenantId, "text-" + tenantId.toString().substring(0, 8));
        TenantContext.setCurrentTenantId(tenantId);

        UUID doctorId = UUID.randomUUID();
        String email = "doc-" + doctorId + "@textdraft.test";
        jdbcTemplate.update("""
                INSERT INTO users (id, tenant_id, email, password_hash, first_name, last_name, role)
                VALUES (?, ?, ?, 'x', 'Mira', 'Patel', 'DOCTOR')
                """, doctorId, tenantId, email);

        UUID patientId = UUID.randomUUID();
        jdbcTemplate.update("""
                INSERT INTO patients (id, tenant_id, medical_record_number, first_name, last_name, date_of_birth, gender)
                VALUES (?, ?, ?, 'Asha', 'Menon', DATE '1979-04-12', 'FEMALE')
                """, patientId, tenantId, "MRN-" + patientId.toString().substring(0, 8));

        String token = jwtService.generateAccessToken(doctorId, tenantId, email, UserRole.DOCTOR.name());
        return new SeededWorld(tenantId, patientId, token);
    }

    private record SeededWorld(UUID tenantId, UUID patientId, String token) {
    }

}
