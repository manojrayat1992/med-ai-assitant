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

class ReportControllerTextDraftTest extends BaseIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private JwtService jwtService;
    @Autowired private JdbcTemplate jdbcTemplate;

    @AfterEach
    void clearTenant() {
        TenantContext.clear();
    }

    @Test
    @DisplayName("POST /api/reports/text-draft creates a draft review rather than matching /{reviewId}")
    void textDraftRouteIsRegisteredBeforeReviewIdRoute() throws Exception {
        SeededWorld seeded = seedWorld();
        String reportText = "FINDINGS:\nRight lower lobe opacity.\n\nIMPRESSION:\nPneumonia.";
        String request = objectMapper.writeValueAsString(new TextDraftPayload(
                seeded.patientId(), reportText, "XRAY", "Portable chest radiograph"));

        TenantContext.clear();

        MvcResult result = mockMvc.perform(post("/api/reports/text-draft")
                        .header("Authorization", "Bearer " + seeded.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").exists())
                .andExpect(jsonPath("$.data.patientId").value(seeded.patientId().toString()))
                .andExpect(jsonPath("$.data.patientName").value("Asha Menon"))
                .andExpect(jsonPath("$.data.analysisType").value("IMAGE_ANALYSIS"))
                .andExpect(jsonPath("$.data.status").value("DRAFT"))
                .andExpect(jsonPath("$.data.draftContent").value(reportText))
                .andExpect(jsonPath("$.data.sections[0].section").value("FINDINGS"))
                .andExpect(jsonPath("$.data.sections[0].text").value("Right lower lobe opacity."))
                .andExpect(jsonPath("$.data.sections[1].section").value("IMPRESSION"))
                .andExpect(jsonPath("$.data.sections[1].text").value("Pneumonia."))
                .andReturn();

        JsonNode data = objectMapper.readTree(result.getResponse().getContentAsString()).get("data");
        String reviewId = data.get("id").asText();

        mockMvc.perform(get("/api/reports/worklist")
                        .header("Authorization", "Bearer " + seeded.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].id").value(reviewId))
                .andExpect(jsonPath("$.data.content[0].status").value("DRAFT"));
    }

    @Test
    void textSourcesAreStoredAndReadFromS3AndLegacySourcesAreRecovered() throws Exception {
        SeededWorld seeded = seedWorld();
        String text = "FINDINGS: Right opacity. IMPRESSION: Review — café.";
        var result = mockMvc.perform(post("/api/reports/text-draft")
                .header("Authorization", "Bearer " + seeded.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new TextDraftPayload(seeded.patientId(), text, "XRAY", "Test"))))
                .andExpect(status().isCreated()).andReturn();
        UUID analysis = UUID.fromString(objectMapper.readTree(result.getResponse().getContentAsString()).at("/data/analysisId").asText());
        TenantContext.setCurrentTenantId(seeded.tenantId());
        UUID file = jdbcTemplate.queryForObject("SELECT medical_file_id FROM analysis_requests WHERE id=?", UUID.class, analysis);
        String path = jdbcTemplate.queryForObject("SELECT storage_path FROM medical_files WHERE id=?", String.class, file);
        org.assertj.core.api.Assertions.assertThat(path).startsWith(seeded.tenantId() + "/patients/").doesNotContain("inline-report-text");
        TenantContext.clear();
        String endpoint = "/api/patients/" + seeded.patientId() + "/files/" + file;
        mockMvc.perform(get(endpoint + "/view").header("Authorization", "Bearer " + seeded.token()))
                .andExpect(status().isOk()).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.content().bytes(text.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        // Simulate a pre-fix row. The old source object does not exist at this pseudo-URI.
        TenantContext.setCurrentTenantId(seeded.tenantId());
        jdbcTemplate.update("UPDATE medical_files SET storage_path=?, file_size_bytes=1 WHERE id=?", "inline-report-text://" + UUID.randomUUID(), file);
        TenantContext.clear();
        org.mockito.Mockito.clearInvocations(testObjectStorage);
        mockMvc.perform(get(endpoint + "/download").header("Authorization", "Bearer " + seeded.token()))
                .andExpect(status().isOk()).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.content().bytes(text.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        org.mockito.Mockito.verify(testObjectStorage).store(org.mockito.ArgumentMatchers.eq(seeded.tenantId()), org.mockito.ArgumentMatchers.eq(seeded.patientId()), org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.any());
        org.mockito.Mockito.verify(testObjectStorage).retrieve(org.mockito.ArgumentMatchers.startsWith(seeded.tenantId() + "/patients/"));
        org.mockito.Mockito.clearInvocations(testObjectStorage);
        mockMvc.perform(get(endpoint + "/view").header("Authorization", "Bearer " + seeded.token())).andExpect(status().isOk());
        org.mockito.Mockito.verify(testObjectStorage, org.mockito.Mockito.never()).store(org.mockito.ArgumentMatchers.any(),org.mockito.ArgumentMatchers.any(),org.mockito.ArgumentMatchers.anyString(),org.mockito.ArgumentMatchers.any());
        mockMvc.perform(get("/api/patients/" + UUID.randomUUID() + "/files/" + file + "/view")
                .header("Authorization", "Bearer " + seeded.token())).andExpect(status().isNotFound());
    }

    @Test
    void failedS3WriteDoesNotCreateAnInlineOrSuccessfulReport() throws Exception {
        var seeded = seedWorld();
        org.mockito.Mockito.doThrow(new com.medai.upload.service.StorageException("S3 unavailable"))
                .when(testObjectStorage).store(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.any());
        mockMvc.perform(post("/api/reports/text-draft")
                .header("Authorization", "Bearer " + seeded.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new TextDraftPayload(seeded.patientId(), "Synthetic report", "XRAY", "Test"))))
                .andExpect(status().is5xxServerError());
        TenantContext.setCurrentTenantId(seeded.tenantId());
        org.assertj.core.api.Assertions.assertThat(jdbcTemplate.queryForObject(
                "SELECT count(*) FROM medical_files WHERE tenant_id=?", Integer.class, seeded.tenantId())).isZero();
        org.assertj.core.api.Assertions.assertThat(jdbcTemplate.queryForObject(
                "SELECT count(*) FROM report_reviews WHERE tenant_id=?", Integer.class, seeded.tenantId())).isZero();
    }

    @Test
    void anatomyFindingsAreTenantScopedAndUseSignedContent() throws Exception {
        var owner = seedWorld();
        var result = mockMvc.perform(post("/api/reports/text-draft")
                .header("Authorization", "Bearer " + owner.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new TextDraftPayload(owner.patientId(),
                        "FINDINGS: A 6 mm nodule in the right lung.", "XRAY", "Atlas test"))))
                .andExpect(status().isCreated()).andReturn();
        UUID id = UUID.fromString(objectMapper.readTree(result.getResponse().getContentAsString()).at("/data/id").asText());
        String url = "/api/reports/" + id + "/anatomy-findings";
        mockMvc.perform(get(url).header("Authorization", "Bearer " + owner.token()))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.data[0].anatomyTarget.structureCode").value("LUNG"))
                .andExpect(jsonPath("$.data[0].anatomyTarget.side").value("RIGHT"));
        var other = seedWorld();
        mockMvc.perform(get(url).header("Authorization", "Bearer " + other.token()))
                .andExpect(status().isNotFound());
        TenantContext.setCurrentTenantId(owner.tenantId());
        jdbcTemplate.update("UPDATE report_reviews SET status='SIGNED', review_action='ACCEPTED', signed_at=now(), signed_by=(SELECT id FROM users WHERE tenant_id=report_reviews.tenant_id LIMIT 1), final_content=? WHERE id=?",
                "FINDINGS: A 7 mm nodule in the left lung.", id);
        TenantContext.clear();
        mockMvc.perform(get(url).header("Authorization", "Bearer " + owner.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].anatomyTarget.side").value("LEFT"));
        mockMvc.perform(get(url)).andExpect(status().isUnauthorized());
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

    private record TextDraftPayload(UUID patientId, String reportText, String modality,
                                    String studyDescription) {
    }
}
