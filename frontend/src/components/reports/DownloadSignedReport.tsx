import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { reportService, type ReportReview } from '@/services/reportService';

export function signedReportText(report: ReportReview): string {
  if (report.status !== 'SIGNED' || !report.finalContent?.trim() || !report.signedAt || !report.signedBy) {
    throw new Error('This report does not have a complete sign-off. Refresh the report and try again.');
  }
  return [
    'MED-AI CLINICAL — SIGNED REPORT',
    `Report ID: ${report.id}`,
    `Patient: ${report.patientName || report.patientId}`,
    `Patient ID: ${report.patientId}`,
    `Report type: ${report.analysisType || 'Clinical report'}`,
    `Signed by (reviewer ID): ${report.signedBy}`,
    `Signed at: ${report.signedAt}`,
    `Review action: ${report.reviewAction || 'Signed'}`,
    ...(report.amendsReviewId ? [`Amends report: ${report.amendsReviewId}`] : []),
    '', 'FINAL SIGNED CONTENT', '', report.finalContent, '',
  ].join('\n');
}

export function DownloadSignedReport({ reportId }: { reportId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function download() {
    setBusy(true); setError('');
    try {
      // Re-read through the authenticated, tenant-scoped API: never export a stale draft.
      const report = await reportService.get(reportId);
      const content = signedReportText(report);
      const url = URL.createObjectURL(new Blob(['\uFEFF', content], { type: 'text/plain;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `signed-report-${report.id.replace(/[^a-zA-Z0-9-]/g, '')}.txt`;
      document.body.appendChild(link);
      try { link.click(); } finally { link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
    } catch (e) {
      setError(e instanceof Error && !('response' in e) ? e.message : 'Could not download the signed report. Please retry.');
    } finally { setBusy(false); }
  }
  return <div className="flex flex-col gap-1">
    <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => void download()}>
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
      {busy ? 'Downloading…' : 'Download signed report (.txt)'}
    </Button>
    {error && <p role="alert" className="max-w-sm text-xs text-red-300">{error}</p>}
  </div>;
}
