CREATE TABLE report_templates (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    modality VARCHAR(32) NOT NULL,
    body TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX report_templates_tenant ON report_templates(tenant_id, created_at DESC);
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_templates FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_report_templates ON report_templates
    USING (app_tenant_visible(tenant_id)) WITH CHECK (app_tenant_visible(tenant_id));
