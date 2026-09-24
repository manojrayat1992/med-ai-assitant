# Open a report's study in PACS

## What is implemented

Workspace administrators can open a saved report, choose **Open in PACS**, browse
Orthanc studies, compare the external patient/examination with the report, confirm
the match and save the link. The link persists across reloads. Administrators can
replace or unlink it; doctors can open the linked study. Linking does not change
report text or sign-off status. The metadata update is audited by the existing
controller audit mechanism.

The viewer opens in a separate tab. Med-AI verifies the remote study still exists
and its StudyInstanceUID still matches before returning the launch URL. Viewer
credentials and Med-AI access tokens are never put into that URL. Orthanc/OHIF
uses its own authentication. This is not single sign-on.

## Deploy

Deploy the updated backend and frontend through your usual production process.
Backend startup applies Flyway V31 (connector viewer URL and report study link
columns). Do not edit an already-applied migration.

For the repository's Orthanc test overlay, OHIF and DICOMweb are now enabled:

```yaml
OHIF_PLUGIN_ENABLED: "true"
DICOM_WEB_PLUGIN_ENABLED: "true"
ORTHANC__OHIF__DATA_SOURCE: dicom-web
```

From the project root on EC2, after deploying the updated compose file:

```bash
docker compose --env-file .env.prod \
  -f docker/docker-compose.prod.yml \
  -f docker/docker-compose.pacs.yml \
  up -d --no-deps orthanc
```

**The existing test overlay uses tmpfs: recreating Orthanc loses its uploaded test
studies. Export any synthetic studies you want to retain first, and re-upload them
after recreation. This overlay is not persistent clinical storage.** It does not
change Med-AI's S3 upload settings.

Keep the SSH tunnel from your laptop open:

```bash
ssh -i /path/to/key.pem -N -L 8042:127.0.0.1:8042 ubuntu@YOUR_EC2_IP
```

Use your actual EC2 SSH user (for example ec2-user for Amazon Linux).
Open http://localhost:8042/ohif/ and log in to Orthanc. Do not open ports 8042/4242
publicly. Upload a synthetic image DICOM study to Orthanc for verification.

## Configure and use

1. In Med-AI, sign in as Hospital Admin.
2. Integrations → Connectors → Edit your Orthanc connector.
3. Keep endpoint `http://orthanc:8042` (backend Docker address).
4. Set **OHIF viewer URL** to `http://localhost:8042/ohif/viewer` for SSH testing.
   For normal deployment use a browser-accessible authenticated HTTPS address,
   e.g. `https://pacs.your-domain.example/ohif/viewer`. It must serve the same
   Orthanc archive. Never enter the Docker hostname as the browser viewer URL.
5. Save. Empty credential inputs preserve the existing credentials when the
   endpoint has not changed.
6. Worklist → open the correct report in Clinical Workspace → **Open in PACS**.
7. Select the Orthanc connector and matching study using **Select for report**.
8. Compare both patient identities, study description, date and accession.
   Confirm the patient/examination checkbox, then **Link study to report**.
9. Choose **Open linked study in viewer**. After closing the dialog, the header's
   **Open in PACS** opens it directly. Refresh the report to confirm persistence.

Each operator using a localhost viewer URL needs their own SSH tunnel. For a
shared clinical installation configure HTTPS viewer access and per-user viewer
authentication with your PACS administrator. The URL is workspace configuration;
it does not provision DNS, TLS or viewer accounts. Each connector must point at
an archive dedicated to that workspace; it is not a filter over a shared archive.

## API

- GET `/api/reports/{reportId}/pacs`: saved link or null (admin/doctor).
- PUT `/api/reports/{reportId}/pacs`: admin-only link/replace, JSON
  `{ "connectorId": "uuid", "studyId": "orthanc-id", "patientConfirmed": true }`.
- DELETE `/api/reports/{reportId}/pacs`: admin-only unlink.
- POST `/api/reports/{reportId}/pacs/launch`: admin/doctor; revalidate the study
  and return the current configured viewer URL with StudyInstanceUIDs.

All require the existing Med-AI authentication. Connector UUID, report UUID and
Orthanc study ID are different identifiers. Link API retrieves study metadata from
Orthanc and does not trust a client-supplied DICOM UID.

## Troubleshooting

- Missing link: administrator must select and confirm a study for this report.
- Viewer URL missing: edit the connector; configure the OHIF route, not its REST URL.
- Viewer connection refused: check the SSH tunnel or the configured HTTPS host.
- Viewer 404: confirm the OHIF plugin loaded and the route ends `/ohif/viewer`.
- Viewer opens but no images: verify DICOMweb and ensure the viewer points to the
  same archive; not every DICOM SOP class is supported by the viewer.
- Study missing after restarting test Orthanc: re-upload it and verify/relink.
- Popup blocked: allow popups from the Med-AI workspace and retry.

References:
- https://orthanc.uclouvain.be/book/plugins/ohif.html
- https://docs.ohif.org/configuration/url/
