import { useState, useEffect } from 'react';
import { AlertTriangle, FileText, Edit2, Check, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import type { DraftReport, QaIssue, ReportSection } from '@/types/clinicalWorkspace';

interface ReportPanelProps {
  report: DraftReport;
  selectedIssue?: QaIssue | null;
  onSaveReport?: (updatedSections: ReportSection[]) => void | Promise<void>;
  saving?: boolean;
}

const sectionAccent: Record<string, string> = {
  findings: '#3b82f6',
  comparison: '#a855f7',
  impression: '#8b5cf6',
};

export function ReportPanel({ report, selectedIssue, onSaveReport, saving }: ReportPanelProps) {
  const metadata = report.metadata;
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  useEffect(() => {
    const initial: Record<string, string> = {};
    report.sections.forEach((s) => {
      initial[s.id] = s.body.join('\n');
    });
    setEditValues(initial);
  }, [report.sections]);

  const handleCancel = () => {
    const initial: Record<string, string> = {};
    report.sections.forEach((s) => {
      initial[s.id] = s.body.join('\n');
    });
    setEditValues(initial);
    setIsEditing(false);
  };

  const handleSave = async () => {
    const updated: ReportSection[] = report.sections.map((s) => ({
      ...s,
      body: (editValues[s.id] ?? s.body.join('\n'))
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0),
    }));

    if (onSaveReport) {
      await onSaveReport(updated);
    }
    setIsEditing(false);
  };

  return (
    <Card className="h-full min-w-0">
      <CardHeader className="border-b" style={{ borderColor: 'var(--clr-border, #1e2d45)' }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-400" />
              Radiology Report
            </CardTitle>
            <CardDescription>
              Draft created {report.createdAt} by {report.radiologist}
            </CardDescription>
          </div>
          {isEditing ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium text-slate-400 hover:text-white"
                style={{ borderColor: 'var(--clr-border, #1e2d45)' }}
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-500 shadow-sm"
              >
                <Check className="h-3.5 w-3.5" />
                {saving ? 'Saving...' : 'Save Draft'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold text-blue-400 hover:bg-blue-500/10 hover:text-blue-300 transition-colors"
              style={{ borderColor: 'var(--clr-border-2, #243250)', background: 'rgba(255,255,255,0.03)' }}
            >
              <Edit2 className="h-3.5 w-3.5" />
              Edit
            </button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-5 p-5">
        {selectedIssue && (
          <div className="rounded-lg border border-amber-500/25 bg-amber-950/20 px-3 py-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-amber-200">Potential issue selected</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-amber-100/80">
                  {selectedIssue.message}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {report.sections.map((section) => (
            <section
              key={section.id}
              className="rounded-lg border-y border-r bg-slate-950/30 py-4 pl-4 pr-4"
              style={{
                borderColor: 'var(--clr-border, #1e2d45)',
                borderLeft: `3px solid ${sectionAccent[section.id] ?? '#3b82f6'}`,
              }}
            >
              <h2 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-500">
                {section.title}
              </h2>
              {isEditing ? (
                <textarea
                  value={editValues[section.id] ?? ''}
                  onChange={(e) =>
                    setEditValues((prev) => ({
                      ...prev,
                      [section.id]: e.target.value,
                    }))
                  }
                  rows={Math.max(3, (editValues[section.id] ?? '').split('\n').length + 1)}
                  className="w-full rounded-md border border-slate-700 bg-slate-900/90 p-3 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed font-sans"
                  placeholder={`Enter ${section.title.toLowerCase()}...`}
                />
              ) : (
                <div className="space-y-2">
                  {section.body.map((line, index) => (
                    <p key={`${section.id}-${index}`} className="text-sm leading-7 text-slate-200">
                      {line}
                    </p>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>

        {metadata && (
          <div className="border-t pt-4" style={{ borderColor: 'var(--clr-border, #1e2d45)' }}>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Report Metadata</p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
              <MetaField label="Report Status" value={metadata.reportStatus.replace(/_/g, ' ')} />
              <MetaField label="Created" value={metadata.createdAt} />
              <MetaField label="Created By" value={metadata.createdBy ?? 'Not recorded'} />
              <MetaField label="Last Updated" value={metadata.lastUpdatedAt ?? metadata.lastUpdatedLabel} />
            </dl>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="mt-0.5 truncate font-semibold text-slate-200">{value}</dd>
    </div>
  );
}
