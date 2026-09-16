-- ===========================================
-- V25: Plug-and-Play PACS & EHR Connectors
-- ===========================================

CREATE TABLE pacs_connectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    type VARCHAR(64) NOT NULL,
    host VARCHAR(255),
    port INTEGER,
    aet_title VARCHAR(64),
    local_aet VARCHAR(64),
    endpoint_url VARCHAR(512),
    status VARCHAR(32) NOT NULL DEFAULT 'DISCONNECTED',
    last_ping_at TIMESTAMPTZ,
    latency_ms INTEGER,
    description VARCHAR(500),
    metadata_json TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pacs_connectors_tenant ON pacs_connectors(tenant_id);
CREATE INDEX idx_pacs_connectors_type ON pacs_connectors(type);
CREATE INDEX idx_pacs_connectors_status ON pacs_connectors(status);

ALTER TABLE pacs_connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE pacs_connectors FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_pacs_connectors ON pacs_connectors
    USING (app_tenant_visible(tenant_id)) WITH CHECK (app_tenant_visible(tenant_id));
