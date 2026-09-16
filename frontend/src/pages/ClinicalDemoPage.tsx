import { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, FlaskConical, ScanLine, ShieldCheck, RotateCcw, Share2 } from 'lucide-react';
import { checkDemoReport, demoCases, type DemoReport, type DemoSection } from '@/demo/clinicalDemo';

const sections: DemoSection[] = ['findings', 'comparison', 'impression'];
const button = 'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-400';
export function ClinicalDemoPage() {
  const [params, setParams] = useSearchParams();
  const selected = demoCases.find(c => c.id === params.get('case')) || demoCases[0];
  // A case switch remounts the exercise: drafts and previous QA cannot leak between cases.
  return <ClinicalDemoExercise key={selected.id} caseId={selected.id} onSelect={id => setParams({case:id})} />;
}
function ClinicalDemoExercise({caseId, onSelect}: {caseId: string; onSelect: (id:string) => void}) {
  const selected = demoCases.find(c => c.id === caseId)!;
  const [report, setReport] = useState<DemoReport>({...selected.initial});
  const [checked, setChecked] = useState<DemoReport | null>(null);
  const [notice, setNotice] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const fields = useRef<Partial<Record<DemoSection, HTMLTextAreaElement | null>>>({});
  const issues = checked ? checkDemoReport(caseId, checked) : [];
  const stale = checked && sections.some(s => checked[s] !== report[s]);
  function reset() {setReport({...selected.initial}); setChecked(null); setNotice('Original synthetic draft restored.');}
  async function share() {
    const url = new URL('/demo', window.location.origin); url.searchParams.set('case', caseId);
    setShareUrl(url.toString());
    try { await navigator.clipboard.writeText(url.toString()); setNotice('Case link copied. Your report edits are not included.'); }
    catch { setNotice('Copy the case link below. Your report edits are not included.'); }
  }
  return <main className="min-h-screen bg-[#0a0f1e] text-slate-100">
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8">
      <nav aria-label="Demo navigation" className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <Link to="/demo" className="text-xl font-bold tracking-tight">Med-AI <span className="text-cyan-400">Clinical</span></Link>
        <div className="flex items-center gap-4"><span className="rounded-full border border-cyan-800 bg-cyan-950/50 px-3 py-1 text-xs font-semibold text-cyan-200">PUBLIC DEMO</span><Link className="text-sm text-cyan-300" to="/cases">Educational cases</Link><Link className="text-sm text-slate-300 hover:text-white" to="/login">Sign in <span aria-hidden="true">↗</span></Link></div>
      </nav>
      <header className="max-w-3xl py-9">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">Read. Question. Refine.</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">You make the final call.</h1>
        <p className="mt-4 text-lg leading-relaxed text-slate-300">Try a report review in a few minutes. Find the discrepancy, edit the draft, then run the checks again.</p>
        <p className="mt-3 flex items-start gap-2 text-sm text-cyan-200"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />Synthetic cases only. No sign-in or uploads. Edits stay in this page’s memory and disappear when you leave or reload. Do not enter patient information.</p>
      </header>
      <div aria-label="Choose a synthetic case" className="mb-6 grid gap-3 sm:grid-cols-2">
        {demoCases.map(c => <button key={c.id} aria-pressed={c.id === caseId} onClick={() => onSelect(c.id)} className={`flex items-center gap-4 rounded-xl border p-4 text-left transition-colors ${c.id === caseId ? 'border-cyan-500 bg-cyan-950/40' : 'border-slate-700 bg-slate-900 hover:border-slate-500'}`}>
          {c.id === 'radiology' ? <ScanLine className="h-6 w-6 text-cyan-300" /> : <FlaskConical className="h-6 w-6 text-cyan-300" />}<span><span className="block text-xs text-slate-400">{c.specialty} · Synthetic case</span><span className="mt-1 block font-semibold">{c.title}</span></span>
        </button>)}
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[0.85fr_1.3fr_1fr]">
        <aside className="rounded-xl border border-slate-700 bg-slate-900 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">01 · Source</p><h2 className="mt-2 text-lg font-semibold">Supplied observations</h2>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-slate-300">{selected.source.map(s => <li className="rounded-lg bg-slate-800/70 p-3" key={s}>{s}</li>)}</ul>
          <div className="mt-5 border-t border-slate-700 pt-4"><h3 className="text-sm font-semibold">Your task</h3><p className="mt-2 text-sm leading-relaxed text-slate-300">{selected.task}</p></div>
          <p className="mt-4 text-xs leading-relaxed text-slate-400">These are invented observations, not an image interpretation or a real laboratory result. No patient record is connected.</p>
        </aside>
        <section className="rounded-xl border border-slate-700 bg-slate-900 p-5" aria-labelledby="draft-title">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">02 · Edit</p><h2 id="draft-title" className="mt-2 text-lg font-semibold">Draft report</h2><p className="mt-2 text-sm text-amber-200">This teaching draft intentionally contains errors.</p>
          <div className="mt-5 space-y-4">{sections.map(section => <label className="block" key={section}><span className="text-xs font-semibold uppercase tracking-wider text-slate-300">{section}</span><textarea ref={el => {fields.current[section] = el;}} className="mt-2 w-full resize-y rounded-lg border border-slate-600 bg-slate-950 p-3 text-sm leading-relaxed text-white focus:border-cyan-400 focus:outline-none" rows={section === 'comparison' ? 2 : 4} maxLength={5000} value={report[section]} onChange={e => setReport(p => ({...p,[section]:e.target.value}))} /></label>)}</div>
          <div className="mt-5 flex flex-wrap gap-2"><button className={button + ' bg-cyan-300 text-slate-950 hover:bg-cyan-200'} onClick={() => {setChecked({...report}); setNotice('Checks finished for the current draft.');}}>Run demo QA <ArrowRight className="h-4 w-4" /></button><button className={button + ' border border-slate-600 text-slate-200'} onClick={reset}><RotateCcw className="h-4 w-4" />Reset case</button></div>
          <details className="mt-5 text-sm"><summary className="cursor-pointer text-cyan-300">See an example revision</summary><p className="my-3 text-slate-400">One possible revision of these synthetic facts. Review it before using it in the editor.</p><pre className="whitespace-pre-wrap rounded-lg bg-slate-950 p-3 text-xs leading-relaxed">{sections.map(s => `${s.toUpperCase()}\n${selected.example[s]}`).join('\n\n')}</pre><button className={button + ' mt-3 border border-slate-600'} onClick={() => {setReport({...selected.example}); setNotice('Example loaded. Run demo QA to check this revision.');}}>Use example revision</button></details>
        </section>
        <section aria-labelledby="checks-title" className="rounded-xl border border-slate-700 bg-slate-900 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">03 · Review</p><h2 id="checks-title" className="mt-2 text-lg font-semibold">Consistency checks</h2>
          <p className="mt-3 text-xs leading-relaxed text-slate-400">Local, case-specific rules compare your draft with the supplied facts. This demo does not call an AI model or the production QA engine and cannot validate arbitrary clinical text.</p>
          {!checked ? <p className="mt-6 rounded-lg border border-dashed border-slate-600 p-4 text-sm text-slate-300">Run demo QA to inspect the deliberate discrepancies.</p> : <div className="mt-5 space-y-3">
            {stale && <p role="alert" className="rounded-lg border border-amber-700 bg-amber-950/40 p-3 text-sm text-amber-200">Draft changed. Run demo QA again; the results below belong to the previous revision.</p>}
            <p className="font-semibold">{issues.length ? `${issues.length} items to review${stale ? ' · previous revision' : ''}` : `${stale ? 'Previous revision matched' : 'Draft matches'} the demo checks`}</p>
            {issues.map(issue => <article key={issue.id} className="rounded-lg border border-amber-900/70 bg-amber-950/20 p-3"><p className="text-xs uppercase text-amber-300">{issue.section}</p><h3 className="mt-1 text-sm font-semibold">{issue.title}</h3><p className="mt-2 text-sm leading-relaxed text-slate-300">{issue.explanation}</p><button onClick={() => fields.current[issue.section]?.focus()} className="mt-3 text-sm font-semibold text-cyan-300">Edit {issue.section} →</button></article>)}
            {!issues.length && <p className="flex gap-2 rounded-lg bg-emerald-950/40 p-3 text-sm text-emerald-200"><CheckCircle2 className="h-5 w-5 shrink-0" />The selected checks found no discrepancy. This is not clinical clearance or a signed report.</p>}
          </div>}
        </section>
      </div>
      <div role="status" aria-live="polite" className="mt-4 min-h-6 text-sm text-cyan-200">{notice}</div>
      <footer className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-800 py-6"><div><h2 className="font-semibold">Bring the case to your next discussion.</h2><p className="mt-1 text-sm text-slate-400">Share the exercise. Each visitor starts with the original synthetic draft.</p></div><div className="flex flex-wrap gap-3"><button onClick={() => void share()} className={button + ' border border-slate-600'}><Share2 className="h-4 w-4" />Share case</button><Link to="/pilot" className={button + ' bg-blue-600 text-white'}>Apply for a pilot <ArrowRight className="h-4 w-4" /></Link></div></footer>
      {shareUrl && <label className="block pb-5 text-sm text-slate-300">Shareable case link<input readOnly className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-900 p-3" value={shareUrl} onFocus={e => e.target.select()} /></label>}
    </div>
  </main>;
}
