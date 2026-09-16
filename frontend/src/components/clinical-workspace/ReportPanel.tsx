import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, FileText, Edit2, Check, X, Mic, MicOff, Zap, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import type { DraftReport, QaIssue, ReportSection } from '@/types/clinicalWorkspace';
import { useSpeechDictation } from '@/hooks/useSpeechDictation';
import { RADIOLOGY_MACROS, expandMacroInText, type RadiologyMacro } from '@/utils/radiologyMacros';

interface ReportPanelProps {
  report: DraftReport;
  selectedIssue?: QaIssue | null;
  onSaveReport?: (updatedSections: ReportSection[]) => void | boolean | Promise<void | boolean>;
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
  const [dictationNotice, setDictationNotice] = useState<string | null>(null);

  useEffect(() => {
    const initial: Record<string, string> = {};
    report.sections.forEach((s) => {
      initial[s.id] = s.body.join('\n');
    });
    setEditValues(initial);
  }, [report.sections]);

  const handleSpeechResult = useCallback((spokenText: string, isFinal: boolean) => {
    if (!isFinal) return;
    setIsEditing(true);

    setEditValues((prev) => {
      const currentFindings = prev['findings'] || '';
      const updatedFindings = currentFindings ? `${currentFindings} ${spokenText}` : spokenText;
      const { expandedText, appliedMacro } = expandMacroInText(updatedFindings);

      if (appliedMacro) {
        setDictationNotice(`Expanded smart macro ${appliedMacro.shortcut} (${appliedMacro.name})`);
        return {
          ...prev,
          findings: expandedText,
          impression: prev['impression'] ? `${prev['impression']}\n${appliedMacro.impression}` : appliedMacro.impression,
        };
      }

      return {
        ...prev,
        findings: updatedFindings,
      };
    });
  }, []);

  const { isListening, isSupported, toggleDictation, error: speechError } = useSpeechDictation({
    onResult: handleSpeechResult,
  });

  const applyMacro = (macro: RadiologyMacro) => {
    setIsEditing(true);
    setEditValues((prev) => ({
      ...prev,
      findings: macro.findings,
      impression: macro.impression,
    }));
    setDictationNotice(`Applied Smart Macro: ${macro.shortcut} (${macro.name})`);
  };

  const handleTextareaChange = (sectionId: string, rawText: string) => {
    const { expandedText, appliedMacro } = expandMacroInText(rawText);
    if (appliedMacro) {
      setDictationNotice(`Expanded smart macro ${appliedMacro.shortcut} (${appliedMacro.name})`);
      setEditValues((prev) => ({
        ...prev,
        [sectionId]: expandedText,
        impression: prev['impression'] ? prev['impression'] : appliedMacro.impression,
      }));
    } else {
      setEditValues((prev) => ({
        ...prev,
        [sectionId]: rawText,
      }));
    }
  };

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
      const saved = await onSaveReport(updated);
      if (saved === false) return;
    }
    setIsEditing(false);
  };

  return (
    <Card className="h-full min-w-0">
      <CardHeader className="border-b" style={{ borderColor: 'var(--clr-border, #1e2d45)' }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-400" />
              Radiology Report
            </CardTitle>
            <CardDescription>
              Draft created {report.createdAt} by {report.radiologist}
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Live Dictation Button */}
            {isSupported && (
              <button
                type="button"
                onClick={toggleDictation}
                className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-all ${
                  isListening
                    ? 'border-red-500/50 bg-red-600 text-white animate-pulse shadow-lg shadow-red-500/20'
                    : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-600 hover:text-white'
                }`}
              >
                {isListening ? (
                  <>
                    <Mic className="h-3.5 w-3.5 text-white animate-bounce" />
                    Listening...
                  </>
                ) : (
                  <>
                    <MicOff className="h-3.5 w-3.5 text-blue-400" />
                    Dictate
                  </>
                )}
              </button>
            )}

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
        </div>

        {/* Smart Macros Toolbar */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-800/60">
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1">
            <Zap className="h-3 w-3 text-amber-400" />
            Macros:
          </span>
          {RADIOLOGY_MACROS.map((macro) => (
            <button
              key={macro.shortcut}
              type="button"
              onClick={() => applyMacro(macro)}
              className="inline-flex items-center gap-1 rounded-md border border-slate-800 bg-slate-900/80 px-2 py-0.5 text-[11px] font-medium text-slate-300 hover:border-amber-500/40 hover:bg-amber-950/20 hover:text-amber-200 transition-all"
              title={`${macro.name}: Auto-populates Findings & Impression`}
            >
              <Sparkles className="h-2.5 w-2.5 text-amber-400" />
              {macro.shortcut}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-5">
        {/* Dictation / Macro Notice Banner */}
        {(isListening || dictationNotice || speechError) && (
          <div
            className={`rounded-lg border px-3 py-2 text-xs flex items-center justify-between gap-2 ${
              speechError
                ? 'border-red-500/30 bg-red-950/20 text-red-200'
                : isListening
                ? 'border-blue-500/30 bg-blue-950/20 text-blue-200 animate-pulse'
                : 'border-amber-500/30 bg-amber-950/20 text-amber-200'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {isListening ? (
                <Mic className="h-4 w-4 shrink-0 text-red-400 animate-pulse" />
              ) : (
                <Sparkles className="h-4 w-4 shrink-0 text-amber-300" />
              )}
              <p className="truncate">
                {speechError
                  ? speechError
                  : isListening
                  ? 'Listening hands-free... Speak your radiology findings (or say e.g. "dot normal chest X-ray").'
                  : dictationNotice}
              </p>
            </div>
            {dictationNotice && (
              <button
                type="button"
                onClick={() => setDictationNotice(null)}
                className="text-slate-400 hover:text-white shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
        {selectedIssue && (
          <div className="rounded-lg border border-amber-500/25 bg-amber-950/20 px-3 py-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 min-w-0">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-amber-200">Potential issue selected</p>
                    {['UNREPORTED_IMAGE_FINDING', 'MEASUREMENT_DISCREPANCY', 'IMAGE_TEXT_LOCATION_MISMATCH'].includes(selectedIssue.type) && (
                      <span className="rounded bg-blue-500/20 border border-blue-400/30 px-1.5 py-0.5 text-[9px] font-bold text-blue-300 uppercase tracking-wider">
                        DICOM Ground-Truth AI
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-amber-100/80">
                    {selectedIssue.message}
                  </p>
                </div>
              </div>
              {selectedIssue.type === 'UNREPORTED_IMAGE_FINDING' && selectedIssue.anatomySelection && (
                <button
                  type="button"
                  onClick={() => {
                    const insertText = `Image Vision AI finding: ${selectedIssue.anatomySelection?.displayName || 'Abnormality'} observed on DICOM scan.`;
                    const updated = report.sections.map((sec) => {
                      if (sec.id === 'findings') {
                        return { ...sec, body: [...sec.body, insertText] };
                      }
                      return sec;
                    });
                    if (onSaveReport) onSaveReport(updated);
                  }}
                  className="shrink-0 rounded bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-500 transition-colors shadow-sm"
                >
                  + Add to Findings
                </button>
              )}
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
                  onChange={(e) => handleTextareaChange(section.id, e.target.value)}
                  rows={Math.max(3, (editValues[section.id] ?? '').split('\n').length + 1)}
                  className="w-full rounded-md border border-slate-700 bg-slate-900/90 p-3 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed font-sans"
                  placeholder={`Enter ${section.title.toLowerCase()}... (or type e.g. .normalcxr)`}
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
