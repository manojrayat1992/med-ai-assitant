package com.medai.pilot;
import com.medai.BaseIntegrationTest;
import com.medai.auth.security.JwtService;
import com.medai.tenant.TenantContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.http.MediaType;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
class PilotResultsTest extends BaseIntegrationTest {
 @Autowired MockMvc mvc;@Autowired JdbcTemplate jdbc;@Autowired JwtService jwt;@Autowired ObjectMapper mapper;
 record World(UUID tenant,UUID user,String token,String report){}
 @AfterEach void clear(){TenantContext.clear();}
 World world()throws Exception{
  TenantContext.clear();UUID tenant=UUID.randomUUID(),user=UUID.randomUUID(),patient=UUID.randomUUID();
  jdbc.update("INSERT INTO tenants(id,name,subdomain,contact_email) VALUES (?,'Results test',?,'results@example.test')",tenant,"results-"+tenant);
  TenantContext.setCurrentTenantId(tenant);
  jdbc.update("INSERT INTO users(id,tenant_id,email,password_hash,first_name,last_name,role) VALUES (?,?,?,'x','Test','Doctor','DOCTOR')",user,tenant,user+"@example.test");
  jdbc.update("INSERT INTO patients(id,tenant_id,medical_record_number,first_name,last_name,date_of_birth,gender) VALUES (?,?,?,'Synthetic','Patient',DATE '1980-01-01','FEMALE')",patient,tenant,"MRN-"+patient);
  TenantContext.clear();String token=jwt.generateAccessToken(user,tenant,user+"@example.test","DOCTOR");
  var response=mvc.perform(post("/api/reporting/drafts").header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(Map.of("patientId",patient,"modality","XRAY","studyDescription","Shoulder","reportText","FINDINGS\nComminuted fracture involving the proximal right humerus.\nIMPRESSION\nComminuted fracture of the proximal left humerus.")))).andExpect(status().isCreated()).andReturn();
  return new World(tenant,user,token,mapper.readTree(response.getResponse().getContentAsString()).at("/data/id").asText());
 }
 String range(){LocalDate day=LocalDate.now(ZoneOffset.UTC);return "/api/pilot-results?from="+day.minusDays(6)+"&to="+day;}
 @Test void recordsRealQaAndLatestRatingAndExcludesOtherHospital()throws Exception{
  var a=world();var b=world();
  var response=mvc.perform(post("/api/reports/"+a.report()+"/qa").header("Authorization","Bearer "+a.token())).andExpect(status().isOk()).andReturn();
  var data=mapper.readTree(response.getResponse().getContentAsString()).path("data");String run=data.path("runId").asText(),issue=data.path("issues").get(0).path("id").asText();int alerts=data.path("issues").size();
  assertThat(run).isNotBlank();
  for(boolean useful:List.of(false,true,true))mvc.perform(put("/api/pilot-results/qa-runs/"+run+"/rating").header("Authorization","Bearer "+a.token()).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(Map.of("issueId",issue,"useful",useful)))).andExpect(status().isOk());
  mvc.perform(get(range()).header("Authorization","Bearer "+a.token())).andExpect(status().isOk()).andExpect(jsonPath("$.data.qa.runs").value(1)).andExpect(jsonPath("$.data.qa.alerts").value(alerts)).andExpect(jsonPath("$.data.qa.ratings").value(1)).andExpect(jsonPath("$.data.qa.useful").value(1)).andExpect(jsonPath("$.data.adoption.active").value(1));
  mvc.perform(put("/api/pilot-results/qa-runs/"+run+"/rating").header("Authorization","Bearer "+b.token()).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(Map.of("issueId",issue,"useful",true)))).andExpect(status().isNotFound());
  mvc.perform(get(range()).header("Authorization","Bearer "+b.token())).andExpect(status().isOk()).andExpect(jsonPath("$.data.qa.runs").value(0)).andExpect(jsonPath("$.data.reporting.median_minutes").isEmpty());
  TenantContext.setCurrentTenantId(b.tenant());assertThat(jdbc.queryForObject("SELECT count(*) FROM pilot_qa_runs WHERE id=?",Integer.class,UUID.fromString(run))).isZero();
 }
 @Test void measuresChangedDraftSavesAndElapsedSignoffWithoutInventingTiming()throws Exception{
  var w=world();String updated="FINDINGS\nRevised synthetic text.\nIMPRESSION\nReview required.";
  // The endpoint takes a draftContent body, matching the workspace save service.
  for(int i=0;i<2;i++)mvc.perform(put("/api/reports/"+w.report()+"/draft").header("Authorization","Bearer "+w.token()).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(Map.of("draftContent",updated)))).andExpect(status().isOk());
  TenantContext.setCurrentTenantId(w.tenant());
  Instant start=LocalDate.now(ZoneOffset.UTC).atStartOfDay(ZoneOffset.UTC).toInstant();
  jdbc.update("UPDATE report_reviews SET status='SIGNED',signed_by=?,review_action='EDITED',created_at=?,signed_at=? WHERE id=?",w.user(),java.sql.Timestamp.from(start),java.sql.Timestamp.from(start.plusSeconds(1800)),UUID.fromString(w.report()));
  TenantContext.clear();
  mvc.perform(get(range()).header("Authorization","Bearer "+w.token())).andExpect(status().isOk()).andExpect(jsonPath("$.data.editing.saves").value(1)).andExpect(jsonPath("$.data.reporting.median_minutes").value(30.0)).andExpect(jsonPath("$.data.reporting.timed").value(1)).andExpect(jsonPath("$.data.adoption.eligible").value(1));
  mvc.perform(get("/api/pilot-results?from=2000-01-01&to=2000-01-02").header("Authorization","Bearer "+w.token())).andExpect(status().isOk()).andExpect(jsonPath("$.data.editing.saves").value(0)).andExpect(jsonPath("$.data.reporting.median_minutes").isEmpty());
 }
 @Test void restrictsPatientAccessAndInvalidWindow()throws Exception{
  var w=world();String patient=jwt.generateAccessToken(UUID.randomUUID(),w.tenant(),"patient@example.test","PATIENT");
  mvc.perform(get(range()).header("Authorization","Bearer "+patient)).andExpect(status().isForbidden());
  mvc.perform(get("/api/pilot-results?from=2026-09-20&to=2026-09-01").header("Authorization","Bearer "+w.token())).andExpect(status().isBadRequest());
  mvc.perform(get("/api/pilot-results?from=2020-01-01&to=2026-01-01").header("Authorization","Bearer "+w.token())).andExpect(status().isBadRequest());
 }
}
