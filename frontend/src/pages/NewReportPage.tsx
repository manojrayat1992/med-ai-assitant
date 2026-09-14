import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { patientService } from '@/services/patientService';
import { reportingService, type ReportTemplate } from '@/services/reportingService';
import { starterReportTemplates } from '@/data/reportTemplates';
import { useAuthStore } from '@/stores/authStore';
import type { FileType, Patient } from '@/types';
import { Button } from '@/components/ui/Button';

const EMPTY_REPORT = 'FINDINGS\n\nCOMPARISON\n\nIMPRESSION\n';
const inputClass = 'w-full rounded-lg border border-slate-600 bg-slate-900 p-3 text-sm text-slate-100';
const modalities: FileType[] = ['XRAY', 'CT_SCAN', 'MRI', 'ULTRASOUND', 'OTHER'];
function message(error: unknown): string {
  const e = error as { response?: { data?: { message?: string } } };
  return e.response?.data?.message || 'The request failed. Your report text has been kept. Please retry.';
}

export function NewReportPage() {
  const role = useAuthStore(state => state.role);
  const allowed = role === 'DOCTOR' || role === 'HOSPITAL_ADMIN';
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [patientError, setPatientError] = useState('');
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [templateError, setTemplateError] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [modality, setModality] = useState<FileType>('XRAY');
  const [description, setDescription] = useState('');
  const [text, setText] = useState(EMPTY_REPORT);
  const [templateName, setTemplateName] = useState('');
  const [templateBody, setTemplateBody] = useState(EMPTY_REPORT);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    setLoadingPatients(true);
    setPatientError('');
    const timer = setTimeout(() => {
      patientService.list(page, 20, query || undefined, true).then(result => {
        if (!cancelled) { setPatients(result.content); setTotalPages(result.totalPages); }
      }).catch(() => {
        if (!cancelled) { setPatients([]); setPatientError('Could not load patients. Change the search to retry.'); }
      }).finally(() => { if (!cancelled) setLoadingPatients(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [allowed, query, page]);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    reportingService.templates().then(result => { if (!cancelled) setTemplates(result); })
      .catch(() => { if (!cancelled) setTemplateError('Organisation templates could not be loaded. Starter templates are still available.'); });
    return () => { cancelled = true; };
  }, [allowed]);

  function applyTemplate() {
    const template = [...starterReportTemplates, ...templates].find(item => item.id === selectedTemplate);
    if (!template) return;
    const example = starterReportTemplates.find(item => item.id === template.id)?.isExample;
    if (example && !window.confirm('This contains fictional normal findings, not results from this patient. Apply the example for clinician review and editing?')) return;
    if (text !== EMPTY_REPORT && text.trim() && !window.confirm('Replace the current report text with this template?')) return;
    setText(template.body);
    setModality(template.modality);
    setNotice(`Applied ${template.name}. Review every section for this patient.`);
  }

  async function saveTemplate() {
    setBusy(true); setError(''); setNotice('');
    try {
      // A separate editor deliberately starts empty: patient report text is never prefilled here.
      const saved = await reportingService.saveTemplate({ name: templateName, modality, body: templateBody });
      setTemplates(items => [saved, ...items]);
      setSelectedTemplate(saved.id);
      setShowTemplateEditor(false);
      setTemplateName(''); setTemplateBody(EMPTY_REPORT);
      setNotice('Template saved for your organisation.');
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }

  async function createReport() {
    if (!patient) return;
    setBusy(true); setError('');
    try {
      const review = await reportingService.createDraft({ patientId: patient.id, modality,
        studyDescription: description, reportText: text });
      navigate(`/clinical-workspace/${review.id}`);
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }

  if (!allowed) return <p role="alert">Only doctors and hospital administrators can author reports.</p>;

  return <div className="max-w-5xl space-y-6">
    <header><h1 className="text-2xl font-bold">New radiology report</h1>
      <p className="mt-2 text-sm text-slate-400">Write a report for an existing patient, then open the workspace for QA and clinical review.</p></header>
    {error && <p role="alert" className="text-red-300">{error}</p>}
    {notice && <p role="status" className="text-cyan-300">{notice}</p>}
    <fieldset disabled={busy} className="space-y-6 disabled:opacity-70">
      <section className="rounded-xl border border-slate-700 p-5 space-y-3">
        <h2 className="font-semibold">1. Select the patient</h2>
        <label className="block">Search patients
          <input className={inputClass} value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} placeholder="Name or medical record number" /></label>
        {patientError && <p role="alert">{patientError}</p>}
        {loadingPatients ? <p role="status">Loading patients…</p> : <>
          <div className="grid gap-2 sm:grid-cols-2">{patients.map(item => <button type="button" key={item.id}
            aria-pressed={patient?.id === item.id} onClick={() => setPatient(item)}
            className={`rounded-lg border p-3 text-left text-sm ${patient?.id === item.id ? 'border-cyan-400 bg-cyan-950' : 'border-slate-700'}`}>
            {item.fullName} · {item.medicalRecordNumber}<span className="block text-xs text-slate-400">DOB: {item.dateOfBirth}</span>
          </button>)}</div>
          {!patients.length && <p>No matching patients. <Link to="/patients" className="underline">Add a patient</Link></p>}
          <div className="flex items-center gap-3 text-sm"><Button variant="outline" onClick={() => setPage(p => p - 1)} disabled={page === 0}>Previous</Button>
            <span>Page {page + 1} of {Math.max(1, totalPages)}</span>
            <Button variant="outline" onClick={() => setPage(p => p + 1)} disabled={page + 1 >= totalPages}>Next</Button></div>
        </>}
        {patient && <p className="text-cyan-300">Selected: {patient.fullName} · {patient.medicalRecordNumber} · {patient.dateOfBirth}</p>}
      </section>
      <section className="rounded-xl border border-slate-700 p-5 space-y-4">
        <h2 className="font-semibold">2. Write the report</h2>
        <div className="grid gap-4 sm:grid-cols-2"><label>Modality<select className={inputClass} value={modality} onChange={e => setModality(e.target.value as FileType)}>
          {modalities.map(value => <option key={value} value={value}>{value.replace(/_/g, ' ')}</option>)}</select></label>
          <label>Study description<input className={inputClass} maxLength={1000} value={description} onChange={e => setDescription(e.target.value)} placeholder="Exam and body region" /></label></div>
        {templateError && <p role="alert">{templateError}</p>}
        <div className="flex flex-wrap items-end gap-3"><label className="flex-1">Report template<select className={inputClass} value={selectedTemplate} onChange={e => setSelectedTemplate(e.target.value)}>
          <option value="">Choose a template</option>
          <optgroup label="Starter templates">{starterReportTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</optgroup>
          {templates.length > 0 && <optgroup label="Organisation templates">{templates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.modality})</option>)}</optgroup>}
          </select></label>
          <Button variant="secondary" onClick={applyTemplate} disabled={!selectedTemplate}>Apply template</Button>
          <Button variant="outline" onClick={() => setShowTemplateEditor(!showTemplateEditor)}>Create template</Button></div>
        <p className="text-xs text-slate-400">Choose a blank structure or a normal-report example. Examples contain fictional findings: verify and edit every statement, and complete the comparison before saving.</p>
        {showTemplateEditor && <div className="space-y-3 rounded-lg border border-slate-600 p-4">
          <p className="text-sm text-slate-400">Templates are shared with your organisation. Enter reusable structure without patient details.</p>
          <label className="block">Template name<input className={inputClass} maxLength={120} value={templateName} onChange={e => setTemplateName(e.target.value)} /></label>
          <label className="block">Template structure<textarea className={inputClass} rows={7} maxLength={100000} value={templateBody} onChange={e => setTemplateBody(e.target.value)} /></label>
          <Button onClick={saveTemplate} disabled={!templateName.trim() || !templateBody.trim()}>Save template</Button>
        </div>}
        <label className="block">Report text<textarea className={inputClass} rows={16} maxLength={100000} value={text} onChange={e => setText(e.target.value)} /></label>
        <p className="text-xs text-slate-400">Use FINDINGS, COMPARISON and IMPRESSION headings. Your draft is saved when you open the workspace.</p>
        <Button onClick={createReport} disabled={!patient || !description.trim() || !text.trim() || text === EMPTY_REPORT}>
          {busy ? 'Saving…' : 'Save draft and open workspace'}</Button>
      </section>
    </fieldset>
  </div>;
}
