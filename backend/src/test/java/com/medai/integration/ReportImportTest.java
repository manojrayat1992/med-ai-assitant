package com.medai.integration;

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

class ReportImportTest extends BaseIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private JwtService jwtService;
    @Autowired private JdbcTemplate jdbcTemplate;

    @AfterEach
    void clearTenant() {
        TenantContext.clear();
    }

    @Test
    void importsReplayConflictAndTenantIsolation() throws Exception {
        var first = seedWorld();
        var second = seedWorld();
        TenantContext.clear();
        String body = payload(first.patientId(), "FINDINGS: Clear lungs.");
        var created = mockMvc.perform(post("/api/integrations/reports")
                .header("Authorization", "Bearer " + first.token())
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.duplicate").value(false))
                .andExpect(jsonPath("$.data.review.status").value("DRAFT")).andReturn();
        String id = objectMapper.readTree(created.getResponse().getContentAsString())
                .at("/data/review/id").asText();
        mockMvc.perform(post("/api/integrations/reports")
                .header("Authorization", "Bearer " + first.token())
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.duplicate").value(true))
                .andExpect(jsonPath("$.data.review.id").value(id));
        mockMvc.perform(post("/api/integrations/reports")
                .header("Authorization", "Bearer " + first.token())
                .contentType(MediaType.APPLICATION_JSON).content(payload(first.patientId(), "Changed")))
                .andExpect(status().isConflict());
        mockMvc.perform(get("/api/integrations/reports").param("sourceSystem", "pilot-ris")
                .param("externalReportId", "study-1-v1")
                .header("Authorization", "Bearer " + second.token()))
                .andExpect(status().isNotFound());
        mockMvc.perform(post("/api/integrations/reports")
                .header("Authorization", "Bearer " + second.token())
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isNotFound());
        // A failed patient lookup must roll back the reservation, allowing a corrected retry.
        mockMvc.perform(post("/api/integrations/reports")
                .header("Authorization", "Bearer " + second.token())
                .contentType(MediaType.APPLICATION_JSON).content(payload(second.patientId(), "Clear")))
                .andExpect(status().isCreated());
        mockMvc.perform(get("/api/integrations/reports").param("sourceSystem", "pilot-ris")
                .param("externalReportId", "study-1-v1")
                .header("Authorization", "Bearer " + first.token()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.id").value(id));
    }

    @Test
    void validatesInputAndDeniesPatientRole() throws Exception {
        var world = seedWorld();
        TenantContext.clear();
        mockMvc.perform(post("/api/integrations/reports")
                .header("Authorization", "Bearer " + world.token())
                .contentType(MediaType.APPLICATION_JSON).content(payload(world.patientId(), " ")))
                .andExpect(status().isBadRequest());
        String token = jwtService.generateAccessToken(UUID.randomUUID(), world.tenantId(),
                "patient@example.test", "PATIENT");
        mockMvc.perform(post("/api/integrations/reports")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(payload(world.patientId(), "Clear")))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/integrations/reports").param("sourceSystem", "pilot-ris")
                .param("externalReportId", "study-1-v1").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    void concurrentRetriesCreateOneDraftAndSignedResultCanBeRetrieved() throws Exception {
        var world = seedWorld();
        TenantContext.clear();
        String body = payload(world.patientId(), "FINDINGS: Clear lungs.");
        var start = new java.util.concurrent.CountDownLatch(1);
        try (var executor = java.util.concurrent.Executors.newFixedThreadPool(2)) {
            java.util.concurrent.Callable<MvcResult> submit = () -> {
                start.await();
                return mockMvc.perform(post("/api/integrations/reports")
                        .header("Authorization", "Bearer " + world.token())
                        .contentType(MediaType.APPLICATION_JSON).content(body)).andReturn();
            };
            var first = executor.submit(submit);
            var second = executor.submit(submit);
            start.countDown();
            var a = first.get(20, java.util.concurrent.TimeUnit.SECONDS);
            var b = second.get(20, java.util.concurrent.TimeUnit.SECONDS);
            org.junit.jupiter.api.Assertions.assertEquals(java.util.Set.of(200, 201),
                    java.util.Set.of(a.getResponse().getStatus(), b.getResponse().getStatus()));
            String id = objectMapper.readTree(a.getResponse().getContentAsString()).at("/data/review/id").asText();
            org.junit.jupiter.api.Assertions.assertEquals(id,
                    objectMapper.readTree(b.getResponse().getContentAsString()).at("/data/review/id").asText());
            mockMvc.perform(post("/api/reports/" + id + "/sign")
                    .header("Authorization", "Bearer " + world.token())
                    .contentType(MediaType.APPLICATION_JSON).content("{\"action\":\"ACCEPTED\"}"))
                    .andExpect(status().isOk());
            mockMvc.perform(get("/api/integrations/reports").param("sourceSystem", "pilot-ris")
                    .param("externalReportId", "study-1-v1")
                    .header("Authorization", "Bearer " + world.token()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.status").value("SIGNED"))
                    .andExpect(jsonPath("$.data.finalContent").value("FINDINGS: Clear lungs."));
        }
    }

    private String payload(UUID patient, String text) throws Exception {
        return objectMapper.writeValueAsString(new ReportImportService.ImportRequest(
                "pilot-ris", "study-1-v1", patient, text, null, null));
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
