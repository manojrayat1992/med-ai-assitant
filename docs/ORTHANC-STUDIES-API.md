# Orthanc study browsing API

Deploy the updated backend before calling these endpoints. They require a Med-AI
HOSPITAL_ADMIN bearer token and a connector owned by the current tenant. Obtain the
connector UUID using `GET /api/integrations/connectors`.

The connector must be ORTHANC with a permitted endpoint origin and working saved
credentials. Provision a separate Orthanc archive per tenant: connector ownership
isolates access to connectors, not patient records inside a shared remote archive.

## Requests

- `GET /api/integrations/connectors/{connectorId}/studies?offset=0&limit=20`
- `GET /api/integrations/connectors/{connectorId}/studies/{studyId}`
- `GET /api/integrations/connectors/{connectorId}/studies/{studyId}/series`

All requests use `Authorization: Bearer <Med-AI access token>`. Never put the
Orthanc password or Med-AI token in a URL. The backend uses the connector's stored
encrypted credentials; browsers do not connect directly to Orthanc.

`studyId` is the Orthanc ID returned as `content[].id`, not a DICOM StudyInstanceUID.
The list response is wrapped in the standard `{success,data,timestamp}` envelope.
`data` contains `content`, `offset`, `limit`, and `hasMore`. Increment offset by
limit while hasMore is true. Limit defaults to 20 and must be 1–100; offset must
be 0–1000000. Ordering is supplied by Orthanc; concurrent imports/deletions can
shift pagination. This API does not promise a date sort or a snapshot.

Study fields: id, studyInstanceUid, accessionNumber, studyDate (raw DICOM date),
description, patientId (external DICOM patient ID), patientName (raw DICOM name),
seriesCount. These are not automatically mapped to Med-AI patients.

Series fields: id, seriesInstanceUid, modality, description, seriesNumber,
instanceCount. A study with no series returns an empty list.

Responses use Cache-Control: no-store. No images are downloaded, persisted or
copied to S3. No report is linked or modified by these read-only requests.

## Errors and limits

- 400: invalid pagination, invalid Orthanc ID, unsupported connector type, or
  endpoint origin not permitted by PACS_ALLOWED_ORIGINS.
- 401/403: missing authentication or insufficient role.
- 404: connector does not belong to this tenant or does not exist.
- 502: Orthanc is unavailable, credentials fail, a remote study was deleted,
  the response is malformed, or a response exceeds 1 MB.

Remote calls have a 3-second connect timeout, a 5-second read timeout, and do not
follow redirects. Reduce list page size if an expanded page exceeds the limit.

## Test after deployment

1. Save an Orthanc connector and successfully test its connection.
2. Call the studies endpoint with an admin session. An empty archive returns an
   empty content array and hasMore false.
3. Upload a synthetic DICOM study into Orthanc; call the list again.
4. Copy its Orthanc id into the detail and series endpoints and compare the
   returned study UID, accession and series count with Orthanc.
5. Verify a different tenant cannot use the connector UUID.

The Integrations Browse studies tab uses these APIs. Saved report linking and
Open in PACS are documented in [PACS-VIEWER-SETUP.md](PACS-VIEWER-SETUP.md).

Orthanc REST reference: https://orthanc.uclouvain.be/book/users/rest.html
