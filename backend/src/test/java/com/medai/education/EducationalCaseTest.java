package com.medai.education;
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

class EducationalCaseTest extends BaseIntegrationTest {
 @Autowired MockMvc mvc;@Autowired ObjectMapper mapper;@Autowired JdbcTemplate jdbc;@Autowired JwtService jwt;
 record World(UUID tenant,String doctor,String admin){}
 @AfterEach void clear(){TenantContext.clear();}
 World world(){
  TenantContext.clear();UUID tenant=UUID.randomUUID();jdbc.update("INSERT INTO tenants(id,name,subdomain,contact_email) VALUES (?,'Educational test',?,'test@example.test')",tenant,"education-"+tenant);
  TenantContext.setCurrentTenantId(tenant);UUID doctor=UUID.randomUUID(),admin=UUID.randomUUID();
  for(UUID id:List.of(doctor,admin))jdbc.update("INSERT INTO users(id,tenant_id,email,password_hash,first_name,last_name,role) VALUES (?,?,?,'x','Test','Reviewer',?)",id,tenant,id+"@example.test",id.equals(doctor)?"DOCTOR":"HOSPITAL_ADMIN");
  TenantContext.clear();return new World(tenant,jwt.generateAccessToken(doctor,tenant,doctor+"@example.test","DOCTOR"),jwt.generateAccessToken(admin,tenant,admin+"@example.test","HOSPITAL_ADMIN"));
 }
 Map<String,Object> content(){return new HashMap<>(Map.of("title","Synthetic reporting lesson","specialty","RADIOLOGY","scenario","Invented right-sided observation.","originalReport","Left-sided finding.","reportingIssue","Side mismatch.","explanation","The draft changes the supplied side.","correction","Right-sided finding.","syntheticOnly",true));}
 String create(World w)throws Exception{return mapper.readTree(mvc.perform(post("/api/educational-cases").header("Authorization","Bearer "+w.admin()).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(Map.of("content",content())))).andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).at("/data/id").asText();}
 org.springframework.test.web.servlet.ResultActions transition(String id,String operation,String token,Object body)throws Exception{return mvc.perform(post("/api/educational-cases/"+id+"/"+operation).header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(body)));}
 Map<String,Object> review(int version){return Map.of("version",version,"confirmed",true,"note","Reviewed synthetic facts and correction.");}
 @Test void onlyReviewedSnapshotsArePublicAndWithdrawalRemovesAccess()throws Exception{
  var w=world();String id=create(w);
  mvc.perform(get("/api/public/educational-cases/"+id)).andExpect(status().isNotFound());
  transition(id,"publish",w.admin(),Map.of("version",1)).andExpect(status().isBadRequest());
  transition(id,"review",w.admin(),review(1)).andExpect(status().isForbidden());
  transition(id,"review",w.doctor(),review(1)).andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("REVIEWED"));
  transition(id,"publish",w.admin(),Map.of("version",1)).andExpect(status().isOk());
  String publicBody=mvc.perform(get("/api/public/educational-cases/"+id)).andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store")).andExpect(jsonPath("$.data.content.correction").value("Right-sided finding.")).andReturn().getResponse().getContentAsString();
  assertThat(publicBody).doesNotContain("reviewedBy","tenantId","reviewNote","Reviewed synthetic facts");
  mvc.perform(put("/api/educational-cases/"+id).header("Authorization","Bearer "+w.admin()).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(Map.of("version",1,"content",content())))).andExpect(status().isBadRequest());
  transition(id,"withdraw",w.admin(),Map.of("version",1)).andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("DRAFT"));
  mvc.perform(get("/api/public/educational-cases/"+id)).andExpect(status().isNotFound());
 }
 @Test void editingClearsReviewAndRejectsStaleVersionPublication()throws Exception{
  var w=world();String id=create(w);transition(id,"review",w.doctor(),review(1)).andExpect(status().isOk());
  var c=content();c.put("explanation","Revised synthetic explanation.");
  mvc.perform(put("/api/educational-cases/"+id).header("Authorization","Bearer "+w.doctor()).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(Map.of("version",1,"content",c))))
   .andExpect(status().isOk()).andExpect(jsonPath("$.data.version").value(2)).andExpect(jsonPath("$.data.status").value("DRAFT")).andExpect(jsonPath("$.data.reviewedAt").isEmpty());
  transition(id,"publish",w.admin(),Map.of("version",1)).andExpect(status().isBadRequest());
  transition(id,"publish",w.admin(),Map.of("version",2)).andExpect(status().isBadRequest());
  transition(id,"review",w.doctor(),review(2)).andExpect(status().isOk());
  transition(id,"publish",w.admin(),Map.of("version",2)).andExpect(status().isOk());
 }
 @Test void tenantIsolationAndSyntheticAttestationAreEnforced()throws Exception{
  var a=world();var b=world();String id=create(a);
  mvc.perform(get("/api/educational-cases").header("Authorization","Bearer "+b.doctor())).andExpect(status().isOk()).andExpect(jsonPath("$.data.length()").value(0));
  transition(id,"review",b.doctor(),review(1)).andExpect(status().isNotFound());
  transition(id,"publish",b.admin(),Map.of("version",1)).andExpect(status().isNotFound());
  TenantContext.setCurrentTenantId(b.tenant());assertThat(jdbc.queryForObject("SELECT count(*) FROM educational_cases WHERE id=?",Integer.class,UUID.fromString(id))).isZero();TenantContext.clear();
  var c=content();c.put("syntheticOnly",false);
  mvc.perform(post("/api/educational-cases").header("Authorization","Bearer "+a.doctor()).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(Map.of("content",c)))).andExpect(status().isBadRequest());
  String patient=jwt.generateAccessToken(UUID.randomUUID(),a.tenant(),"patient@example.test","PATIENT");
  mvc.perform(get("/api/educational-cases").header("Authorization","Bearer "+patient)).andExpect(status().isForbidden());
  mvc.perform(get("/api/educational-cases")).andExpect(status().isUnauthorized());
 }
}
