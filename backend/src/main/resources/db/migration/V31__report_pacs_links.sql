ALTER TABLE pacs_connectors ADD COLUMN viewer_url VARCHAR(512);
ALTER TABLE report_reviews ADD COLUMN pacs_connector_id UUID REFERENCES pacs_connectors(id);
ALTER TABLE report_reviews ADD COLUMN pacs_study_id VARCHAR(44);
ALTER TABLE report_reviews ADD COLUMN pacs_study_uid VARCHAR(64);
ALTER TABLE report_reviews ADD CONSTRAINT report_pacs_link_complete CHECK (
 (pacs_connector_id IS NULL AND pacs_study_id IS NULL AND pacs_study_uid IS NULL) OR
 (pacs_connector_id IS NOT NULL AND pacs_study_id IS NOT NULL AND pacs_study_uid IS NOT NULL));
