import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart2,
  CheckCircle2,
  ClipboardCheck,
  TrendingUp,
  AlertTriangle,
  RotateCcw,
  Loader2,
  FileText,
  ShieldAlert,
  UserCheck,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  reportService,
  type WorklistSummary,
  type ReportReview,
  type CriticalEscalation,
} from '@/services/reportService';

export function QaAnalyticsPage() {
  const [summary, setSummary] = useState<WorklistSummary | null>(null);
  const [signedReports, setSignedReports] = useState<ReportReview[]>([]);
  const [criticals, setCriticals] = useState<CriticalEscalation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError('');
    try {
      const [sum, signed, crit] = await Promise.all([
        reportService.summary(),
        reportService.signedWorklist(0, 10),
        reportService.criticalResults(),
      ]);
      setSummary(sum);
      setSignedReports(signed.content);
      setCriticals(crit);
    } catch {
      setError('Could not load QA analytics data. Please verify your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-3" />
        <p className="text-sm font-medium">Loading QA Analytics &amp; Clinical Metrics…</p>
      </div>
    );
  }

  const totalReviewed = summary
    ? summary.acceptedAllTime + summary.editedAllTime + summary.rejectedAllTime
    : 0;

  const acceptanceRate =
    totalReviewed > 0 && summary
      ? Math.round((summary.acceptedAllTime / totalReviewed) * 100)
      : totalReviewed === 0
      ? 100
      : 0;

  const correctionRate =
    totalReviewed > 0 && summary
      ? Math.round((summary.editedAllTime / totalReviewed) * 100)
      : 0;

  const qaMetrics = [
    {
      label: 'Reports Reviewed',
      value: String(totalReviewed),
      icon: ClipboardCheck,
      color: '#3b82f6',
      badge: 'All-time',
      subtitle: `${summary?.signedToday ?? 0} signed today`,
    },
    {
      label: 'AI Acceptance Rate',
      value: `${acceptanceRate}%`,
      icon: CheckCircle2,
      color: '#10b981',
      badge: 'Clinician Verdict',
      subtitle: `${summary?.acceptedAllTime ?? 0} accepted unchanged`,
    },
    {
      label: 'Clinician Corrections',
      value: `${correctionRate}%`,
      icon: TrendingUp,
      color: '#8b5cf6',
      badge: 'Model Improvement',
      subtitle: `${summary?.editedAllTime ?? 0} edited before sign-off`,
    },
    {
      label: 'Awaiting Review',
      value: String((summary?.awaitingReview ?? 0) + (summary?.inReview ?? 0)),
      icon: UserCheck,
      color: '#f59e0b',
      badge: 'Active Queue',
      subtitle: `${summary?.inReview ?? 0} currently in review`,
    },
    {
      label: 'Critical Escalations',
      value: String(summary?.openEscalations ?? criticals.length),
      icon: ShieldAlert,
      color: '#ef4444',
      badge: 'High Priority',
      subtitle: `${criticals.length} awaiting clinician ack`,
    },
  ];

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl"
            style={{
              background: 'linear-gradient(135deg, #f59e0b, #3b82f6)',
              boxShadow: '0 0 20px rgba(245,158,11,0.25)',
            }}
          >
            <BarChart2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">QA Analytics &amp; Clinical Governance</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--clr-text-3)' }}>
              Operational quality metrics, model agreement, and sign-off audits across your organization.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={refreshing}
            onClick={() => void loadData(true)}
            className="gap-1.5"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button asChild size="sm" style={{ background: '#2563eb' }}>
            <Link to="/worklist" className="gap-1.5">
              <ClipboardCheck className="h-3.5 w-3.5" />
              Open Worklist
            </Link>
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-300 flex items-center justify-between">
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={() => void loadData()}>
            Retry
          </Button>
        </div>
      )}

      {/* Metrics Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {qaMetrics.map(({ label, value, icon: Icon, color, badge, subtitle }) => (
          <Card key={label}>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{ background: `${color}18` }}
                >
                  <Icon className="h-4 w-4" style={{ color }} />
                </div>
                <span className="badge badge-slate text-[10px]">{badge}</span>
              </div>
            </CardHeader>
            <CardContent>
              <p
                className="text-2xl font-extrabold text-white"
                style={{ fontFamily: 'Plus Jakarta Sans' }}
              >
                {value}
              </p>
              <p className="text-xs font-semibold mt-1" style={{ color: 'var(--clr-text-3)' }}>
                {label}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5 truncate">{subtitle}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Analytics Grid */}
      <div className="grid gap-5 lg:grid-cols-5">
        {/* Outcome Breakdown */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Sign-Off Decision Distribution</CardTitle>
                <CardDescription>
                  How clinicians interact with AI diagnostic drafts (training data &amp; accuracy signal)
                </CardDescription>
              </div>
              <span className="text-xs text-slate-500 font-mono">
                {totalReviewed} total evaluations
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {totalReviewed === 0 ? (
              <div
                className="flex flex-col h-48 items-center justify-center rounded-lg border border-dashed text-sm text-slate-500 p-6 text-center"
                style={{
                  borderColor: 'var(--clr-border-2, #243250)',
                  background: 'var(--surface-2, #1a2235)',
                }}
              >
                <FileText className="h-7 w-7 text-slate-600 mb-2" />
                <p>No reports have been signed off yet.</p>
                <p className="text-xs text-slate-500 mt-1">
                  Once clinicians accept or edit reports in the Worklist, QA signals and training metrics will populate here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Accepted */}
                <div>
                  <div className="flex justify-between text-xs mb-1.5 font-medium">
                    <span className="text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Accepted Unchanged ({summary?.acceptedAllTime ?? 0})
                    </span>
                    <span className="text-slate-300 font-mono">
                      {Math.round(((summary?.acceptedAllTime ?? 0) / totalReviewed) * 100)}%
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-500"
                      style={{
                        width: `${((summary?.acceptedAllTime ?? 0) / totalReviewed) * 100}%`,
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Positive reinforcement: draft was clinically accurate and complete without edits.
                  </p>
                </div>

                {/* Edited */}
                <div>
                  <div className="flex justify-between text-xs mb-1.5 font-medium">
                    <span className="text-violet-400 flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5" />
                      Edited / Corrected by Clinician ({summary?.editedAllTime ?? 0})
                    </span>
                    <span className="text-slate-300 font-mono">
                      {Math.round(((summary?.editedAllTime ?? 0) / totalReviewed) * 100)}%
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-violet-500 transition-all duration-500"
                      style={{
                        width: `${((summary?.editedAllTime ?? 0) / totalReviewed) * 100}%`,
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Supervised fine-tuning signal: pairs the model's draft with the radiologist's ground truth correction.
                  </p>
                </div>

                {/* Rejected */}
                <div>
                  <div className="flex justify-between text-xs mb-1.5 font-medium">
                    <span className="text-red-400 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Rejected ({summary?.rejectedAllTime ?? 0})
                    </span>
                    <span className="text-slate-300 font-mono">
                      {Math.round(((summary?.rejectedAllTime ?? 0) / totalReviewed) * 100)}%
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500 transition-all duration-500"
                      style={{
                        width: `${((summary?.rejectedAllTime ?? 0) / totalReviewed) * 100}%`,
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Negative signal: draft rejected due to image quality, wrong protocol, or severe hallucination.
                  </p>
                </div>
              </div>
            )}

            {/* Turnaround / Operational card */}
            <div
              className="p-4 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-4 mt-6"
              style={{
                borderColor: 'var(--clr-border, #1e2d45)',
                background: 'var(--surface-2, #1a2235)',
              }}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">Worklist Reading Queue</p>
                  <p className="text-[11px] text-slate-400">
                    {summary?.awaitingReview ?? 0} studies waiting · {summary?.inReview ?? 0} claimed by radiologists
                  </p>
                </div>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link to="/worklist">Review Worklist</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Signed Reports Audit Stream */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Signed Studies</CardTitle>
                <CardDescription>Live sign-off governance stream</CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm" className="h-7 text-xs text-blue-400 p-1">
                <Link to="/worklist">View all</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {signedReports.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-12 rounded-lg border border-dashed text-slate-500 text-xs text-center"
                style={{
                  borderColor: 'var(--clr-border, #1e2d45)',
                  background: 'var(--surface-2, #1a2235)',
                }}
              >
                <CheckCircle2 className="h-6 w-6 text-slate-600 mb-1" />
                <span>No signed reports recorded yet.</span>
              </div>
            ) : (
              signedReports.slice(0, 5).map((report) => (
                <div
                  key={report.id}
                  className="rounded-lg border p-3 flex flex-col gap-2"
                  style={{
                    borderColor: 'var(--clr-border, #1e2d45)',
                    background: 'var(--surface-2, #1a2235)',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white truncate max-w-[140px]">
                      {report.patientName ?? 'Patient'}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                        report.reviewAction === 'ACCEPTED'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-violet-500/10 text-violet-400 border-violet-500/20'
                      }`}
                    >
                      {report.reviewAction ?? 'SIGNED'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>{report.analysisType?.replace(/_/g, ' ').toLowerCase() ?? 'imaging'}</span>
                    <span className="font-mono">
                      {report.signedAt ? new Date(report.signedAt).toLocaleDateString() : ''}
                    </span>
                  </div>
                  <Link
                    to={`/clinical-workspace/${report.id}`}
                    className="text-[11px] text-blue-400 hover:underline flex items-center gap-1 mt-0.5"
                  >
                    Open in workspace <ExternalLink className="h-2.5 w-2.5" />
                  </Link>
                </div>
              ))
            )}

            {/* QA Rules Coverage */}
            <div className="pt-2 border-t" style={{ borderColor: 'var(--clr-border, #1e2d45)' }}>
              <p className="text-xs font-semibold text-slate-300 mb-2">Active QA Checkers</p>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Laterality conflict detection</span>
                  <span className="text-emerald-400 font-semibold text-[11px]">Active</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Critical finding escalation</span>
                  <span className="text-emerald-400 font-semibold text-[11px]">Active</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Prior study LOINC comparison</span>
                  <span className="text-emerald-400 font-semibold text-[11px]">Active</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
