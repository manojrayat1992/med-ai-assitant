-- ===========================================
-- V24: Incidental Finding & Follow-Up Closed-Loop Tracker
-- ===========================================

CREATE TABLE incidental_findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL,
    report_id UUID,
    patient_name VARCHAR(255),
    mrn VARCHAR(64),
    finding_text VARCHAR(2000) NOT NULL,
    guideline_system VARCHAR(64) NOT NULL,
    recommendation_text VARCHAR(1500) NOT NULL,
    timeframe_months INTEGER,
    due_date DATE,
    status VARCHAR(64) NOT NULL DEFAULT 'PENDING_SCHEDULING',
    follow_up_modality VARCHAR(128),
    estimated_revenue_recapture DOUBLE PRECISION DEFAULT 0.0,
    scheduled_date DATE,
    completed_date DATE,
    notes VARCHAR(1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_incidental_tenant ON incidental_findings(tenant_id);
CREATE INDEX idx_incidental_patient ON incidental_findings(patient_id);
CREATE INDEX idx_incidental_status ON incidental_findings(status);
CREATE INDEX idx_incidental_due_date ON incidental_findings(due_date);

ALTER TABLE incidental_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidental_findings FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_incidental_findings ON incidental_findings
    USING (app_tenant_visible(tenant_id)) WITH CHECK (app_tenant_visible(tenant_id));
