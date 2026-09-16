package com.medai.report;
import com.medai.BaseIntegrationTest;
import com.medai.auth.security.JwtService;
import com.medai.tenant.TenantContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.http.MediaType;
import java.util.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class ReportFeedbackTest extends BaseIntegrationTest {
    @Autowired MockMvc mvc; @Autowired JdbcTemplate jdbc; @Autowired JwtService jwt; @Autowired ObjectMapper mapper;
    record World(UUID tenant, String token, String report) {}
    @AfterEach void clear(){TenantContext.clear();}
    World world() throws Exception {
        TenantContext.clear(); UUID tenant=UUID.randomUUID(), user=UUID.randomUUID(), patient=UUID.randomUUID();
        jdbc.update("INSERT INTO tenants(id,name,subdomain,contact_email) VALUES (?,'Feedback test',?,'feedback@example.test')",tenant,"feedback-"+tenant);
        TenantContext.setCurrentTenantId(tenant);
        jdbc.update("INSERT INTO users(id,tenant_id,email,password_hash,first_name,last_name,role) VALUES (?,?,?,'x','Test','Doctor','DOCTOR')",user,tenant,user+"@example.test");
        jdbc.update("INSERT INTO patients(id,tenant_id,medical_record_number,first_name,last_name,date_of_birth,gender) VALUES (?,?,?,'Synthetic','Case',DATE '1980-01-01','FEMALE')",patient,tenant,"MRN-"+patient);
        TenantContext.clear(); String token=jwt.generateAccessToken(user,tenant,user+"@example.test","DOCTOR");
        var response=mvc.perform(post("/api/reporting/drafts").header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON)
            .content(mapper.writeValueAsString(Map.of("patientId",patient,"modality","XRAY","studyDescription","Chest","reportText","FINDINGS\nOriginal saved narrative.\nIMPRESSION\nReview required."))))
            .andExpect(status().isCreated()).andReturn();
        return new World(tenant,token,mapper.readTree(response.getResponse().getContentAsString()).at("/data/id").asText());
    }
    Map<String,Object> payload() {return new HashMap<>(Map.of("submissionId",UUID.randomUUID(),"category","WRONG_SUGGESTION","originalSuggestion","Incorrect suggestion","explanation","The source contradicts this suggestion.","correction","Corrected wording for clinician review."));}
    @Test void persistsEncryptedFeedbackWithSnapshotAndIdempotentRetryWithoutChangingReport() throws Exception {
        var w=world(); var p=payload(); String url="/api/reports/"+w.report()+"/feedback";
        for(int i=0;i<2;i++) mvc.perform(post(url).header("Authorization","Bearer "+w.token()).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(p)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.content.correction").value(p.get("correction")))
            .andExpect(jsonPath("$.data.content.reportSnapshot").value(org.hamcrest.Matchers.containsString("Original saved narrative.")));
        mvc.perform(get(url).header("Authorization","Bearer "+w.token())).andExpect(status().isOk()).andExpect(jsonPath("$.data.length()").value(1));
        TenantContext.setCurrentTenantId(w.tenant());
        assertThat(jdbc.queryForObject("SELECT encrypted_content FROM report_feedback WHERE report_id=?",String.class,UUID.fromString(w.report()))).doesNotContain("Incorrect suggestion","Original saved narrative");
        assertThat(jdbc.queryForObject("SELECT draft_content FROM report_reviews WHERE id=?",String.class,UUID.fromString(w.report()))).contains("Original saved narrative.").doesNotContain("Corrected wording");
        TenantContext.clear(); p.put("correction","Changed content reusing old ID");
        mvc.perform(post(url).header("Authorization","Bearer "+w.token()).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(p))).andExpect(status().isBadRequest());
    }
    @Test void isolatesHospitalsAndRejectsPatientRole() throws Exception {
        var a=world(); var b=world(); String url="/api/reports/"+a.report()+"/feedback";
        mvc.perform(post(url).header("Authorization","Bearer "+a.token()).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(payload()))).andExpect(status().isOk());
        mvc.perform(get(url).header("Authorization","Bearer "+b.token())).andExpect(status().isNotFound());
        mvc.perform(post(url).header("Authorization","Bearer "+b.token()).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(payload()))).andExpect(status().isNotFound());
        TenantContext.setCurrentTenantId(b.tenant());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM report_feedback WHERE report_id=?",Integer.class,UUID.fromString(a.report()))).isZero();
        TenantContext.clear(); String patient=jwt.generateAccessToken(UUID.randomUUID(),a.tenant(),"patient@example.test","PATIENT");
        mvc.perform(get(url).header("Authorization","Bearer "+patient)).andExpect(status().isForbidden());
        mvc.perform(post(url).header("Authorization","Bearer "+patient).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(payload()))).andExpect(status().isForbidden());
    }
    @Test void validatesRequiredCorrectionAndWrongSuggestionQuote() throws Exception {
        var w=world(); var p=payload(); String url="/api/reports/"+w.report()+"/feedback";
        p.put("correction"," ");
        mvc.perform(post(url).header("Authorization","Bearer "+w.token()).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(p))).andExpect(status().isBadRequest());
        p.put("correction","A correction");p.put("originalSuggestion","");
        mvc.perform(post(url).header("Authorization","Bearer "+w.token()).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(p))).andExpect(status().isBadRequest());
        p.put("category","MISSED_FINDING");
        mvc.perform(post(url).header("Authorization","Bearer "+w.token()).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(p))).andExpect(status().isOk());
    }
}
