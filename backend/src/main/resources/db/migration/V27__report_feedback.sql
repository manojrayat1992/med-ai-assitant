CREATE TABLE report_feedback (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    report_id UUID NOT NULL REFERENCES report_reviews(id),
    submitted_by UUID NOT NULL REFERENCES users(id),
    category VARCHAR(32) NOT NULL CHECK (category IN ('WRONG_SUGGESTION','MISSED_FINDING','OTHER')),
    encrypted_content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_report_feedback_review ON report_feedback(tenant_id, report_id, created_at DESC);
ALTER TABLE report_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_feedback FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_report_feedback ON report_feedback
    USING (app_tenant_visible(tenant_id)) WITH CHECK (app_tenant_visible(tenant_id));
