package com.medai.education;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.medai.auth.security.UserPrincipal;
import com.medai.common.exception.BadRequestException;
import com.medai.common.exception.ResourceNotFoundException;
import com.medai.tenant.TenantContext;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
public class EducationalCaseService {
 private final JdbcTemplate jdbc;private final ObjectMapper mapper;
 public enum Specialty { RADIOLOGY, LABORATORY }
 public record Content(@NotBlank @Size(max=160) String title,@NotNull Specialty specialty,
   @NotBlank @Size(max=5000) String scenario,@NotBlank @Size(max=10000) String originalReport,
   @NotBlank @Size(max=3000) String reportingIssue,@NotBlank @Size(max=10000) String explanation,
   @NotBlank @Size(max=10000) String correction,@NotNull @AssertTrue Boolean syntheticOnly) {}
 public record DraftRequest(@NotNull @Valid Content content) {}
 public record EditRequest(@Min(1) int version,@NotNull @Valid Content content) {}
 public record VersionRequest(@Min(1) int version) {}
 public record ReviewRequest(@Min(1) int version,@NotNull @AssertTrue Boolean confirmed,
   @NotBlank @Size(max=3000) String note) {}
 public record Draft(UUID id,Content content,int version,String status,UUID reviewedBy,Instant reviewedAt,String reviewNote) {}
 public record Published(UUID id,Content content,Instant reviewedAt,Instant publishedAt) {}
 private UUID tenant(UserPrincipal p){
   if(p==null||!Set.of("DOCTOR","HOSPITAL_ADMIN").contains(p.role()))throw new AccessDeniedException("Clinician or hospital administrator access required.");
   UUID tenant=TenantContext.requireTenantId();if(!tenant.equals(p.tenantId()))throw new AccessDeniedException("Tenant mismatch.");return tenant;
 }
 private void page(int page){if(page<0||page>10000)throw new BadRequestException("Invalid page.");}
 @Transactional public Draft create(Content content,UserPrincipal p){
   UUID tenant=tenant(p),id=UUID.randomUUID();jdbc.update("INSERT INTO educational_cases(id,tenant_id,created_by,content) VALUES (?,?,?,CAST(? AS JSONB))",id,tenant,p.userId(),json(content));return get(id,tenant,false);
 }
 @Transactional(readOnly=true) public List<Draft> drafts(UserPrincipal p,int page){
   UUID tenant=tenant(p);page(page);return jdbc.query("SELECT * FROM educational_cases WHERE tenant_id=? ORDER BY created_at DESC,id DESC LIMIT 20 OFFSET ?",(r,n)->draft(r),tenant,page*20);
 }
 @Transactional public Draft edit(UUID id,EditRequest request,UserPrincipal p){
   UUID tenant=tenant(p);Draft d=get(id,tenant,true);version(d,request.version());
   if(d.status().equals("PUBLISHED"))throw new BadRequestException("Withdraw the published case before editing it.");
   jdbc.update("UPDATE educational_cases SET content=CAST(? AS JSONB),version=version+1,status='DRAFT',reviewed_by=NULL,reviewed_at=NULL,review_note=NULL,updated_at=now() WHERE id=? AND tenant_id=?",json(request.content()),id,tenant);return get(id,tenant,false);
 }
 @Transactional public Draft review(UUID id,ReviewRequest request,UserPrincipal p){
   UUID tenant=tenant(p);if(!"DOCTOR".equals(p.role()))throw new AccessDeniedException("A Doctor account must perform the clinical review.");
   Draft d=get(id,tenant,true);version(d,request.version());
   if(!d.status().equals("DRAFT"))throw new BadRequestException("Only a draft can be reviewed.");
   jdbc.update("UPDATE educational_cases SET status='REVIEWED',reviewed_by=?,reviewed_at=now(),review_note=?,updated_at=now() WHERE id=? AND tenant_id=?",p.userId(),request.note(),id,tenant);return get(id,tenant,false);
 }
 @Transactional public Draft publish(UUID id,int version,UserPrincipal p){
   UUID tenant=tenant(p);Draft d=get(id,tenant,true);version(d,version);
   if(!d.status().equals("REVIEWED")||d.reviewedAt()==null)throw new BadRequestException("A clinician must review this version before publication.");
   jdbc.update("INSERT INTO published_educational_cases(id,content,reviewed_at) VALUES (?,CAST(? AS JSONB),?)",id,json(d.content()),java.sql.Timestamp.from(d.reviewedAt()));
   jdbc.update("UPDATE educational_cases SET status='PUBLISHED',published_by=?,updated_at=now() WHERE id=? AND tenant_id=?",p.userId(),id,tenant);return get(id,tenant,false);
 }
 @Transactional public Draft withdraw(UUID id,int version,UserPrincipal p){
   UUID tenant=tenant(p);Draft d=get(id,tenant,true);version(d,version);
   if(!d.status().equals("PUBLISHED"))throw new BadRequestException("This case is not published.");
   jdbc.update("DELETE FROM published_educational_cases WHERE id=?",id);
   jdbc.update("UPDATE educational_cases SET status='DRAFT',version=version+1,reviewed_by=NULL,reviewed_at=NULL,review_note=NULL,published_by=NULL,updated_at=now() WHERE id=? AND tenant_id=?",id,tenant);return get(id,tenant,false);
 }
 @Transactional(readOnly=true) public List<Published> published(int page){page(page);return jdbc.query("SELECT * FROM published_educational_cases ORDER BY published_at DESC,id DESC LIMIT 20 OFFSET ?",(r,n)->published(r),page*20);}
 @Transactional(readOnly=true) public Published published(UUID id){return jdbc.query("SELECT * FROM published_educational_cases WHERE id=?",(r,n)->published(r),id).stream().findFirst().orElseThrow(()->missing(id));}
 private Draft get(UUID id,UUID tenant,boolean lock){return jdbc.query("SELECT * FROM educational_cases WHERE id=? AND tenant_id=?"+(lock?" FOR UPDATE":""),(r,n)->draft(r),id,tenant).stream().findFirst().orElseThrow(()->missing(id));}
 private Draft draft(java.sql.ResultSet r)throws java.sql.SQLException{return new Draft(r.getObject("id",UUID.class),content(r.getString("content")),r.getInt("version"),r.getString("status"),r.getObject("reviewed_by",UUID.class),r.getTimestamp("reviewed_at")==null?null:r.getTimestamp("reviewed_at").toInstant(),r.getString("review_note"));}
 private Published published(java.sql.ResultSet r)throws java.sql.SQLException{return new Published(r.getObject("id",UUID.class),content(r.getString("content")),r.getTimestamp("reviewed_at").toInstant(),r.getTimestamp("published_at").toInstant());}
 private void version(Draft d,int expected){if(d.version()!=expected)throw new BadRequestException("The case has changed. Reload before continuing.");}
 private ResourceNotFoundException missing(UUID id){return new ResourceNotFoundException("Educational case","id",id.toString());}
 private String json(Content c){try{return mapper.writeValueAsString(c);}catch(JsonProcessingException e){throw new IllegalStateException("Could not store educational case.");}}
 private Content content(String c){try{return mapper.readValue(c,Content.class);}catch(JsonProcessingException e){throw new IllegalStateException("Could not read educational case.");}}
}
