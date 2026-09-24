import { useEffect, useState } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '@/services/api';
import { integrationConnectorsApi } from '@/services/integrationConnectorsApi';
import { useAuthStore } from '@/stores/authStore';
import type { ApiResponse } from '@/types';
import type { ReportReview } from '@/services/reportService';
import type { PacsConnector } from '@/types/integration';
import { OrthancStudies, type Study } from './OrthancStudies';

type StudyLink = { connectorId: string; studyId: string; studyInstanceUid: string; viewerUrl: string | null };
const button = 'inline-flex items-center gap-2 rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white disabled:opacity-50';
function message(e: unknown) { return (e as { response?: { data?: { message?: string } } }).response?.data?.message || 'PACS request failed. Please retry.'; }
export function ReportPacsAction({ report }: { report: ReportReview }) {
  const role = useAuthStore(s => s.role);
  const admin = role === 'HOSPITAL_ADMIN';
  const permitted = admin || role === 'DOCTOR';
  const [link, setLink] = useState<StudyLink | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [connectors, setConnectors] = useState<PacsConnector[] | null>(null);
  const [selection, setSelection] = useState<{ connectorId: string; study: Study } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const path = `/reports/${report.id}/pacs`;
  useEffect(() => {
    if (!permitted) return;
    let current = true;
    api.get<ApiResponse<StudyLink | null>>(path).then(r => { if (current) setLink(r.data.data); })
      .catch(e => { if (current) setError(message(e)); });
    return () => { current = false; };
  }, [path, permitted]);
  useEffect(() => {
    if (!open || !admin) return;
    let current = true;
    integrationConnectorsApi.getConnectors().then(r => { if (current) setConnectors(r); })
      .catch(e => { if (current) setError(message(e)); });
    return () => { current = false; };
  }, [open, admin]);
  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) setOpen(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open, busy]);
  async function launch() {
    setBusy(true); setError('');
    const viewer = window.open('about:blank', '_blank');
    if (!viewer) { setError('Your browser blocked the viewer tab. Allow popups for Med-AI and retry.'); setOpen(true); setBusy(false); return; }
    viewer.opener = null;
    try {
      const result = (await api.post<ApiResponse<StudyLink>>(`${path}/launch`)).data.data;
      const url = new URL(result.viewerUrl || '');
      if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error('Invalid viewer URL');
      setLink(result);
      // No token or credentials are sent to the viewer. Orthanc/OHIF authenticates independently.
      viewer.location.replace(url.href);
    } catch (e) { viewer.close(); setError(message(e)); setOpen(true); }
    finally { setBusy(false); }
  }
  async function save() {
    if (!selection || !confirmed) return;
    setBusy(true); setError('');
    try {
      const result = await api.put<ApiResponse<StudyLink>>(path, { connectorId: selection.connectorId, studyId: selection.study.id, patientConfirmed: true });
      setLink(result.data.data); setSelection(null); setConfirmed(false);
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  async function unlink() {
    setBusy(true); setError('');
    try { await api.delete(path); setLink(null); } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  if (!permitted) return <span className="text-xs text-slate-400">PACS access requires a doctor or administrator.</span>;
  return <>
    <button className={button} disabled={busy} onClick={() => link?.viewerUrl ? void launch() : setOpen(true)}><ExternalLink className="h-4 w-4" />Open in PACS</button>
    {link && admin && <button className={button} onClick={() => setOpen(true)}>Manage study link</button>}
    {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div role="dialog" aria-modal="true" aria-label="Report PACS study" className="max-h-[90vh] w-full max-w-5xl space-y-4 overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 p-5 text-slate-100">
        <div className="flex justify-between gap-3"><div><h2 className="text-xl font-semibold">Report PACS study</h2><p className="text-sm">Med-AI patient: {report.patientName || report.patientId}</p><p className="text-xs text-slate-400">Patient ID: {report.patientId} · Report: {report.id}</p></div><button autoFocus className={button} disabled={busy} onClick={() => setOpen(false)} aria-label="Close PACS dialog"><X /></button></div>
        {error && <p role="alert" className="text-red-300">{error}</p>}
        {link ? <div className="space-y-2 rounded border border-slate-700 p-3"><p className="break-all">Linked study UID: {link.studyInstanceUid}</p>
          {link.viewerUrl ? <button className={button} disabled={busy} onClick={() => void launch()}>Open linked study in viewer</button> : <p>Configure the connector’s OHIF viewer URL in Integrations.</p>}
          {admin && <button className={button + ' ml-2'} disabled={busy} onClick={() => void unlink()}>Unlink study</button>}
        </div> : <p>No PACS study is linked to this report. {admin ? 'Select the matching study below.' : 'Ask a workspace administrator to link the matching study.'}</p>}
        <p className="text-xs text-slate-400">The viewer opens in a separate tab and may ask you to log in. For localhost testing, keep your SSH tunnel open.</p>
        {admin && <><Link className="text-blue-300 underline" to="/integrations">Configure connector and viewer URL</Link>
          {connectors ? <OrthancStudies connectors={connectors} onSelect={(connectorId, study) => { setSelection({ connectorId, study }); setConfirmed(false); }} /> : <p>Loading connectors…</p>}
          {selection && <div className="space-y-3 rounded border border-amber-700 p-4">
            <p>Selected PACS patient: <strong>{selection.study.patientName || 'Unknown'}</strong> · External ID: {selection.study.patientId || 'Unknown'}</p>
            <p>{selection.study.description} · {selection.study.studyDate} · Accession: {selection.study.accessionNumber || 'Unavailable'}</p>
            <label className="flex gap-2"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I verified that this study belongs to this report’s patient and examination.</label>
            <button className={button} disabled={!confirmed || busy} onClick={() => void save()}>{busy ? 'Saving…' : link ? 'Replace linked study' : 'Link study to report'}</button>
          </div>}
        </>}
      </div>
    </div>}
  </>;
}
