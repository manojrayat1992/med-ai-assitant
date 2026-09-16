CREATE TABLE pilot_measurement_start (started_at TIMESTAMPTZ NOT NULL);
INSERT INTO pilot_measurement_start VALUES(now());
CREATE TABLE pilot_qa_runs (
 id UUID PRIMARY KEY, tenant_id UUID NOT NULL REFERENCES tenants(id),
 report_id UUID NOT NULL REFERENCES report_reviews(id), user_id UUID NOT NULL REFERENCES users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE pilot_qa_alerts (
 run_id UUID NOT NULL REFERENCES pilot_qa_runs(id), tenant_id UUID NOT NULL REFERENCES tenants(id),
 issue_id VARCHAR(512) NOT NULL, PRIMARY KEY(run_id,issue_id)
);
CREATE TABLE pilot_qa_ratings (
 run_id UUID NOT NULL, issue_id VARCHAR(512) NOT NULL, tenant_id UUID NOT NULL REFERENCES tenants(id),
 user_id UUID NOT NULL REFERENCES users(id), useful BOOLEAN NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(run_id,issue_id,user_id), FOREIGN KEY(run_id,issue_id) REFERENCES pilot_qa_alerts(run_id,issue_id)
);
CREATE TABLE pilot_draft_edits (
 id UUID PRIMARY KEY,tenant_id UUID NOT NULL REFERENCES tenants(id),
 report_id UUID NOT NULL REFERENCES report_reviews(id),user_id UUID NOT NULL REFERENCES users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pilot_qa_period ON pilot_qa_runs(tenant_id,created_at);
CREATE INDEX idx_pilot_edits_period ON pilot_draft_edits(tenant_id,created_at);
ALTER TABLE pilot_qa_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pilot_qa_runs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_pilot_runs ON pilot_qa_runs USING(app_tenant_visible(tenant_id)) WITH CHECK(app_tenant_visible(tenant_id));
ALTER TABLE pilot_qa_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pilot_qa_alerts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_pilot_alerts ON pilot_qa_alerts USING(app_tenant_visible(tenant_id)) WITH CHECK(app_tenant_visible(tenant_id));
ALTER TABLE pilot_qa_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE pilot_qa_ratings FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_pilot_ratings ON pilot_qa_ratings USING(app_tenant_visible(tenant_id)) WITH CHECK(app_tenant_visible(tenant_id));
ALTER TABLE pilot_draft_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE pilot_draft_edits FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_pilot_edits ON pilot_draft_edits USING(app_tenant_visible(tenant_id)) WITH CHECK(app_tenant_visible(tenant_id));
