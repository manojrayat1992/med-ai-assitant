package com.medai.integration.pacs;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.medai.BaseIntegrationTest;
import com.medai.auth.security.JwtService;
import com.medai.compliance.crypto.AesGcmEncryptionService;
import com.medai.tenant.TenantContext;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import java.util.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@TestPropertySource(properties = "app.integrations.allowed-origins=http://127.0.0.1:8042")
class PacsConnectorControllerTest extends BaseIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired JwtService jwt;
    @Autowired JdbcTemplate jdbc;
    @Autowired AesGcmEncryptionService encryption;
    private static final String URL = "/api/integrations/connectors";
    @AfterEach void clear() { TenantContext.clear(); }
    private record Hospital(UUID id, String token) {}
    private Hospital hospital() {
        TenantContext.clear();
        UUID tenant = UUID.randomUUID(), admin = UUID.randomUUID();
        jdbc.update("INSERT INTO tenants(id,name,subdomain,contact_email) VALUES (?, 'Connector test', ?, 'pacs@example.test')", tenant, "pacs-" + tenant);
        TenantContext.setCurrentTenantId(tenant);
        String email = admin + "@example.test";
        jdbc.update("INSERT INTO users(id,tenant_id,email,password_hash,first_name,last_name,role) VALUES (?,?,?,'x','Test','Admin','HOSPITAL_ADMIN')", admin, tenant, email);
        TenantContext.clear();
        return new Hospital(tenant, jwt.generateAccessToken(admin, tenant, email, "HOSPITAL_ADMIN"));
    }
    @Test void savesEncryptedCredentialsReturnsNoSecretsAndEnforcesTenantOwnership() throws Exception {
        var a = hospital(); var b = hospital();
        mvc.perform(get(URL).header("Authorization", "Bearer " + a.token())).andExpect(status().isOk()).andExpect(jsonPath("$.data.length()").value(0));
        var payload = new HashMap<String,Object>(Map.of("name","Test Orthanc", "type","ORTHANC", "endpointUrl","http://127.0.0.1:8042", "username","test", "password","only-a-test-secret"));
        var saved = mvc.perform(post(URL).header("Authorization", "Bearer " + a.token()).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(payload)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("DISCONNECTED"))
                .andExpect(jsonPath("$.data.credentialsConfigured").value(true)).andReturn().getResponse().getContentAsString();
        assertThat(saved).doesNotContain("only-a-test-secret", "encryptedAuth", "Basic ");
        UUID id = UUID.fromString(mapper.readTree(saved).at("/data/id").asText());
        TenantContext.setCurrentTenantId(a.id());
        String stored = jdbc.queryForObject("SELECT encrypted_auth FROM pacs_connectors WHERE id=?", String.class, id);
        assertThat(stored).doesNotContain("only-a-test-secret");
        assertThat(encryption.decrypt(stored)).isEqualTo("Basic " + Base64.getEncoder().encodeToString("test:only-a-test-secret".getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        TenantContext.setCurrentTenantId(b.id());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM pacs_connectors WHERE id=?", Integer.class, id)).isZero();
        TenantContext.clear();
        mvc.perform(get(URL).header("Authorization", "Bearer " + b.token())).andExpect(status().isOk()).andExpect(jsonPath("$.data.length()").value(0));
        mvc.perform(post(URL + "/" + id + "/ping").header("Authorization", "Bearer " + b.token())).andExpect(status().isNotFound());
        payload.put("id", id);
        mvc.perform(post(URL).header("Authorization", "Bearer " + b.token()).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(payload))).andExpect(status().isNotFound());
        payload.remove("username"); payload.remove("password");
        mvc.perform(post(URL).header("Authorization", "Bearer " + a.token()).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(payload)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.credentialsConfigured").value(true));
        payload.put("clearCredentials", true);
        mvc.perform(post(URL).header("Authorization", "Bearer " + a.token()).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(payload)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.credentialsConfigured").value(false));
    }
    @Test void rejectsNonAdminUnapprovedDestinationAndInvalidCredentials() throws Exception {
        var a = hospital();
        String doctor = jwt.generateAccessToken(UUID.randomUUID(), a.id(), "doctor@example.test", "DOCTOR");
        mvc.perform(get(URL).header("Authorization", "Bearer " + doctor)).andExpect(status().isForbidden());
        mvc.perform(post(URL + "/hl7/parse").header("Authorization", "Bearer " + doctor).contentType(MediaType.APPLICATION_JSON).content("{\"rawMessage\":\"bad\"}")).andExpect(status().isForbidden());
        mvc.perform(post(URL).header("Authorization", "Bearer " + a.token()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Bad\",\"type\":\"ORTHANC\",\"endpointUrl\":\"http://169.254.169.254\"}")).andExpect(status().isBadRequest());
        mvc.perform(post(URL).header("Authorization", "Bearer " + a.token()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Bad\",\"type\":\"ORTHANC\",\"endpointUrl\":\"http://127.0.0.1:8042\",\"password\":\"orphan\"}")).andExpect(status().isBadRequest());
    }
    @Test void unavailableAdapterDoesNotReportSuccessfulSyncOrConnection() throws Exception {
        var a = hospital();
        var response = mvc.perform(post(URL).header("Authorization", "Bearer " + a.token()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Unconfigured PowerScribe\",\"type\":\"POWERSCRIBE_360\"}")).andExpect(status().isOk()).andReturn();
        String id = mapper.readTree(response.getResponse().getContentAsString()).at("/data/id").asText();
        mvc.perform(post(URL + "/" + id + "/ping").header("Authorization", "Bearer " + a.token()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("DISCONNECTED"));
        mvc.perform(post(URL + "/powerscribe/sync").header("Authorization", "Bearer " + a.token()).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isNotImplemented()).andExpect(jsonPath("$.success").value(false));
    }
}
