import { useEffect, useState } from 'react';
import { reportFeedbackApi, type FeedbackCategory, type FeedbackRequest, type ReportFeedback } from '@/services/reportFeedbackApi';
import type { QaIssue } from '@/types/clinicalWorkspace';
const categories: Record<FeedbackCategory,string> = {WRONG_SUGGESTION:'Wrong suggestion',MISSED_FINDING:'Something was missed',OTHER:'Other workflow problem'};
const fieldClass = 'mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 p-2 text-sm text-slate-100';
const buttonClass = 'rounded-lg border border-slate-600 px-3 py-2 text-sm disabled:opacity-50';
function blank(): FeedbackRequest {return {submissionId:crypto.randomUUID(),category:'WRONG_SUGGESTION',originalSuggestion:'',explanation:'',correction:''};}
export function ReportFeedbackPanel({reportId, selectedIssue}: {reportId:string;selectedIssue?:QaIssue|null}) {
  const [open,setOpen] = useState(false);
  const [form,setForm] = useState<FeedbackRequest>(blank);
  const [items,setItems] = useState<ReportFeedback[]>([]);
  const [page,setPage] = useState(0);
  const [loading,setLoading] = useState(false);
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [reload,setReload] = useState(0);
  useEffect(() => {
    let current = true;
    if (!open) return;
    setLoading(true); setError('');
    reportFeedbackApi.list(reportId,page).then(rows => {if(current) setItems(rows);})
      .catch(() => {if(current) {setItems([]); setError('Could not load saved feedback. Try reloading.');}})
      .finally(() => {if(current) setLoading(false);});
    return () => {current=false;};
  }, [reportId,open,page,reload]);
  function update(key: keyof FeedbackRequest,value:string) {setForm(p => ({...p,[key]:value,submissionId:crypto.randomUUID()})); setNotice('');}
  async function submit(e:React.FormEvent) {
    e.preventDefault(); setSaving(true);setError('');setNotice('');
    try {
      await reportFeedbackApi.submit(reportId,form);
      setForm(blank());setPage(0);setReload(n=>n+1);
      setNotice('Feedback saved. The report has not been changed. Apply clinical corrections using Edit report and the normal review process.');
    } catch {setError('Feedback was not confirmed as saved. Your text is preserved; retry with the same submission.');}
    finally {setSaving(false);}
  }
  return <section className="mt-4 rounded-xl border border-slate-700 bg-slate-900 p-4" aria-label="Report feedback">
    <button className={buttonClass} aria-expanded={open} onClick={()=>setOpen(p=>!p)}>Clinician feedback</button>
    {!open && <p className="mt-2 text-sm text-slate-300">Click Clinician feedback to flag a suggestion, explain an omission or submit a correction.</p>}
    {open && <div className="mt-4 space-y-4">
      <p className="text-sm text-slate-300">Flag an incorrect suggestion, explain an omission, or propose a correction. Feedback is saved with your identity, time and a snapshot of the saved report. It does not automatically train a model or change the report.</p>
      {notice && <p role="status" className="text-sm text-emerald-300">{notice}</p>}
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <form onSubmit={submit}><fieldset disabled={saving} className="space-y-3">
        <label className="block text-sm">Feedback type<select className={fieldClass} value={form.category} onChange={e=>update('category',e.target.value)}>{Object.entries(categories).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label className="block text-sm">Suggestion being flagged<textarea className={fieldClass} required={form.category==='WRONG_SUGGESTION'} maxLength={5000} rows={3} value={form.originalSuggestion} onChange={e=>update('originalSuggestion',e.target.value)} /></label>
        {selectedIssue && <button type="button" className={buttonClass} onClick={()=>update('originalSuggestion',`${selectedIssue.message}\n${selectedIssue.recommendation}`)}>Use selected QA suggestion</button>}
        <label className="block text-sm">What was wrong or missed?<textarea className={fieldClass} required maxLength={5000} rows={3} value={form.explanation} onChange={e=>update('explanation',e.target.value)} /></label>
        <label className="block text-sm">Proposed correction<textarea className={fieldClass} required maxLength={10000} rows={3} value={form.correction} onChange={e=>update('correction',e.target.value)} /></label>
        <button type="submit" className={buttonClass+' bg-blue-700 text-white'} disabled={!form.explanation.trim()||!form.correction.trim()||(form.category==='WRONG_SUGGESTION'&&!form.originalSuggestion.trim())}>{saving?'Saving feedback…':'Submit feedback'}</button>
      </fieldset></form>
      <div className="border-t border-slate-700 pt-4"><h3 className="font-semibold">Saved feedback</h3>
        {loading?<p className="text-sm">Loading feedback…</p>:items.length===0?<p className="mt-2 text-sm text-slate-400">{error?'Feedback history unavailable.':'No feedback on this page.'}</p>:items.map(item=><article className="mt-3 space-y-2 rounded-lg border border-slate-700 p-3 text-sm" key={item.id}>
          <p className="font-semibold">{categories[item.category]}</p><p className="text-xs text-slate-400">{new Date(item.createdAt).toLocaleString()} · Clinician {item.submittedBy.slice(0,8)} · {item.content.reportStatus}</p>
          {item.content.originalSuggestion && <p className="whitespace-pre-wrap"><strong>Flagged: </strong>{item.content.originalSuggestion}</p>}
          <p className="whitespace-pre-wrap"><strong>Reason: </strong>{item.content.explanation}</p><p className="whitespace-pre-wrap"><strong>Correction: </strong>{item.content.correction}</p>
          <details><summary className="cursor-pointer text-cyan-300">Saved report at submission</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-xs">{item.content.reportSnapshot||'No saved report text.'}</pre></details>
        </article>)}
        <div className="mt-3 flex gap-2"><button className={buttonClass} disabled={loading||page===0} onClick={()=>setPage(p=>p-1)}>Newer</button><button className={buttonClass} disabled={loading||items.length<20} onClick={()=>setPage(p=>p+1)}>Older</button><button className={buttonClass} disabled={loading} onClick={()=>setReload(n=>n+1)}>Reload feedback</button></div>
      </div>
    </div>}
  </section>;
}
