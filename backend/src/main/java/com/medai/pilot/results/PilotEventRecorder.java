package com.medai.pilot.results;
import com.medai.auth.security.UserPrincipal;
import com.medai.qa.model.QaResult;
import com.medai.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
@Service @RequiredArgsConstructor
public class PilotEventRecorder {
 private final JdbcTemplate jdbc;
 @Transactional public QaResult qa(QaResult result,UserPrincipal principal){
  UUID tenant=TenantContext.requireTenantId(),run=UUID.randomUUID();
  jdbc.update("INSERT INTO pilot_qa_runs(id,tenant_id,report_id,user_id) VALUES (?,?,?,?)",run,tenant,result.reportId(),principal.userId());
  for(var issue:result.issues())jdbc.update("INSERT INTO pilot_qa_alerts(run_id,tenant_id,issue_id) VALUES (?,?,?) ON CONFLICT DO NOTHING",run,tenant,issue.id());
  return new QaResult(result.reportId(),result.status(),result.issues(),result.issueCount(),result.evaluatedAt(),run);
 }
 @Transactional public void edit(UUID report,UUID user){jdbc.update("INSERT INTO pilot_draft_edits(id,tenant_id,report_id,user_id) VALUES (?,?,?,?)",UUID.randomUUID(),TenantContext.requireTenantId(),report,user);}
}
