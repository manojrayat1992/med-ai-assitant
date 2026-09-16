import {useState} from 'react';
import {pilotResultsApi} from '@/services/pilotResultsApi';
import type {QaIssue} from '@/types/clinicalWorkspace';
export function QaUsefulnessRating({runId,issue}:{runId:string;issue:QaIssue}){
 const [rating,setRating]=useState<boolean|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 async function rate(value:boolean){setBusy(true);setError('');try{await pilotResultsApi.rate(runId,issue.id,value);setRating(value);}catch{setError('Rating was not confirmed as saved. Please retry.');}finally{setBusy(false);}}
 return <section className="mb-4 rounded-xl border border-slate-700 bg-slate-900 p-4" aria-label="QA usefulness">
 <h3 className="font-semibold">Was this QA alert useful?</h3><p className="my-2 text-sm text-slate-300">{issue.message}</p><p className="mb-3 text-xs text-slate-400">Rate this alert from this QA run. Your latest rating contributes to the pilot results; dismissing an alert does not rate it.</p>
 <div className="flex gap-3">{[true,false].map(value=><button className="rounded-lg border border-slate-600 px-3 py-2 text-sm disabled:opacity-50" key={String(value)} disabled={busy} aria-pressed={rating===value} onClick={()=>void rate(value)}>{value?'Useful':'Not useful'}</button>)}</div>
 {rating!==null&&<p role="status" className="mt-2 text-sm text-emerald-300">Saved: {rating?'useful':'not useful'}. You can change your rating.</p>}{error&&<p role="alert" className="mt-2 text-sm text-red-300">{error}</p>}
 </section>;
}
