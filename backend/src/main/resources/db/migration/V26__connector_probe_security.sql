ALTER TABLE pacs_connectors ADD COLUMN encrypted_auth TEXT;
ALTER TABLE pacs_connectors ADD COLUMN orthanc_modality VARCHAR(64);
-- Previous code assigned CONNECTED without any network check. Invalidate those attestations.
UPDATE pacs_connectors SET status = 'DISCONNECTED', latency_ms = NULL, last_ping_at = NULL;
