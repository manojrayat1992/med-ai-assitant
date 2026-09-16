import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { integrationConnectorsApi as connectorsApi } from '@/services/integrationConnectorsApi';
import api from '@/services/api';
import type { ApiResponse } from '@/types';
import type { ReportReview } from '@/services/reportService';
import type { PacsConnector, PacsConnectorType, SaveConnectorPayload, Hl7ParseResult } from '@/types/integration';

const SAMPLE = 'MSH|^~\\&|TEST_RIS|TEST_HOSPITAL|MEDAI|LAB|20260915103000||ORU^R01|TEST-001|T|2.5.1\r\n'
  + 'PID|1||MRN-449102^^^TEST_HOSPITAL||Vance^Eleanor||19780412|F\r\n'
  + 'OBR|1|ORDER-001|ACC-001|71250^CT CHEST WITHOUT CONTRAST^CPT\r\n'
  + 'OBX|1|TX|FINDINGS^Findings||Synthetic example: a pulmonary nodule is described in the right lower lobe.||||||F\r\n'
  + 'OBX|2|TX|IMPRESSION^Impression||Synthetic example for interface testing only.||||||F\r';
const types: PacsConnectorType[] = ['ORTHANC', 'DCM4CHEE', 'HL7_V2_MLLP', 'FHIR_R4_EPIC', 'FHIR_R4_CERNER', 'POWERSCRIBE_360'];
const inputClass = 'w-full rounded border border-slate-600 bg-slate-900 p-2 text-sm';
const buttonClass = 'rounded bg-blue-700 px-4 py-2 text-sm text-white disabled:opacity-50';
const blank: SaveConnectorPayload = { name: '', type: 'ORTHANC', endpointUrl: '', orthancModality: '' };
function failure(e: unknown) {
  return (e as {response?: {data?: {message?: string}}}).response?.data?.message || 'Request failed. Check the backend and your access; no successful result was recorded.';
}
export function IntegrationsPage() {
  const role = useAuthStore(s => s.role);
  const admin = role === 'HOSPITAL_ADMIN';
  const [tab, setTab] = useState('connectors');
  const [connectors, setConnectors] = useState<PacsConnector[]>([]);
  const [form, setForm] = useState<SaveConnectorPayload>({...blank});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [raw, setRaw] = useState(SAMPLE);
  const [parsed, setParsed] = useState<Hl7ParseResult | null>(null);
  const [source, setSource] = useState('');
  const [externalId, setExternalId] = useState('');
  const [review, setReview] = useState<ReportReview | null>(null);
  async function reload() {
    setBusy(true); setError('');
    try { setConnectors(await connectorsApi.getConnectors()); }
    catch (e) { setError(failure(e)); }
    finally { setBusy(false); }
  }
  useEffect(() => { if (admin) void reload(); }, [admin]);
  function field(key: keyof SaveConnectorPayload, value: string) { setForm(previous => ({...previous, [key]: value})); }
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const saved = await connectorsApi.saveConnector(form);
      setConnectors(previous => [...previous.filter(c => c.id !== saved.id), saved]);
      setForm({...blank}); setNotice('Configuration saved. Run a connection test to verify the endpoint.');
    } catch (e) { setError(failure(e)); } finally { setBusy(false); }
  }
  async function ping(connector: PacsConnector) {
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await connectorsApi.pingConnector(connector.id);
      setConnectors(previous => previous.map(c => c.id === connector.id ? {...c, status: result.status, latencyMs: result.latencyMs, lastPingAt: result.timestamp} : c));
      setNotice(result.message);
    } catch (e) {
      setError(failure(e));
      setConnectors(previous => previous.map(c => c.id === connector.id ? {...c, status: 'ERROR', latencyMs: null} : c));
    } finally { setBusy(false); }
  }
  async function parse() {
    setBusy(true); setError(''); setParsed(null);
    try { setParsed(await connectorsApi.parseHl7(raw)); }
    catch (e) { setError(failure(e)); } finally { setBusy(false); }
  }
  async function lookup(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setReview(null);
    try { setReview((await api.get<ApiResponse<ReportReview>>('/integrations/reports', {params: {sourceSystem: source, externalReportId: externalId}})).data.data); }
    catch (e) { setError(failure(e)); } finally { setBusy(false); }
  }
  if (!admin) return <p role="alert">Hospital administrator access is required to manage integration endpoints and run the HL7 sandbox.</p>;
  return <div className="max-w-6xl space-y-5">
    <header><h1 className="text-2xl font-bold">PACS & EHR integrations</h1><p className="mt-2 text-sm text-slate-400">Configure endpoints, inspect real connection checks and validate HL7 messages. Status shows the last test result, not continuous monitoring.</p></header>
    <nav className="flex flex-wrap gap-2">{[['connectors','Connectors'],['hl7','HL7 sandbox'],['docker','Docker test setup'],['imports','Report import lookup']].map(([id,label]) =>
      <button key={id} className={buttonClass} disabled={busy} aria-pressed={tab === id} onClick={() => {setTab(id); setError(''); setNotice('');}}>{label}</button>)}</nav>
    {error && <p role="alert" className="text-red-300">{error}</p>}{notice && <p role="status" className="text-cyan-300">{notice}</p>}
    {tab === 'connectors' && <>
      <form onSubmit={save} className="rounded-xl border border-slate-700 p-4">
        <h2 className="mb-3 font-semibold">{form.id ? 'Edit connector' : 'Add connector'}</h2>
        <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
          <label>Name<input required maxLength={120} className={inputClass} value={form.name} onChange={e => field('name', e.target.value)} /></label>
          <label>Connector type<select className={inputClass} value={form.type} onChange={e => field('type',e.target.value)}>{types.map(t => <option key={t}>{t}</option>)}</select></label>
          <label>Endpoint base URL<input className={inputClass} maxLength={512} value={form.endpointUrl || ''} placeholder="http://orthanc:8042" onChange={e => field('endpointUrl',e.target.value)} /></label>
          <label>Orthanc modality ID (optional C-ECHO)<input className={inputClass} pattern="[A-Za-z0-9_-]{0,64}" value={form.orthancModality || ''} placeholder="loopback" onChange={e => field('orthancModality',e.target.value)} /></label>
          <label>HTTP username<input className={inputClass} autoComplete="off" value={form.username || ''} onChange={e => field('username',e.target.value)} /></label>
          <label>HTTP password<input type="password" autoComplete="new-password" className={inputClass} value={form.password || ''} onChange={e => field('password',e.target.value)} /></label>
          <label>Bearer token (alternative to Basic auth)<input type="password" autoComplete="new-password" className={inputClass} value={form.bearerToken || ''} onChange={e => field('bearerToken',e.target.value)} /></label>
          <label className="self-center"><input type="checkbox" checked={!!form.clearCredentials} onChange={e => setForm(p => ({...p, clearCredentials:e.target.checked}))} /> Clear stored credentials</label>
          <p className="text-xs text-slate-400 sm:col-span-2">Credentials are encrypted at rest and never returned. Leaving credential fields empty retains existing credentials unless the endpoint changes. Endpoint origins must be permitted by the deployment administrator.</p>
          <button className={buttonClass} type="submit">Save connector</button><button type="button" className={buttonClass} onClick={() => setForm({...blank})}>Clear form</button>
        </fieldset>
      </form>
      <p className="text-sm text-slate-400">Orthanc: REST and optional Orthanc-initiated C-ECHO. dcm4chee: QIDO query. Epic/Cerner: FHIR metadata check only. MLLP listener and PowerScribe sync require additional adapters and are not operational.</p>
      <button className={buttonClass} disabled={busy} onClick={() => void reload()}>Reload saved connectors</button>
      {!busy && connectors.length === 0 && <p>No connectors configured. Add your endpoint above.</p>}
      <div className="grid gap-3 sm:grid-cols-2">{connectors.map(c => <article className="space-y-2 rounded-xl border border-slate-700 p-4" key={c.id}>
        <h2 className="font-semibold">{c.name}</h2><p className="text-xs">{c.type}</p>
        <p className={c.status === 'CONNECTED' ? 'text-green-300' : c.status === 'ERROR' ? 'text-red-300' : 'text-slate-400'}>{c.status}{c.latencyMs != null && ` · ${c.latencyMs} ms`}</p>
        <p className="break-all text-sm">{c.endpointUrl || 'Endpoint not configured'}</p>
        <p className="text-xs text-slate-400">Last checked: {c.lastPingAt ? new Date(c.lastPingAt).toLocaleString() : 'Never'} · Credentials: {c.credentialsConfigured ? 'Stored' : 'None'}</p>
        <div className="flex gap-2"><button className={buttonClass} disabled={busy} onClick={() => void ping(c)}>Test connection</button>
        <button className={buttonClass} disabled={busy} onClick={() => setForm({id:c.id, name:c.name, type:c.type, endpointUrl:c.endpointUrl || '', orthancModality:c.orthancModality || ''})}>Edit</button></div>
      </article>)}</div>
    </>}
    {tab === 'hl7' && <section className="space-y-3">
      <h2 className="font-semibold">HL7 text-report validation sandbox</h2><p className="text-sm text-slate-400">Synthetic sample. Authenticated HTTP parsing only; no message is sent over MLLP and no clinical record is saved. One patient and one order per message.</p>
      <label className="block">Raw HL7 message<textarea className={inputClass + ' font-mono'} rows={12} maxLength={262144} disabled={busy} value={raw} onChange={e => {setRaw(e.target.value); setParsed(null);}} /></label>
      <button className={buttonClass} disabled={busy || !raw.trim()} onClick={() => void parse()}>{busy ? 'Validating…' : 'Validate message'}</button>
      {parsed && <div className="space-y-3"><p role={parsed.success ? 'status' : 'alert'}>{parsed.success ? 'Validation passed' : 'Validation rejected'}: {parsed.parseNotes}</p>
        {parsed.success && <><dl className="text-sm"><dt>Patient</dt><dd>{parsed.patientName} · {parsed.patientMrn} · {parsed.dateOfBirth} · {parsed.sex}</dd><dt>Order</dt><dd>{parsed.accessionNumber || 'No filler order ID'} · {parsed.studyDescription} · {parsed.modality || 'Modality not inferred'}</dd></dl>
        <h3>Findings</h3><pre className="whitespace-pre-wrap">{parsed.findings.join('\n')}</pre><h3>Impression</h3><pre className="whitespace-pre-wrap">{parsed.impression.join('\n')}</pre></>}
        <h3>ACK preview (not transmitted)</h3><pre className="overflow-auto rounded bg-slate-950 p-3 text-xs">{parsed.rawAckMessage?.replace(/\r/g,'\n') || 'No ACK can be constructed without a valid message header.'}</pre>
      </div>}
    </section>}
    {tab === 'docker' && <section className="space-y-3 text-sm"><h2 className="font-semibold">Isolated Orthanc test setup</h2>
      <p>Use the checked-in Docker overlay with your configured Med-AI backend and S3 settings. Set ORTHANC_PASSWORD to a strong alphanumeric test password in .env.</p>
      <pre className="overflow-auto rounded bg-slate-950 p-3">docker compose --env-file .env -f docker/docker-compose.yml -f docker/docker-compose.pacs.yml up -d --build backend orthanc</pre>
      <p>Add an Orthanc connector: endpoint http://orthanc:8042, username medai, your ORTHANC_PASSWORD, modality ID loopback. Run Test connection to verify REST and the self C-ECHO.</p>
      <p>For a backend running directly on your Mac, use http://localhost:8042 and permit that origin in PACS_ALLOWED_ORIGINS before restarting the backend.</p>
      <p>Orthanc ports bind to loopback; its test database is ephemeral. Use synthetic data only. No MLLP listener, PowerScribe workstation, Epic or Cerner connection is installed by this overlay.</p>
    </section>}
    {tab === 'imports' && <form className="space-y-3" onSubmit={lookup}>
      <h2 className="font-semibold">Look up a report received through the JSON import API</h2>
      <label className="block">Source system<input className={inputClass} required value={source} onChange={e => {setSource(e.target.value); setReview(null);}} /></label>
      <label className="block">External report ID<input className={inputClass} required value={externalId} onChange={e => {setExternalId(e.target.value); setReview(null);}} /></label>
      <button className={buttonClass} disabled={busy}>Look up report</button>{review && <p>{review.status} · <Link className="underline" to={`/clinical-workspace/${review.id}`}>Open review</Link></p>}
    </form>}
  </div>;
}
