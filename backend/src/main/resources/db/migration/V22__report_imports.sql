-- Sender IDs are scoped to both tenant and source. A receipt and its draft are one transaction.
CREATE TABLE report_imports (
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    source_system VARCHAR(64) NOT NULL,
    external_report_id VARCHAR(128) NOT NULL,
    payload_hash VARCHAR(64) NOT NULL,
    review_id UUID REFERENCES report_reviews(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, source_system, external_report_id)
);
ALTER TABLE report_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_imports FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_report_imports ON report_imports
    USING (app_tenant_visible(tenant_id)) WITH CHECK (app_tenant_visible(tenant_id));
