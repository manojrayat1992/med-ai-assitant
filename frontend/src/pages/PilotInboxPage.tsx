import {useEffect,useState} from 'react';
import {pilotApplicationApi,type PilotEntry,type PilotStatus} from '@/services/pilotApplicationApi';
const statuses:PilotStatus[]=['NEW','CONTACTED','QUALIFIED','CLOSED'];
export function PilotInboxPage(){
 const [entries,setEntries]=useState<PilotEntry[]>([]);const [page,setPage]=useState(0);const [status,setStatus]=useState('');
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [reload,setReload]=useState(0);
 useEffect(()=>{let active=true;setBusy(true);setError('');setEntries([]);
 pilotApplicationApi.list(page,status).then(data=>{if(active)setEntries(data);}).catch(e=>{if(active)setError(e.response?.status===403?'This inbox is restricted to configured Med-AI reviewers.':'Could not load pilot applications. Try again.');}).finally(()=>{if(active)setBusy(false);});
 return()=>{active=false;};},[page,status,reload]);
 async function update(entry:PilotEntry,value:PilotStatus){setBusy(true);setError('');try{await pilotApplicationApi.update(entry.id,value);setReload(n=>n+1);}catch{setError('Status change was not saved. Please retry.');}finally{setBusy(false);}}
 return <div className="max-w-5xl space-y-5"><h1 className="text-2xl font-bold">Pilot applications</h1><p className="text-sm text-slate-400">Centre requirements and requested integrations. Changing a status does not send an email.</p>
 <div className="flex gap-3"><label>Status <select className="rounded border border-slate-600 bg-slate-900 p-2" disabled={busy} value={status} onChange={e=>{setStatus(e.target.value);setPage(0);}}><option value="">All</option>{statuses.map(s=><option key={s}>{s}</option>)}</select></label><button disabled={busy} onClick={()=>setReload(n=>n+1)}>Reload</button></div>
 {error&&<p role="alert" className="text-red-300">{error}</p>}{busy&&<p role="status">Loading…</p>}
 {!busy&&!error&&!entries.length&&<p>No applications on this page.</p>}
 {entries.map(e=><article className="space-y-3 rounded-xl border border-slate-700 bg-slate-900 p-5" key={e.id}>
 <h2 className="text-lg font-semibold">{e.application.centreName}</h2><p className="text-sm text-slate-400">{e.application.location} · {new Date(e.createdAt).toLocaleString()}</p>
 <p>{e.application.contactName} · {e.application.email}</p>
 <p>{e.application.monthlyReportVolume.toLocaleString()} reports/month · {e.application.teamSize} team members</p>
 <p className="whitespace-pre-wrap"><strong>Software: </strong>{e.application.reportingSoftware}</p><p className="whitespace-pre-wrap"><strong>Main problem: </strong>{e.application.mainProblem}</p><p className="whitespace-pre-wrap"><strong>Integrations: </strong>{e.application.integrationNeeds||'Not specified'}</p>
 <label>Application status for {e.application.centreName}<select className="ml-2 rounded border border-slate-600 bg-slate-950 p-2" disabled={busy} value={e.status} onChange={event=>void update(e,event.target.value as PilotStatus)}>{statuses.map(s=><option key={s}>{s}</option>)}</select></label>
 <p className="text-xs text-slate-400">Reference {e.id} · Contact consent recorded · Updated {new Date(e.updatedAt).toLocaleString()}{e.reviewedBy&&` · Reviewer ${e.reviewedBy}`}</p>
 </article>)}
 <div className="flex gap-4"><button disabled={busy||page===0} onClick={()=>setPage(p=>p-1)}>Newer</button><button disabled={busy||entries.length<20} onClick={()=>setPage(p=>p+1)}>Older</button></div>
 </div>;
}
