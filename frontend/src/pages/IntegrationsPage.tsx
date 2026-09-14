import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '@/services/api';
import type { ApiResponse } from '@/types';
import type { ReportReview } from '@/services/reportService';
import { Activity, Database, FileText, KeyRound, PlugZap } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';

const integrations = [
  {
    title: 'PACS',
    sub: 'Imaging archive and study retrieval',
    icon: Database,
    color: '#3b82f6',
  },
  {
    title: 'RIS',
    sub: 'Orders, accessioning, and scheduling context',
    icon: Activity,
    color: '#10b981',
  },
  {
    title: 'Reporting System',
    sub: 'Draft report intake and final sign-off handoff',
    icon: FileText,
    color: '#f59e0b',
  },
  {
    title: 'Identity & Access',
    sub: 'SSO, roles, and enterprise authentication',
    icon: KeyRound,
    color: '#8b5cf6',
  },
];

export function IntegrationsPage() {
  const [source, setSource] = useState('');
  const [externalId, setExternalId] = useState('');
  const [review, setReview] = useState<ReportReview | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function lookup(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setReview(null);
    setError('');
    try {
      const response = await api.get<ApiResponse<ReportReview>>('/integrations/reports', {
        params: { sourceSystem: source, externalReportId: externalId },
      });
      setReview(response.data.data);
    } catch {
      setError('Could not retrieve this import. Check the source name, report ID, and your access.');
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="space-y-6 max-w-[1200px]">
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{
            background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
            boxShadow: '0 0 20px rgba(6,182,212,0.25)',
          }}
        >
          <PlugZap className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Integrations</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--clr-text-3)' }}>
            PACS, RIS, reporting, and identity connections for imaging operations.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Report import API</CardTitle>
          <CardDescription>
            Receive draft reports from a reporting-system adapter, with duplicate protection.
            Imported reports enter the worklist for clinician review and QA.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm mb-4" style={{ color: 'var(--clr-text-3)' }}>
            A vendor adapter must be configured before reports can arrive. Look up a submitted
            report below using the exact identifiers supplied by your adapter.
          </p>
          <form onSubmit={lookup} className="flex flex-wrap items-end gap-3">
            <label className="text-sm flex flex-col gap-1">
              Source system
              <input required maxLength={64} value={source} disabled={loading}
                onChange={event => { setSource(event.target.value); setReview(null); }}
                placeholder="pilot-ris" className="rounded border border-slate-600 bg-transparent px-3 py-2" />
            </label>
            <label className="text-sm flex flex-col gap-1">
              External report ID
              <input required maxLength={128} value={externalId} disabled={loading}
                onChange={event => { setExternalId(event.target.value); setReview(null); }}
                placeholder="accession-123-report-v1" className="rounded border border-slate-600 bg-transparent px-3 py-2" />
            </label>
            <button type="submit" disabled={loading} className="rounded bg-cyan-700 px-4 py-2 text-white disabled:opacity-50">
              {loading ? 'Looking up…' : 'Look up report'}
            </button>
          </form>
          {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
          {review && <div role="status" className="mt-4 text-sm">
            <span>Report status: {review.status}</span>
            <Link className="ml-4 text-cyan-400 underline" to={`/clinical-workspace/${review.id}`}>
              Open review
            </Link>
          </div>}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {integrations.map(({ title, sub, icon: Icon, color }) => (
          <Card key={title}>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: `${color}18` }}>
                    <Icon className="h-4 w-4" style={{ color }} />
                  </div>
                  <CardTitle>{title}</CardTitle>
                </div>
                <span className="badge badge-slate text-[10px]">Planned</span>
              </div>
              <CardDescription>{sub}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950/30 px-3 py-2 text-xs text-slate-500">
                Not connected
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
