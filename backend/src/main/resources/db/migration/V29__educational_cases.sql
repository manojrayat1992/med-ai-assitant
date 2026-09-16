CREATE TABLE educational_cases (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    created_by UUID NOT NULL REFERENCES users(id),
    content JSONB NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','REVIEWED','PUBLISHED')),
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    review_note TEXT,
    published_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_educational_cases_tenant ON educational_cases(tenant_id,created_at DESC);
ALTER TABLE educational_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE educational_cases FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_educational_cases ON educational_cases
    USING (app_tenant_visible(tenant_id)) WITH CHECK (app_tenant_visible(tenant_id));
-- Only explicitly published, synthetic snapshots are copied here. No clinical report IDs,
-- patient data links, internal tenant IDs or reviewer identities are exposed by the public API.
CREATE TABLE published_educational_cases (
    id UUID PRIMARY KEY REFERENCES educational_cases(id),
    content JSONB NOT NULL,
    reviewed_at TIMESTAMPTZ NOT NULL,
    published_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_published_educational_cases_date ON published_educational_cases(published_at DESC);
