import {useState} from 'react';
import {Link} from 'react-router-dom';
import {pilotApplicationApi,type PilotApplication,type PilotReceipt} from '@/services/pilotApplicationApi';
const input='mt-2 w-full rounded-lg border border-slate-600 bg-slate-950 p-3 text-slate-100 focus:border-cyan-400 focus:outline-none';
export function PilotApplicationPage(){
  const [form,setForm]=useState(()=>({centreName:'',contactName:'',email:'',location:'',reportingSoftware:'',monthlyReportVolume:'',teamSize:'',mainProblem:'',integrationNeeds:'',contactConsent:false}));
  const [id,setId]=useState(()=>crypto.randomUUID());
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [receipt,setReceipt]=useState<PilotReceipt|null>(null);
  function change(key:string,value:string|boolean){setForm(p=>({...p,[key]:value}));setId(crypto.randomUUID());setError('');}
  async function submit(e:React.FormEvent){
    e.preventDefault();setBusy(true);setError('');
    try{
      const payload:PilotApplication={...form,submissionId:id,monthlyReportVolume:Number(form.monthlyReportVolume),teamSize:Number(form.teamSize)};
      setReceipt(await pilotApplicationApi.submit(payload));
    }catch(e){const status=(e as {response?:{status:number}}).response?.status;
      setError(status===429?'Too many attempts. Wait a minute, then retry. Your details are preserved.':'Your application was not confirmed as saved. Check your details and try again; your entries are preserved.');
    }finally{setBusy(false);}
  }
  return <main className="min-h-screen bg-[#0a0f1e] px-4 py-8 text-slate-100 sm:px-8"><div className="mx-auto max-w-3xl">
    <nav className="flex justify-between gap-4 border-b border-slate-800 pb-5"><Link to="/demo" className="text-lg font-bold">Med-AI <span className="text-cyan-300">Clinical</span></Link><Link to="/login" className="text-sm text-slate-300">Sign in</Link></nav>
    <header className="py-8"><p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">Build around your reporting workflow</p><h1 className="mt-3 text-3xl font-bold">Apply for a Med-AI pilot</h1><p className="mt-4 leading-relaxed text-slate-300">Tell us how your centre reports today and what slows your team down. We’ll use these details to assess fit and the integrations a pilot would need.</p><p className="mt-3 text-sm text-slate-400">No account required. Share workflow details only—no patient data, reports, passwords or API keys.</p></header>
    {receipt?<section role="status" className="rounded-xl border border-emerald-800 bg-emerald-950/30 p-6"><h2 className="text-xl font-semibold">Application received</h2><p className="mt-3">{receipt.message}</p><p className="mt-4 break-all text-sm text-slate-300">Reference: {receipt.reference}</p><p className="mt-3 text-sm text-slate-400">This is an application, not confirmation of enrolment. No payment or software installation has been initiated.</p><Link className="mt-5 inline-block text-cyan-300 underline" to="/demo">Try the clinical demo →</Link></section>:
    <form onSubmit={submit} className="rounded-xl border border-slate-700 bg-slate-900 p-5 sm:p-7">
      {error&&<p role="alert" className="mb-5 rounded-lg bg-red-950/40 p-3 text-sm text-red-200">{error}</p>}
      <fieldset disabled={busy} className="grid gap-5 sm:grid-cols-2">
        <label>Centre name<input className={input} required maxLength={160} autoComplete="organization" value={form.centreName} onChange={e=>change('centreName',e.target.value)} /></label>
        <label>City and country<input className={input} required maxLength={160} value={form.location} onChange={e=>change('location',e.target.value)} /></label>
        <label>Your name<input className={input} required maxLength={120} autoComplete="name" value={form.contactName} onChange={e=>change('contactName',e.target.value)} /></label>
        <label>Work email<input className={input} required type="email" maxLength={254} autoComplete="email" value={form.email} onChange={e=>change('email',e.target.value)} /></label>
        <label className="sm:col-span-2">Current reporting software<textarea className={input} required maxLength={1000} rows={2} placeholder="Name and version, if known. Include RIS, PACS, LIS or dictation software; enter None if not using any." value={form.reportingSoftware} onChange={e=>change('reportingSoftware',e.target.value)} /></label>
        <label>Approximate reports per month<input className={input} required type="number" min={1} max={10000000} step={1} value={form.monthlyReportVolume} onChange={e=>change('monthlyReportVolume',e.target.value)} /></label>
        <label>Reporting team size<input className={input} required type="number" min={1} max={100000} step={1} value={form.teamSize} onChange={e=>change('teamSize',e.target.value)} /></label>
        <label className="sm:col-span-2">Main workflow problem<textarea className={input} required maxLength={5000} rows={4} placeholder="What takes the most time or causes the most rework? What would a successful pilot improve?" value={form.mainProblem} onChange={e=>change('mainProblem',e.target.value)} /></label>
        <label className="sm:col-span-2">Integrations you need (optional)<textarea className={input} maxLength={2000} rows={3} placeholder="Systems to connect, available interfaces, and your IT team's constraints. It's fine to say you're unsure." value={form.integrationNeeds} onChange={e=>change('integrationNeeds',e.target.value)} /></label>
        <label className="flex items-start gap-3 text-sm text-slate-300 sm:col-span-2"><input type="checkbox" required className="mt-1" checked={form.contactConsent} onChange={e=>change('contactConsent',e.target.checked)} /><span>I agree that Med-AI may store these application details and contact me about this pilot. This does not subscribe me to marketing emails.</span></label>
        <button className="rounded-lg bg-cyan-300 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50 sm:col-span-2" type="submit">{busy?'Submitting…':'Submit pilot application'}</button>
      </fieldset>
    </form>}
    <p className="py-6 text-center text-sm text-slate-400">Explore first? <Link to="/demo" className="text-cyan-300 underline">Try a synthetic clinical case</Link></p>
  </div></main>;
}
