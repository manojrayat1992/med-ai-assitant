-- Public pre-account intake; not owned by an applicant hospital tenant.
-- Access is through the public write endpoint and an explicitly allowlisted reviewer service.
CREATE TABLE pilot_applications (
    id UUID PRIMARY KEY,
    encrypted_application TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW','CONTACTED','QUALIFIED','CLOSED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_by UUID REFERENCES users(id)
);
CREATE INDEX idx_pilot_applications_status_date ON pilot_applications(status,created_at DESC);
