# Product screenshot provenance

These screenshots show the current React application at a 1440 × 1050 viewport, captured through the in-app browser during September 2026.

- No live patient records or credentials were used.
- Workspace and anatomy screens use the application's demo/reference content.
- Dashboard, worklist and QA analytics use synthetic API fixtures from `scripts/marketing-preview-server.mjs`. All figures are illustrative, not customer outcomes.
- Integration capture shows the current unconfigured connector form; it does not claim a live connection.
- Screenshots are unretouched; the clinical-workspace capture uses the UI's dismiss action on one demo-only alert.

To reproduce the isolated environment, build `frontend`, then run `node scripts/marketing-preview-server.mjs` from the repository root. It binds only to 127.0.0.1:4191 and never forwards requests to the real API. Capture screens using browser controls. This fixture server is not part of a deployment.
