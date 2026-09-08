import { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Link, useNavigate } from 'react-router-dom';
import { patientService } from '@/services/patientService';
import { fileService } from '@/services/fileService';
import { analysisService, type AnalysisResponse } from '@/services/analysisService';
import { reportService } from '@/services/reportService';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Label';
import {
  Upload, FileImage, Loader2, CheckCircle2, XCircle,
  X, FileText, Scan, Stethoscope, Files, TestTube2, ClipboardList, FileHeart, Trash2,
} from 'lucide-react';
import type { Patient, FileType, MedicalFile } from '@/types';
import api from '@/services/api';

type UploadMode = 'single' | 'batch' | 'text';
type BatchUploadResult = { filename: string; success: boolean; fileId?: string; error?: string };
type RecentFilesNotice = { type: 'success' | 'error'; message: string };

const FILE_TYPE_OPTIONS: { value: FileType; label: string; icon: React.ElementType; color: string }[] = [
  { value: 'XRAY',             label: 'X-Ray',             icon: Scan,         color: '#06b6d4' },
  { value: 'CT_SCAN',          label: 'CT Scan',           icon: Scan,         color: '#8b5cf6' },
  { value: 'MRI',              label: 'MRI',               icon: Scan,         color: '#ec4899' },
  { value: 'ULTRASOUND',       label: 'Ultrasound',        icon: Stethoscope,  color: '#3b82f6' },
  { value: 'BLOOD_REPORT',     label: 'Blood Report',      icon: TestTube2,    color: '#ef4444' },
  { value: 'LAB_REPORT',       label: 'Lab Report',        icon: TestTube2,    color: '#14b8a6' },
  { value: 'PRESCRIPTION',     label: 'Prescription',      icon: ClipboardList, color: '#f59e0b' },
  { value: 'DISCHARGE_SUMMARY', label: 'Discharge Summary', icon: FileHeart,   color: '#22c55e' },
  { value: 'OTHER',            label: 'Other Imaging',     icon: FileImage,    color: '#64748b' },
];

const WORKSPACE_POLL_ATTEMPTS = 24;
const WORKSPACE_POLL_INTERVAL_MS = 2000;

const statusBadge: Record<string, string> = {
  COMPLETED:  'badge-green',
  PROCESSING: 'badge-amber',
  FAILED:     'badge-red',
  UPLOADED:   'badge-blue',
  UPLOADING:  'badge-blue',
};

const selectStyle: React.CSSProperties = {
  height: 40, width: '100%',
  background: 'var(--surface-2, #1a2235)',
  border: '1px solid var(--clr-border, #1e2d45)',
  color: 'var(--clr-text, #f1f5f9)',
  borderRadius: 8,
  paddingLeft: 12,
  fontSize: 14,
  outline: 'none',
};

function supportsWorkspaceAnalysis(fileType: FileType): boolean {
  return fileType !== 'PRESCRIPTION' && fileType !== 'DISCHARGE_SUMMARY';
}

function requestAnalysisForWorkspace(
  patientId: string,
  medicalFileId: string,
  fileType: FileType,
  clinicalNotes?: string
): Promise<AnalysisResponse> {
  if (!supportsWorkspaceAnalysis(fileType)) {
    return Promise.reject(
      new Error('Workspace analysis is not available for this document type yet.')
    );
  }

  if (fileType === 'BLOOD_REPORT' || fileType === 'LAB_REPORT') {
    return analysisService.requestBloodReport(patientId, medicalFileId, clinicalNotes);
  }

  return analysisService.requestImageAnalysis(patientId, medicalFileId, clinicalNotes);
}

async function waitForWorkspaceReview(patientId: string, analysisId: string) {
  let completed = false;

  for (let attempt = 0; attempt < WORKSPACE_POLL_ATTEMPTS; attempt += 1) {
    const analysis = await analysisService.getAnalysis(analysisId);

    if (analysis.status === 'FAILED') {
      throw new Error(analysis.errorMessage || 'Analysis failed before a workspace review could be created.');
    }

    if (analysis.status === 'COMPLETED') {
      // Check if the AI model abstained
      let isAbstained = Boolean(analysis.abstained);
      let abstentionReason = analysis.abstentionReason;

      if (!isAbstained && analysis.rawResult) {
        try {
          const parsed = JSON.parse(analysis.rawResult);
          if (parsed.abstained) {
            isAbstained = true;
            abstentionReason = parsed.abstentionReason || abstentionReason;
          }
        } catch {
          // ignore parsing error
        }
      }

      if (isAbstained) {
        throw new Error(
          abstentionReason
            ? `AI declined interpretation: ${abstentionReason}`
            : 'The AI model declined to interpret this image (abstained). No clinical workspace review was generated.'
        );
      }

      completed = true;
      try {
        const review = await reportService.getForAnalysis(analysisId);
        if (review) return review;
      } catch {
        // Fallback to patient reviews search
        const reviews = await reportService.forPatient(patientId, 0, 50);
        const review = reviews.content.find((candidate) => candidate.analysisId === analysisId);
        if (review) return review;
      }
    }

    await delay(WORKSPACE_POLL_INTERVAL_MS);
  }

  throw new Error(
    completed
      ? 'Analysis completed, but the clinical workspace review is not ready yet. Check the worklist in a moment.'
      : 'Analysis is still processing. Check the worklist shortly for the clinical workspace review.'
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function UploadPage() {
  const navigate = useNavigate();
  const role = useAuthStore((state) => state.role);
  const canDeleteUploads = role === 'HOSPITAL_ADMIN';
  const [mode, setMode] = useState<UploadMode>('single');
  const [patients, setPatients]     = useState<Patient[]>([]);
  const [selectedPatient, setSP]    = useState('');
  const [fileType, setFileType]     = useState<FileType>('XRAY');
  const [description, setDesc]      = useState('');
  const [selectedFile, setSF]       = useState<File | null>(null);
  const [uploading, setUploading]   = useState(false);
  const [workspaceUploading, setWorkspaceUploading] = useState(false);
  const [workspaceNotice, setWorkspaceNotice] = useState<string | null>(null);
  const [uploadResult, setResult]   = useState<{ success: boolean; error?: string } | null>(null);
  const [recentFiles, setRecent]    = useState<MedicalFile[]>([]);
  const [recentFilesNotice, setRecentFilesNotice] = useState<RecentFilesNotice | null>(null);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  // Batch state
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [batchResults, setBatchResults] = useState<BatchUploadResult[]>([]);
  const [batchUploading, setBatchUploading] = useState(false);
  const [batchWorkspaceUploading, setBatchWorkspaceUploading] = useState(false);
  const [batchWorkspaceNotice, setBatchWorkspaceNotice] = useState<string | null>(null);
  const [reportText, setReportText] = useState('');
  const [textDraftError, setTextDraftError] = useState<string | null>(null);
  const [savingTextDraft, setSavingTextDraft] = useState(false);

  useEffect(() => {
    patientService.list(0, 100).then((r) => setPatients(r.content)).catch(() => {});
  }, []);

  const loadRecent = useCallback(async () => {
    if (!selectedPatient) return;
    try { const r = await fileService.list(selectedPatient, 0, 10); setRecent(r.content); }
    catch { /* ignore */ }
  }, [selectedPatient]);

  useEffect(() => { loadRecent(); }, [loadRecent]);

  // Single file dropzone
  const onDrop = useCallback((files: File[]) => {
    if (files.length > 0) { setSF(files[0]); setResult(null); setWorkspaceNotice(null); }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, maxFiles: 1, maxSize: 100 * 1024 * 1024,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.dcm'],
      'application/pdf': ['.pdf'],
      'application/dicom': ['.dcm'],
      'text/plain': ['.txt', '.csv', '.md'],
    },
  });

  // Batch dropzone
  const onBatchDrop = useCallback((files: File[]) => {
    setBatchFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name));
      return [...prev, ...files.filter((f) => !existing.has(f.name))];
    });
    setBatchResults([]);
    setBatchWorkspaceNotice(null);
  }, []);

  const { getRootProps: getBatchRootProps, getInputProps: getBatchInputProps, isDragActive: isBatchDragActive } = useDropzone({
    onDrop: onBatchDrop, maxSize: 100 * 1024 * 1024, multiple: true,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.dcm'],
      'application/pdf': ['.pdf'],
      'application/dicom': ['.dcm'],
      'text/plain': ['.txt', '.csv', '.md'],
    },
  });

  const removeBatchFile = (index: number) => {
    setBatchFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDeleteUpload = async (file: MedicalFile) => {
    if (!selectedPatient || deletingFileId) return;
    const confirmed = window.confirm(`Delete "${file.originalFileName}" from this patient?`);
    if (!confirmed) return;

    setDeletingFileId(file.id);
    setRecentFilesNotice(null);

    try {
      await fileService.delete(selectedPatient, file.id);
      setRecent((prev) => prev.filter((candidate) => candidate.id !== file.id));
      setRecentFilesNotice({ type: 'success', message: 'Uploaded file deleted.' });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setRecentFilesNotice({
        type: 'error',
        message: e.response?.data?.message || e.message || 'Could not delete uploaded file.',
      });
    } finally {
      setDeletingFileId(null);
    }
  };

  const handleBatchUpload = async () => {
    if (!selectedPatient || batchFiles.length === 0) return;
    setBatchUploading(true);
    setBatchResults([]);
    setRecentFilesNotice(null);
    const fd = new FormData();
    batchFiles.forEach((f) => fd.append('files', f));
    fd.append('fileType', fileType);
    if (description) fd.append('description', description);
    try {
      const res = await api.post(
        `/patients/${selectedPatient}/files/batch`,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      const data = res.data.data as BatchUploadResult[];
      setBatchResults(data);
      loadRecent();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setBatchResults(batchFiles.map((f) => ({ filename: f.name, success: false, error: e.response?.data?.message || 'Upload failed' })));
    } finally {
      setBatchUploading(false);
    }
  };

  const handleBatchUploadToWorkspace = async () => {
    if (!selectedPatient || batchFiles.length === 0 || !canOpenWorkspaceFromFile) return;

    setBatchWorkspaceUploading(true);
    setBatchResults([]);
    setRecentFilesNotice(null);
    setBatchWorkspaceNotice('Uploading files before queueing workspace reviews...');

    const fd = new FormData();
    batchFiles.forEach((f) => fd.append('files', f));
    fd.append('fileType', fileType);
    if (description) fd.append('description', description);

    try {
      const res = await api.post(
        `/patients/${selectedPatient}/files/batch`,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      const data = res.data.data as BatchUploadResult[];
      setBatchResults(data);
      loadRecent();

      const uploaded = data.filter((result) => result.success && result.fileId);
      if (uploaded.length === 0) {
        throw new Error('No files uploaded successfully, so no workspace reviews were queued.');
      }

      setBatchWorkspaceNotice(`Starting analysis for ${uploaded.length} uploaded file${uploaded.length > 1 ? 's' : ''}...`);
      const started = await Promise.allSettled(
        uploaded.map((result) =>
          requestAnalysisForWorkspace(
            selectedPatient,
            result.fileId!,
            fileType,
            description || undefined
          )
        )
      );
      const startedCount = started.filter((result) => result.status === 'fulfilled').length;
      if (startedCount === 0) {
        const firstFailure = started.find((result) => result.status === 'rejected');
        throw new Error(
          firstFailure?.status === 'rejected' && firstFailure.reason instanceof Error
            ? firstFailure.reason.message
            : 'No workspace reviews could be queued.'
        );
      }

      setBatchWorkspaceNotice(`${startedCount} review${startedCount > 1 ? 's' : ''} queued. Opening the worklist...`);
      navigate('/worklist');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setBatchWorkspaceNotice(null);
      setBatchResults(batchFiles.map((f) => ({
        filename: f.name,
        success: false,
        error: e.response?.data?.message || e.message || 'Could not queue workspace reviews',
      })));
    } finally {
      setBatchWorkspaceUploading(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedPatient) return;
    setUploading(true); setResult(null);
    setRecentFilesNotice(null);
    try {
      await fileService.upload(selectedPatient, selectedFile, fileType, description || undefined);
      setResult({ success: true }); setSF(null); setDesc(''); setWorkspaceNotice(null); loadRecent();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setResult({ success: false, error: e.response?.data?.message || 'Upload failed' });
    } finally { setUploading(false); }
  };

  const handleUploadToWorkspace = async () => {
    if (!selectedFile || !selectedPatient) return;

    setWorkspaceUploading(true);
    setResult(null);
    setRecentFilesNotice(null);
    setWorkspaceNotice('Uploading file and starting clinical review...');

    try {
      const uploaded = await fileService.upload(
        selectedPatient,
        selectedFile,
        fileType,
        description || undefined
      );
      const analysis = await requestAnalysisForWorkspace(
        selectedPatient,
        uploaded.id,
        fileType,
        description || undefined
      );

      setWorkspaceNotice('Analysis started. Waiting for the workspace review...');
      const review = await waitForWorkspaceReview(selectedPatient, analysis.id);
      navigate(`/clinical-workspace/${review.id}`);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setWorkspaceNotice(null);
      setResult({
        success: false,
        error: e.response?.data?.message || e.message || 'Could not open this file in the clinical workspace.',
      });
    } finally {
      setWorkspaceUploading(false);
    }
  };

  const handleTextDraft = async () => {
    if (!selectedPatient) {
      setTextDraftError('Select a patient before saving.');
      return;
    }
    if (!reportText.trim()) {
      setTextDraftError('Paste report text before saving.');
      return;
    }

    setSavingTextDraft(true);
    setTextDraftError(null);
    try {
      const review = await reportService.createTextDraft({
        patientId: selectedPatient,
        reportText,
        modality: fileType,
        studyDescription: description || undefined,
      });
      navigate(`/clinical-workspace/${review.id}`);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setTextDraftError(e.response?.data?.message || 'Could not save pasted report.');
    } finally {
      setSavingTextDraft(false);
    }
  };

  const cancelTextDraft = () => {
    setReportText('');
    setTextDraftError(null);
    setMode('single');
  };

  const fmt = (b: number) => {
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
    return (b / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const selectedFT = FILE_TYPE_OPTIONS.find((f) => f.value === fileType);
  const canOpenWorkspaceFromFile = supportsWorkspaceAnalysis(fileType);

  return (
    <div className="space-y-6 max-w-[1100px]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Plus Jakarta Sans' }}>Upload Studies</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--clr-text-3)' }}>Ingest studies, clinical documents, and report drafts for review</p>
        </div>

        {/* Mode Switcher */}
        <div
          className="flex flex-wrap p-1 rounded-xl"
          style={{ background: 'var(--surface-2, #1a2235)', border: '1px solid var(--clr-border, #1e2d45)' }}
        >
          <button
            type="button"
            onClick={() => { setMode('single'); setTextDraftError(null); setWorkspaceNotice(null); setBatchWorkspaceNotice(null); }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              mode === 'single' ? 'text-white' : 'text-slate-400 hover:text-white'
            }`}
            style={{
              background: mode === 'single' ? 'linear-gradient(135deg, #3b82f6, #06b6d4)' : 'transparent',
              boxShadow: mode === 'single' ? '0 2px 8px rgba(59,130,246,0.3)' : 'none',
            }}
          >
            <Upload className="h-3.5 w-3.5" />
            Single File
          </button>
          <button
            type="button"
            onClick={() => { setMode('batch'); setTextDraftError(null); setWorkspaceNotice(null); setBatchWorkspaceNotice(null); }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              mode === 'batch' ? 'text-white' : 'text-slate-400 hover:text-white'
            }`}
            style={{
              background: mode === 'batch' ? 'linear-gradient(135deg, #3b82f6, #06b6d4)' : 'transparent',
              boxShadow: mode === 'batch' ? '0 2px 8px rgba(59,130,246,0.3)' : 'none',
            }}
          >
            <Files className="h-3.5 w-3.5" />
            Batch Studies
          </button>
          <button
            type="button"
            onClick={() => { setMode('text'); setResult(null); setWorkspaceNotice(null); setBatchWorkspaceNotice(null); }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              mode === 'text' ? 'text-white' : 'text-slate-400 hover:text-white'
            }`}
            style={{
              background: mode === 'text' ? 'linear-gradient(135deg, #3b82f6, #06b6d4)' : 'transparent',
              boxShadow: mode === 'text' ? '0 2px 8px rgba(59,130,246,0.3)' : 'none',
            }}
          >
            <FileText className="h-3.5 w-3.5" />
            Paste Report Text
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-5">
        {/* ── Upload form — 3 cols ── */}
        <div className="lg:col-span-3 rounded-2xl p-6 space-y-5"
          style={{ background: 'var(--surface, #111827)', border: '1px solid var(--clr-border, #1e2d45)' }}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white" style={{ fontFamily: 'Plus Jakarta Sans' }}>
              {mode === 'single'
                ? 'Single Study Upload'
                : mode === 'batch'
                  ? 'Batch Studies Ingestion'
                  : 'Paste Report Text'}
            </h3>
            {mode === 'batch' && batchFiles.length > 0 && (
              <span className="badge badge-blue text-[11px]">{batchFiles.length} file{batchFiles.length > 1 ? 's' : ''} queued</span>
            )}
          </div>

          {/* Patient select */}
          <div>
            <Label htmlFor="upload-patient-select">Select Patient</Label>
            <select
              id="upload-patient-select"
              aria-label="Select Patient"
              style={selectStyle}
              value={selectedPatient}
              onChange={(e) => { setSP(e.target.value); setRecentFilesNotice(null); }}
              required
            >
              <option value="">Choose patient…</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.fullName} — {p.medicalRecordNumber}</option>
              ))}
            </select>
            {patients.length === 0 && (
              <p className="text-xs mt-2" style={{ color: 'var(--clr-text-3)' }}>
                No patients available. <Link className="text-blue-300 hover:text-blue-200" to="/patients">Create a patient first.</Link>
              </p>
            )}
          </div>

          {/* File type chips */}
          <div>
            <Label>{mode === 'text' ? 'Report Type / Modality' : 'Study / Document Type'}</Label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {FILE_TYPE_OPTIONS.map(({ value, label, icon: Icon, color }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFileType(value)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: fileType === value ? `${color}20` : 'var(--surface-2, #1a2235)',
                    border: `1px solid ${fileType === value ? color + '60' : 'var(--clr-border, #1e2d45)'}`,
                    color: fileType === value ? color : 'var(--clr-text-2, #94a3b8)',
                  }}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <Label>
              {mode === 'text' ? 'Study Description' : 'Clinical Notes'}{' '}
              <span className="opacity-50 font-normal">(optional)</span>
            </Label>
            <textarea
              className="w-full rounded-lg px-3 py-2 text-sm resize-none outline-none transition-all"
              style={{
                background: 'var(--surface-2, #1a2235)',
                border: '1px solid var(--clr-border, #1e2d45)',
                color: 'var(--clr-text, #f1f5f9)',
                minHeight: 64,
              }}
              placeholder={mode === 'text'
                ? 'Study description, modality details, or accession notes…'
                : 'Clinical notes, modality specifications, or relevant patient context…'}
              value={description}
              onChange={(e) => setDesc(e.target.value)}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.15)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--clr-border, #1e2d45)'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>

          {/* Ingestion body */}
          {mode === 'single' ? (
            <div
              {...getRootProps()}
              className="relative flex cursor-pointer flex-col items-center justify-center rounded-xl p-7 text-center transition-all"
              style={{
                background: isDragActive ? 'rgba(59,130,246,0.08)' : selectedFile ? 'rgba(16,185,129,0.05)' : 'var(--surface-2, #1a2235)',
                border: `2px dashed ${isDragActive ? '#3b82f6' : selectedFile ? '#10b981' : 'var(--clr-border-2, #243250)'}`,
              }}
            >
              <input {...getInputProps({ 'aria-label': 'Single study file' })} />
              {selectedFile ? (
                <>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl mb-3"
                    style={{ background: `${selectedFT?.color ?? '#10b981'}20` }}>
                    {selectedFT ? <selectedFT.icon className="h-6 w-6" style={{ color: selectedFT.color }} /> : <FileImage className="h-6 w-6 text-emerald-400" />}
                  </div>
                  <p className="font-semibold text-white text-sm">{selectedFile.name}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--clr-text-3)' }}>{fmt(selectedFile.size)}</p>
                  <button
                    type="button"
                    className="mt-3 text-xs flex items-center gap-1 hover:text-red-400 transition-colors"
                    style={{ color: 'var(--clr-text-3)' }}
                    onClick={(e) => { e.stopPropagation(); setSF(null); setWorkspaceNotice(null); }}
                  >
                    <X className="h-3 w-3" /> Remove
                  </button>
                </>
              ) : (
                <>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl mb-3"
                    style={{ background: 'rgba(59,130,246,0.1)' }}>
                    <Upload className="h-6 w-6" style={{ color: '#3b82f6' }} />
                  </div>
                  <p className="font-semibold text-white text-sm">
                    {isDragActive ? 'Drop the file here…' : 'Drag & drop single study or click to select'}
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--clr-text-3)' }}>
                    DICOM, JPEG, PNG, PDF, TXT, CSV · Max 100 MB
                  </p>
                </>
              )}
            </div>
          ) : mode === 'batch' ? (
            /* Batch dropzone */
            <div className="space-y-3">
              <div
                {...getBatchRootProps()}
                className="relative flex cursor-pointer flex-col items-center justify-center rounded-xl p-6 text-center transition-all"
                style={{
                  background: isBatchDragActive ? 'rgba(59,130,246,0.08)' : 'var(--surface-2, #1a2235)',
                  border: `2px dashed ${isBatchDragActive ? '#3b82f6' : 'var(--clr-border-2, #243250)'}`,
                }}
              >
                <input {...getBatchInputProps({ 'aria-label': 'Batch study files' })} />
                <div className="flex h-10 w-10 items-center justify-center rounded-xl mb-2"
                  style={{ background: 'rgba(59,130,246,0.1)' }}>
                  <Files className="h-5 w-5" style={{ color: '#3b82f6' }} />
                </div>
                <p className="font-semibold text-white text-sm">
                  {isBatchDragActive ? 'Drop files here…' : 'Drag & drop multiple files or click to add'}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--clr-text-3)' }}>
                  Select N files at once · DICOM, PNG, JPG, PDF, TXT, CSV
                </p>
              </div>

              {/* Selected Batch Files List */}
              {batchFiles.length > 0 && (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {batchFiles.map((file, idx) => {
                    const result = batchResults.find((r) => r.filename === file.name);
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between px-3 py-2 rounded-lg text-xs"
                        style={{
                          background: 'var(--surface-2, #1a2235)',
                          border: `1px solid ${result ? (result.success ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)') : 'var(--clr-border, #1e2d45)'}`,
                        }}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <FileImage className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                          <span className="text-white truncate font-medium">{file.name}</span>
                          <span className="text-[11px] shrink-0" style={{ color: 'var(--clr-text-3)' }}>({fmt(file.size)})</span>
                        </div>

                        <div className="flex items-center gap-2 ml-2 shrink-0">
                          {result ? (
                            result.success ? (
                              <span className="flex items-center gap-1 text-emerald-400 font-semibold text-[11px]">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Uploaded
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-red-400 font-semibold text-[11px]">
                                <XCircle className="h-3.5 w-3.5" /> {result.error || 'Failed'}
                              </span>
                            )
                          ) : (
                            <button
                              type="button"
                              onClick={() => removeBatchFile(idx)}
                              className="text-slate-500 hover:text-red-400 transition-colors p-1"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label htmlFor="pasted-report-text">Report Text</Label>
                <textarea
                  id="pasted-report-text"
                  aria-label="Report Text"
                  className="w-full rounded-lg px-3 py-3 text-sm outline-none transition-all"
                  style={{
                    background: 'var(--surface-2, #1a2235)',
                    border: '1px solid var(--clr-border, #1e2d45)',
                    color: 'var(--clr-text, #f1f5f9)',
                    minHeight: 240,
                  }}
                  placeholder="Paste findings and impression text here…"
                  value={reportText}
                  onChange={(e) => { setReportText(e.target.value); setTextDraftError(null); }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.15)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--clr-border, #1e2d45)'; e.currentTarget.style.boxShadow = 'none'; }}
                />
              </div>

              {textDraftError && (
                <div className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm"
                  style={{
                    background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    color: '#fca5a5',
                  }}>
                  <XCircle className="h-4 w-4 shrink-0" style={{ color: '#ef4444' }} />
                  {textDraftError}
                </div>
              )}

              <div className="grid gap-2 sm:grid-cols-[1fr_2fr]">
                <Button
                  type="button"
                  size="lg"
                  variant="secondary"
                  onClick={cancelTextDraft}
                  disabled={savingTextDraft}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="lg"
                  onClick={handleTextDraft}
                  disabled={!selectedPatient || !reportText.trim() || savingTextDraft}
                >
                  {savingTextDraft
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving Draft…</>
                    : <><FileText className="h-4 w-4" /> Save Draft & Open Workspace</>}
                </Button>
              </div>
            </div>
          )}

          {/* Result feedback for single mode */}
          {mode === 'single' && uploadResult && (
            <div className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm"
              style={{
                background: uploadResult.success ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                border: `1px solid ${uploadResult.success ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                color: uploadResult.success ? '#34d399' : '#fca5a5',
              }}>
              {uploadResult.success
                ? <CheckCircle2 className="h-4 w-4 shrink-0" />
                : <XCircle className="h-4 w-4 shrink-0" style={{ color: '#ef4444' }} />}
              {uploadResult.success ? 'File uploaded successfully!' : uploadResult.error}
            </div>
          )}

          {mode === 'single' && workspaceNotice && (
            <div className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm"
              style={{
                background: 'rgba(59,130,246,0.08)',
                border: '1px solid rgba(59,130,246,0.3)',
                color: '#bfdbfe',
              }}>
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" style={{ color: '#60a5fa' }} />
              {workspaceNotice}
            </div>
          )}

          {mode === 'batch' && batchWorkspaceNotice && (
            <div className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm"
              style={{
                background: 'rgba(59,130,246,0.08)',
                border: '1px solid rgba(59,130,246,0.3)',
                color: '#bfdbfe',
              }}>
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" style={{ color: '#60a5fa' }} />
              {batchWorkspaceNotice}
            </div>
          )}

          {/* Action button */}
          {mode === 'single' ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                size="lg"
                variant="secondary"
                onClick={handleUpload}
                disabled={!selectedFile || !selectedPatient || uploading || workspaceUploading}
              >
                {uploading
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</>
                  : <><Upload className="h-4 w-4" /> Upload File</>}
              </Button>
              <Button
                size="lg"
                onClick={handleUploadToWorkspace}
                disabled={!selectedFile || !selectedPatient || uploading || workspaceUploading || !canOpenWorkspaceFromFile}
                title={canOpenWorkspaceFromFile
                  ? undefined
                  : 'Workspace analysis is available for imaging, blood report, and lab report files.'}
              >
                {workspaceUploading
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Opening…</>
                  : <><FileText className="h-4 w-4" /> Upload &amp; Open Workspace</>}
              </Button>
            </div>
          ) : mode === 'batch' ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                size="lg"
                variant="secondary"
                onClick={handleBatchUpload}
                disabled={batchFiles.length === 0 || !selectedPatient || batchUploading || batchWorkspaceUploading}
              >
                {batchUploading
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</>
                  : <><Files className="h-4 w-4" /> Upload Batch</>}
              </Button>
              <Button
                size="lg"
                onClick={handleBatchUploadToWorkspace}
                disabled={batchFiles.length === 0 || !selectedPatient || batchUploading || batchWorkspaceUploading || !canOpenWorkspaceFromFile}
                title={canOpenWorkspaceFromFile
                  ? undefined
                  : 'Workspace analysis is available for imaging, blood report, and lab report files.'}
              >
                {batchWorkspaceUploading
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Queueing…</>
                  : <><FileText className="h-4 w-4" /> Upload &amp; Queue Reviews</>}
              </Button>
            </div>
          ) : null}
        </div>

        {/* ── Recent uploads — 2 cols ── */}
        <div className="lg:col-span-2 rounded-2xl p-5"
          style={{ background: 'var(--surface, #111827)', border: '1px solid var(--clr-border, #1e2d45)' }}>
          <h3 className="text-sm font-bold text-white mb-4" style={{ fontFamily: 'Plus Jakarta Sans' }}>Recent Uploads</h3>

          {selectedPatient && recentFilesNotice && (
            <div
              className="mb-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
              style={{
                background: recentFilesNotice.type === 'success' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                border: `1px solid ${recentFilesNotice.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                color: recentFilesNotice.type === 'success' ? '#34d399' : '#fca5a5',
              }}
            >
              {recentFilesNotice.type === 'success'
                ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                : <XCircle className="h-3.5 w-3.5 shrink-0" />}
              {recentFilesNotice.message}
            </div>
          )}

          {!selectedPatient ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl mb-3"
                style={{ background: 'rgba(100,116,139,0.1)' }}>
                <FileImage className="h-5 w-5" style={{ color: 'var(--clr-text-3)' }} />
              </div>
              <p className="text-xs text-center" style={{ color: 'var(--clr-text-3)' }}>
                Select a patient above<br />to see their uploaded files
              </p>
            </div>
          ) : recentFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl mb-3"
                style={{ background: 'rgba(100,116,139,0.1)' }}>
                <Upload className="h-5 w-5" style={{ color: 'var(--clr-text-3)' }} />
              </div>
              <p className="text-xs" style={{ color: 'var(--clr-text-3)' }}>No files uploaded yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentFiles.map((f) => {
                const ft = FILE_TYPE_OPTIONS.find((t) => t.value === f.fileType);
                return (
                  <div key={f.id} className="flex items-start gap-3 rounded-xl p-3 transition-colors"
                    style={{ background: 'var(--surface-2, #1a2235)', border: '1px solid var(--clr-border, #1e2d45)' }}>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                      style={{ background: `${ft?.color ?? '#3b82f6'}18` }}>
                      {ft ? <ft.icon className="h-4 w-4" style={{ color: ft.color }} /> : <FileImage className="h-4 w-4 text-blue-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{f.originalFileName}</p>
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--clr-text-3)' }}>
                        {f.fileType.replace(/_/g, ' ')} · {fmt(f.fileSizeBytes)}
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--clr-text-3)' }}>
                        {new Date(f.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className={`badge ${statusBadge[f.uploadStatus] ?? 'badge-slate'} text-[10px]`}>
                        {f.uploadStatus}
                      </span>
                      {canDeleteUploads && (
                        <button
                          type="button"
                          aria-label={`Delete upload ${f.originalFileName}`}
                          title="Delete upload"
                          onClick={() => handleDeleteUpload(f)}
                          disabled={deletingFileId === f.id}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition-colors hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-60"
                          style={{ background: 'rgba(15,23,42,0.55)', border: '1px solid var(--clr-border, #1e2d45)' }}
                        >
                          {deletingFileId === f.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
