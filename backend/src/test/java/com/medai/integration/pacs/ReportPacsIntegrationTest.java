package com.medai.integration.pacs;

import com.medai.BaseIntegrationTest;
import com.medai.auth.security.JwtService;
import com.medai.integration.pacs.service.OrthancStudyService;
import com.medai.tenant.TenantContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.http.MediaType;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class ReportPacsIntegrationTest extends BaseIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired JwtService jwt;
    @Autowired ObjectMapper mapper;
    @MockBean OrthancStudyService studies;
    @AfterEach void clear() { TenantContext.clear(); }
    @Test void persistsLinksEnforcesRolesAndTenantsAndUnlinks() throws Exception {
        UUID tenant=UUID.randomUUID(), user=UUID.randomUUID(), patient=UUID.randomUUID(), connector=UUID.randomUUID();
        jdbc.update("INSERT INTO tenants(id,name,subdomain,contact_email) VALUES (?,'Pacs Link Test',?,'test@example.test')", tenant, "pacs-link-"+tenant);
        TenantContext.setCurrentTenantId(tenant);
        jdbc.update("INSERT INTO users(id,tenant_id,email,password_hash,first_name,last_name,role) VALUES (?,?,?,'x','Test','Admin','HOSPITAL_ADMIN')",user,tenant,user+"@example.test");
        jdbc.update("INSERT INTO patients(id,tenant_id,medical_record_number,first_name,last_name,date_of_birth,gender) VALUES (?,?,?,'Synthetic','Patient',DATE '1980-01-01','OTHER')",patient,tenant,"PACS-"+patient);
        jdbc.update("INSERT INTO pacs_connectors(id,tenant_id,name,type,status,viewer_url) VALUES (?,?,'Test','ORTHANC','CONNECTED','https://pacs.example.test/ohif/viewer')",connector,tenant);
        String admin=jwt.generateAccessToken(user,tenant,user+"@example.test","HOSPITAL_ADMIN");
        String doctor=jwt.generateAccessToken(user,tenant,user+"@example.test","DOCTOR");
        String other=jwt.generateAccessToken(UUID.randomUUID(),UUID.randomUUID(),"other@example.test","HOSPITAL_ADMIN");
        TenantContext.clear();
        var created=mvc.perform(post("/api/reports/text-draft").header("Authorization","Bearer "+admin).contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of("patientId",patient,"reportText","Synthetic findings for PACS testing.","modality","XRAY","studyDescription","Synthetic chest"))))
                .andExpect(status().isCreated()).andReturn();
        String id=mapper.readTree(created.getResponse().getContentAsString()).at("/data/id").asText();
        String path="/api/reports/"+id+"/pacs", study="12345678-12345678-12345678-12345678-12345678";
        when(studies.study(connector,study)).thenReturn(new OrthancStudyService.Study(study,"1.2.3","ACC","20260924","Chest","P1","Synthetic",1));
        String payload=mapper.writeValueAsString(Map.of("connectorId",connector,"studyId",study,"patientConfirmed",true));
        mvc.perform(put(path).header("Authorization","Bearer "+doctor).contentType(MediaType.APPLICATION_JSON).content(payload)).andExpect(status().isForbidden());
        mvc.perform(put(path).header("Authorization","Bearer "+other).contentType(MediaType.APPLICATION_JSON).content(payload)).andExpect(status().isNotFound());
        mvc.perform(put(path).header("Authorization","Bearer "+admin).contentType(MediaType.APPLICATION_JSON).content(payload)).andExpect(status().isOk()).andExpect(jsonPath("$.data.studyInstanceUid").value("1.2.3"));
        mvc.perform(get(path).header("Authorization","Bearer "+doctor)).andExpect(status().isOk()).andExpect(jsonPath("$.data.studyId").value(study));
        mvc.perform(post(path+"/launch").header("Authorization","Bearer "+doctor)).andExpect(status().isOk()).andExpect(jsonPath("$.data.viewerUrl").value("https://pacs.example.test/ohif/viewer?StudyInstanceUIDs=1.2.3"));
        mvc.perform(get(path).header("Authorization","Bearer "+other)).andExpect(status().isNotFound());
        TenantContext.setCurrentTenantId(tenant);
        assertThat(jdbc.queryForObject("SELECT draft_content FROM report_reviews WHERE id=?",String.class,UUID.fromString(id))).isEqualTo("Synthetic findings for PACS testing.");
        TenantContext.clear();
        mvc.perform(delete(path).header("Authorization","Bearer "+admin)).andExpect(status().isOk());
        mvc.perform(post(path+"/launch").header("Authorization","Bearer "+doctor)).andExpect(status().isBadRequest());
    }
}
