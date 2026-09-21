import type { ReactNode } from 'react';
import { CheckCircle2, Loader2, RotateCcw, Save, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { ClinicalReportStatus, QaRequestStatus } from '@/types/clinicalWorkspace';

interface WorkspaceActionsProps {
  anatomyAction?: ReactNode;
  reportStatus: ClinicalReportStatus;
  qaStatus: QaRequestStatus;
  notice: string | null;
  onSaveDraft: () => void;
  onRunQa: () => void;
  onMarkReady: () => void;
  runQaDisabled?: boolean;
  onOpenSmartView?: () => void;
  hasQaIssues?: boolean;
}

export function WorkspaceActions({
  anatomyAction,
  reportStatus,
  qaStatus,
  notice,
  onSaveDraft,
  onRunQa,
  onMarkReady,
  runQaDisabled = false,
  onOpenSmartView,
  hasQaIssues = false,
}: WorkspaceActionsProps) {
  const qaIsLoading = qaStatus === 'LOADING';

  return (
    <section className="flex flex-col gap-2 px-1 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <p className="text-xs text-slate-500">
          Current status: <span className="font-semibold text-slate-300">{reportStatus.replace(/_/g, ' ')}</span>
        </p>
        {notice && (
          <p className="mt-1 text-xs text-blue-300" role="status">
            {notice}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {anatomyAction}
        {onOpenSmartView && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenSmartView}
            className={`border-cyan-500/40 bg-cyan-950/40 text-cyan-200 hover:bg-cyan-900/60 hover:text-white shadow-sm transition-all ${
              hasQaIssues ? 'ring-1 ring-cyan-400/50 shadow-cyan-950/80' : ''
            }`}
            data-testid="smart-qa-view-button"
            title="Open side-by-side smart QA clinical reconciliation"
          >
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            Compare with Smart View
          </Button>
        )}
        <Button type="button" variant="outline" size="sm" onClick={onSaveDraft}>
          <Save className="h-3.5 w-3.5" />
          Save Draft
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onRunQa} disabled={runQaDisabled || qaIsLoading}>
          {qaIsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
          {qaIsLoading ? 'Running QA' : 'Run QA'}
        </Button>
        <Button type="button" size="sm" onClick={onMarkReady}>
          <CheckCircle2 className="h-3.5 w-3.5" />
          Mark Ready to Sign
        </Button>
      </div>
    </section>
  );
}
