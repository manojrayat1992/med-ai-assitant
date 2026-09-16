package com.medai.pilot.results;
import com.medai.auth.security.UserPrincipal;
import com.medai.common.exception.*;
import com.medai.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.*;
@Service @RequiredArgsConstructor
public class PilotResultsService {
 private final NamedParameterJdbcTemplate jdbc;
 @Transactional public void rate(UUID run,String issue,boolean useful,UserPrincipal p){
  var args=new HashMap<String,Object>();args.put("tenant",TenantContext.requireTenantId());args.put("run",run);args.put("issue",issue);args.put("user",p.userId());args.put("useful",useful);
  Integer count=jdbc.queryForObject("SELECT count(*) FROM pilot_qa_alerts WHERE tenant_id=:tenant AND run_id=:run AND issue_id=:issue",args,Integer.class);
  if(count==null||count==0)throw new ResourceNotFoundException("QA alert","run",run.toString());
  jdbc.update("INSERT INTO pilot_qa_ratings(run_id,issue_id,tenant_id,user_id,useful) VALUES (:run,:issue,:tenant,:user,:useful) ON CONFLICT(run_id,issue_id,user_id) DO UPDATE SET useful=excluded.useful,updated_at=now()",args);
 }
 @Transactional(readOnly=true) public Map<String,Object> results(LocalDate from,LocalDate to){
  if(from==null||to==null||to.isBefore(from)||java.time.temporal.ChronoUnit.DAYS.between(from,to)>365)throw new BadRequestException("Choose a date range of 1 to 366 days.");
  Map<String,Object> p=new HashMap<>();p.put("tenant",TenantContext.requireTenantId());p.put("start",java.sql.Timestamp.from(from.atStartOfDay(ZoneOffset.UTC).toInstant()));p.put("end",java.sql.Timestamp.from(to.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant()));
  var result=new LinkedHashMap<String,Object>();result.put("from",from);result.put("to",to);result.put("generatedAt",Instant.now());
  result.put("trackingSince",jdbc.queryForObject("SELECT started_at FROM pilot_measurement_start LIMIT 1",Map.of(),java.sql.Timestamp.class).toInstant());
  result.put("qa",jdbc.queryForMap("""
   SELECT count(*) AS runs,count(DISTINCT report_id) AS reports,
    (SELECT count(*) FROM pilot_qa_alerts a JOIN pilot_qa_runs r ON r.id=a.run_id WHERE r.tenant_id=:tenant AND r.created_at>=:start AND r.created_at<:end) AS alerts,
    (SELECT count(*) FROM pilot_qa_ratings v JOIN pilot_qa_runs r ON r.id=v.run_id WHERE r.tenant_id=:tenant AND r.created_at>=:start AND r.created_at<:end) AS ratings,
    (SELECT count(*) FROM pilot_qa_ratings v JOIN pilot_qa_runs r ON r.id=v.run_id WHERE r.tenant_id=:tenant AND r.created_at>=:start AND r.created_at<:end AND v.useful) AS useful,
    (SELECT count(DISTINCT (v.run_id,v.issue_id)) FROM pilot_qa_ratings v JOIN pilot_qa_runs r ON r.id=v.run_id WHERE r.tenant_id=:tenant AND r.created_at>=:start AND r.created_at<:end) AS rated_alerts
   FROM pilot_qa_runs WHERE tenant_id=:tenant AND created_at>=:start AND created_at<:end
   """,p));
  result.put("editing",jdbc.queryForMap("SELECT count(*) AS saves,count(DISTINCT report_id) AS reports FROM pilot_draft_edits WHERE tenant_id=:tenant AND created_at>=:start AND created_at<:end",p));
  result.put("reporting",jdbc.queryForMap("""
   SELECT count(*) AS signed,count(*) FILTER(WHERE review_action='EDITED') AS edited,
    count(*) FILTER(WHERE signed_at>=created_at) AS timed,
    percentile_cont(0.5) WITHIN GROUP(ORDER BY EXTRACT(EPOCH FROM signed_at-created_at)/60) FILTER(WHERE signed_at>=created_at) AS median_minutes,
    percentile_cont(0.9) WITHIN GROUP(ORDER BY EXTRACT(EPOCH FROM signed_at-created_at)/60) FILTER(WHERE signed_at>=created_at) AS p90_minutes
   FROM report_reviews WHERE tenant_id=:tenant AND status='SIGNED' AND signed_at>=:start AND signed_at<:end
   """,p));
  result.put("adoption",jdbc.queryForMap("""
   WITH activity AS (
    SELECT user_id FROM pilot_qa_runs WHERE tenant_id=:tenant AND created_at>=:start AND created_at<:end
    UNION SELECT user_id FROM pilot_draft_edits WHERE tenant_id=:tenant AND created_at>=:start AND created_at<:end
    UNION SELECT signed_by FROM report_reviews WHERE tenant_id=:tenant AND status='SIGNED' AND signed_at>=:start AND signed_at<:end
   )
   SELECT count(*) AS eligible,count(*) FILTER(WHERE id IN(SELECT user_id FROM activity)) AS active
   FROM users WHERE tenant_id=:tenant AND is_active=true AND role IN ('DOCTOR','HOSPITAL_ADMIN','LAB_TECH')
   """,p));
  result.put("daily",jdbc.queryForList("SELECT to_char(signed_at AT TIME ZONE 'UTC','YYYY-MM-DD') AS day,count(*) AS signed FROM report_reviews WHERE tenant_id=:tenant AND status='SIGNED' AND signed_at>=:start AND signed_at<:end GROUP BY 1 ORDER BY 1",p));
  return result;
 }
}
