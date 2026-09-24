import { useEffect, useState } from 'react';
import api from '@/services/api';
import type { ApiResponse } from '@/types';
import type { PacsConnector } from '@/types/integration';

export type Study = { id: string; studyInstanceUid: string; accessionNumber: string; studyDate: string; description: string; patientId: string; patientName: string; seriesCount: number };
type Series = { id: string; seriesInstanceUid: string; modality: string; description: string; seriesNumber: string; instanceCount: number };
type Page = { content: Study[]; offset: number; limit: number; hasMore: boolean };
const button = 'rounded bg-blue-700 px-4 py-2 text-sm text-white disabled:opacity-50';
function errorText(e: unknown) {
  return (e as { response?: { data?: { message?: string } } }).response?.data?.message || 'Could not load Orthanc data. Check the connection and retry.';
}
export function OrthancStudies({ connectors, onSelect }: { connectors: PacsConnector[]; onSelect?: (connectorId: string, study: Study) => void }) {
  const orthanc = connectors.filter(c => c.type === 'ORTHANC');
  const [chosen, setChosen] = useState('');
  const connectorId = orthanc.some(c => c.id === chosen) ? chosen : orthanc[0]?.id || '';
  return <section className="space-y-4">
    <h2 className="text-lg font-semibold">Browse Orthanc studies</h2>
    <p className="text-sm text-slate-400">Browse imaging study metadata from your archive. To link a study, open the patient report in the clinical workspace and choose Open in PACS.</p>
    {!orthanc.length ? <p>No Orthanc connectors configured. Add one in the Connectors tab first.</p> : <>
      <label className="block text-sm">Orthanc connector
        <select className="mt-1 w-full rounded border border-slate-600 bg-slate-900 p-2" value={connectorId} onChange={e => setChosen(e.target.value)}>
          {orthanc.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <StudyList key={connectorId} connectorId={connectorId} onSelect={onSelect} />
    </>}
  </section>;
}
function StudyList({ connectorId, onSelect }: { connectorId: string; onSelect?: (connectorId: string, study: Study) => void }) {
  const [offset, setOffset] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [page, setPage] = useState<Page | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Study | null>(null);
  useEffect(() => {
    let current = true;
    setPage(null); setError(''); setSelected(null);
    api.get<ApiResponse<Page>>(`/integrations/connectors/${connectorId}/studies`, { params: { offset, limit: 20 } })
      .then(r => { if (current) setPage(r.data.data); })
      .catch(e => { if (current) setError(errorText(e)); });
    return () => { current = false; };
  }, [connectorId, offset, refresh]);
  return <div className="space-y-4">
    <button className={button} onClick={() => setRefresh(r => r + 1)}>Refresh studies</button>
    {error ? <p role="alert" className="text-red-300">{error}</p> : !page ? <p role="status">Loading studies…</p> : <>
      {!page.content.length ? <p>No studies on this page. Upload a DICOM study to Orthanc, then refresh.</p> : <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-left text-sm"><thead><tr className="border-b border-slate-700">
          {['Patient', 'Study', 'Date / accession', 'Series', ''].map((label, i) => <th className="p-3" key={i} scope="col">{label}</th>)}
        </tr></thead><tbody>{page.content.map(study => <tr key={study.id} className="border-b border-slate-700">
          <td className="p-3">{study.patientName || 'Name unavailable'}<div className="text-xs text-slate-400">{study.patientId}</div></td>
          <td className="p-3">{study.description || 'Untitled study'}</td>
          <td className="p-3">{study.studyDate || '—'}<div>{study.accessionNumber || 'No accession'}</div></td>
          <td className="p-3">{study.seriesCount}</td>
          <td className="p-3"><button className={button} onClick={() => setSelected(study)} aria-label={`View study ${study.description || study.id}`}>View details</button>{onSelect && <button className={button + " mt-2"} onClick={() => onSelect(connectorId, study)} aria-label={`Select study ${study.description || study.id}`}>Select for report</button>}</td>
        </tr>)}</tbody></table>
      </div>}
    </>}
    <div className="flex items-center gap-3">
      <button className={button} disabled={offset === 0 || (!page && !error)} onClick={() => setOffset(o => Math.max(0, o - 20))}>Previous</button>
      <span className="text-sm">Page {offset / 20 + 1}</span>
      <button className={button} disabled={!page?.hasMore} onClick={() => setOffset(o => o + 20)}>Next</button>
    </div>
    {selected && <StudyDetails key={selected.id} connectorId={connectorId} studyId={selected.id} onClose={() => setSelected(null)} />}
  </div>;
}
function StudyDetails({ connectorId, studyId, onClose }: { connectorId: string; studyId: string; onClose: () => void }) {
  const [result, setResult] = useState<{ study: Study; series: Series[] } | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    setResult(null); setError('');
    const path = `/integrations/connectors/${connectorId}/studies/${studyId}`;
    Promise.all([api.get<ApiResponse<Study>>(path), api.get<ApiResponse<Series[]>>(`${path}/series`)])
      .then(([study, series]) => { if (current) setResult({ study: study.data.data, series: series.data.data }); })
      .catch(e => { if (current) setError(errorText(e)); });
    return () => { current = false; };
  }, [connectorId, studyId, attempt]);
  return <section aria-label="Study details" className="space-y-3 rounded-xl border border-slate-700 p-4">
    <div className="flex items-center justify-between"><h3 className="font-semibold">Study details</h3><button className={button} onClick={onClose}>Close details</button></div>
    {error ? <><p role="alert" className="text-red-300">{error}</p><button className={button} onClick={() => setAttempt(a => a + 1)}>Retry details</button></> : !result ? <p role="status">Loading study details…</p> : <>
      <p>{result.study.patientName} · {result.study.description}</p>
      <p className="break-all text-xs text-slate-400">Study UID: {result.study.studyInstanceUid || 'Unavailable'}</p>
      {!result.series.length && <p>No series found for this study.</p>}
      {result.series.map(series => <div key={series.id} className="rounded border border-slate-700 p-3 text-sm">
        <p>{series.modality || 'Unknown modality'} · {series.description || 'Unnamed series'} · {series.instanceCount} instances</p>
        <p className="break-all text-xs text-slate-400">Series {series.seriesNumber || '—'} · UID: {series.seriesInstanceUid}</p>
      </div>)}
    </>}
  </section>;
}
