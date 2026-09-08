-- ===========================================
-- V21: Tenant-managed AI provider settings
-- ===========================================
-- Hospitals can bring their own OpenAI-compatible API key. The secret is stored encrypted by the
-- application; the database keeps only ciphertext plus the last four characters for display.

CREATE TABLE tenant_ai_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    provider VARCHAR(30) NOT NULL CHECK (provider IN ('OPENAI', 'GROQ', 'CUSTOM')),
    base_url VARCHAR(500) NOT NULL,
    chat_model VARCHAR(150) NOT NULL,
    encrypted_api_key TEXT,
    api_key_last_four VARCHAR(8),
    api_key_updated_at TIMESTAMP WITH TIME ZONE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    data_agreement_in_place BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_tenant_ai_settings_tenant_id ON tenant_ai_settings(tenant_id);

CREATE TRIGGER update_tenant_ai_settings_updated_at
    BEFORE UPDATE ON tenant_ai_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE POLICY tenant_isolation_tenant_ai_settings ON tenant_ai_settings FOR ALL
    USING (app_tenant_visible(tenant_id))
    WITH CHECK (app_tenant_visible(tenant_id));

ALTER TABLE tenant_ai_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_ai_settings FORCE ROW LEVEL SECURITY;
