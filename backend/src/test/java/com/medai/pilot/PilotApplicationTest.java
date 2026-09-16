package com.medai.pilot;
import com.medai.BaseIntegrationTest;
import com.medai.auth.security.JwtService;
import com.medai.tenant.TenantContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.context.TestPropertySource;
import org.springframework.http.MediaType;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@TestPropertySource(properties="app.pilot.reviewer-user-ids=11111111-1122-4433-8844-111111111111")
class PilotApplicationTest extends BaseIntegrationTest {
 @Autowired MockMvc mvc;@Autowired JdbcTemplate jdbc;@Autowired JwtService jwt;@Autowired ObjectMapper mapper;
 static final UUID USER=UUID.fromString("11111111-1122-4433-8844-111111111111"),TENANT=UUID.fromString("22222222-1122-4433-8844-111111111111");
 static final AtomicInteger IPS=new AtomicInteger();
 @AfterEach void clear(){TenantContext.clear();}
 String reviewer(){
  TenantContext.clear();jdbc.update("INSERT INTO tenants(id,name,subdomain,contact_email) VALUES (?,'Pilot operator','pilot-operator','operator@example.test') ON CONFLICT(id) DO NOTHING",TENANT);
  TenantContext.setCurrentTenantId(TENANT);
  jdbc.update("INSERT INTO users(id,tenant_id,email,password_hash,first_name,last_name,role) VALUES (?,?,'operator@example.test','x','Pilot','Operator','HOSPITAL_ADMIN') ON CONFLICT(id) DO NOTHING",USER,TENANT);
  TenantContext.clear();return jwt.generateAccessToken(USER,TENANT,"operator@example.test","HOSPITAL_ADMIN");
 }
 Map<String,Object> application(){return new HashMap<>(Map.ofEntries(Map.entry("submissionId",UUID.randomUUID()),Map.entry("centreName","Synthetic Centre"),Map.entry("contactName","Test Contact"),Map.entry("email","test@example.test"),Map.entry("location","Test City"),Map.entry("reportingSoftware","Test RIS 1.0"),Map.entry("monthlyReportVolume",2500),Map.entry("teamSize",8),Map.entry("mainProblem","Repeated manual report entry"),Map.entry("integrationNeeds","HL7 from Test RIS"),Map.entry("contactConsent",true)));}
 org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder postApplication(Map<String,Object> p,String ip)throws Exception{
  return post("/api/public/pilot-applications").with(r->{r.setRemoteAddr(ip);return r;}).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(p));
 }
 @Test void anonymousSubmissionEncryptedAndRetrySafeThenReviewerCanQualify()throws Exception{
  String token=reviewer(),ip="192.0.2."+IPS.incrementAndGet();var p=application();
  for(int i=0;i<2;i++)mvc.perform(postApplication(p,ip)).andExpect(status().isOk()).andExpect(jsonPath("$.data.reference").value(p.get("submissionId").toString())).andExpect(jsonPath("$.data.email").doesNotExist());
  assertThat(jdbc.queryForObject("SELECT count(*) FROM pilot_applications WHERE id=?",Integer.class,p.get("submissionId"))).isEqualTo(1);
  assertThat(jdbc.queryForObject("SELECT encrypted_application FROM pilot_applications WHERE id=?",String.class,p.get("submissionId"))).doesNotContain("test@example.test","Repeated manual");
  mvc.perform(get("/api/pilot-applications").header("Authorization","Bearer "+token)).andExpect(status().isOk()).andExpect(jsonPath("$.data[0].application.reportingSoftware").value("Test RIS 1.0"));
  mvc.perform(patch("/api/pilot-applications/"+p.get("submissionId")+"/status").header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"QUALIFIED\"}")).andExpect(status().isOk());
  assertThat(jdbc.queryForObject("SELECT status FROM pilot_applications WHERE id=?",String.class,p.get("submissionId"))).isEqualTo("QUALIFIED");
  p.put("email","different@example.test");mvc.perform(postApplication(p,ip)).andExpect(status().isBadRequest());
 }
 @Test void deniesAnonymousAndOrdinaryHospitalAdminsAccess()throws Exception{
  mvc.perform(get("/api/pilot-applications")).andExpect(status().isUnauthorized());
  String other=jwt.generateAccessToken(UUID.randomUUID(),UUID.randomUUID(),"admin@example.test","HOSPITAL_ADMIN");
  mvc.perform(get("/api/pilot-applications/access").header("Authorization","Bearer "+other)).andExpect(status().isOk()).andExpect(jsonPath("$.data").value(false));
  mvc.perform(get("/api/pilot-applications").header("Authorization","Bearer "+other)).andExpect(status().isForbidden());
  mvc.perform(patch("/api/pilot-applications/"+UUID.randomUUID()+"/status").header("Authorization","Bearer "+other).contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"CONTACTED\"}")).andExpect(status().isForbidden());
  String doctor=jwt.generateAccessToken(USER,TENANT,"doctor@example.test","DOCTOR");
  mvc.perform(get("/api/pilot-applications").header("Authorization","Bearer "+doctor)).andExpect(status().isForbidden());
 }
 @Test void validatesContactConsentEmailAndVolume()throws Exception{
  String ip="192.0.2."+IPS.incrementAndGet();var p=application();p.put("contactConsent",false);
  mvc.perform(postApplication(p,ip)).andExpect(status().isBadRequest());p.put("contactConsent",true);p.put("email","invalid");
  mvc.perform(postApplication(p,ip)).andExpect(status().isBadRequest());p.put("email","test@example.test");p.put("monthlyReportVolume",0);
  mvc.perform(postApplication(p,ip)).andExpect(status().isBadRequest());
 }
 @Test void throttlesPublicSubmissions()throws Exception{
  String ip="192.0.2."+IPS.incrementAndGet();var p=application();
  for(int i=0;i<5;i++)mvc.perform(postApplication(p,ip)).andExpect(status().isOk());
  mvc.perform(postApplication(p,ip)).andExpect(status().isTooManyRequests());
 }
}
