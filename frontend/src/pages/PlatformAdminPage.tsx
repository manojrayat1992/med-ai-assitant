import { useEffect, useState, useMemo } from 'react';
import {
  Building2, Users, UserCheck, Activity, ShieldCheck,
  Search, RefreshCw, Clock, ArrowUpRight, CheckCircle2,
  AlertCircle, Globe, Terminal
} from 'lucide-react';
import {
  platformAdminApi,
  type PlatformSummary,
  type TenantOverview,
  type UserSignupItem,
  type UserLoginItem,
  type PlatformActivityItem
} from '@/services/platformAdminApi';
import { useAuthStore } from '@/stores/authStore';

type ActiveTab = 'overview' | 'tenants' | 'signups' | 'logins' | 'activity';

export function PlatformAdminPage() {
  const { tenantName } = useAuthStore();
  const [tab, setTab] = useState<ActiveTab>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [summary, setSummary] = useState<PlatformSummary | null>(null);
  const [tenants, setTenants] = useState<TenantOverview[]>([]);
  const [signups, setSignups] = useState<UserSignupItem[]>([]);
  const [logins, setLogins] = useState<UserLoginItem[]>([]);
  const [activity, setActivity] = useState<PlatformActivityItem[]>([]);

  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [sumRes, tenRes, sigRes, logRes, actRes] = await Promise.allSettled([
        platformAdminApi.getSummary(),
        platformAdminApi.getTenants(),
        platformAdminApi.getSignups(),
        platformAdminApi.getLogins(),
        platformAdminApi.getActivity(),
      ]);

      if (sumRes.status === 'fulfilled') setSummary(sumRes.value);
      if (tenRes.status === 'fulfilled') setTenants(tenRes.value);
      if (sigRes.status === 'fulfilled') setSignups(sigRes.value);
      if (logRes.status === 'fulfilled') setLogins(logRes.value);
      if (actRes.status === 'fulfilled') setActivity(actRes.value);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Failed to load platform data. Please retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const filteredTenants = useMemo(() => {
    if (!searchQuery.trim()) return tenants;
    const q = searchQuery.toLowerCase();
    return tenants.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.subdomain.toLowerCase().includes(q) ||
      t.contactEmail.toLowerCase().includes(q)
    );
  }, [tenants, searchQuery]);

  const filteredSignups = useMemo(() => {
    if (!searchQuery.trim()) return signups;
    const q = searchQuery.toLowerCase();
    return signups.filter(u =>
      u.email.toLowerCase().includes(q) ||
      u.firstName.toLowerCase().includes(q) ||
      u.lastName.toLowerCase().includes(q) ||
      u.tenantName.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  }, [signups, searchQuery]);

  const filteredLogins = useMemo(() => {
    if (!searchQuery.trim()) return logins;
    const q = searchQuery.toLowerCase();
    return logins.filter(u =>
      u.email.toLowerCase().includes(q) ||
      u.firstName.toLowerCase().includes(q) ||
      u.lastName.toLowerCase().includes(q) ||
      u.tenantName.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  }, [logins, searchQuery]);

  const filteredActivity = useMemo(() => {
    if (!searchQuery.trim()) return activity;
    const q = searchQuery.toLowerCase();
    return activity.filter(a =>
      a.action.toLowerCase().includes(q) ||
      a.entityType.toLowerCase().includes(q) ||
      a.tenantName.toLowerCase().includes(q) ||
      a.userName.toLowerCase().includes(q) ||
      a.userEmail.toLowerCase().includes(q)
    );
  }, [activity, searchQuery]);

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Never';
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const timeAgo = (isoString?: string) => {
    if (!isoString) return 'Never';
    const seconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (seconds < 60) return `${Math.max(1, seconds)}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white font-plus-jakarta">
                Platform Operations &amp; Tenancy Hub
              </h1>
              <p className="text-xs text-slate-400">
                Global real-time overview across all hospital tenants, user registrations, logins, and system activity
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Active Tenant Context Tag */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-400">Current Session:</span>
            <span className="font-semibold text-white">{tenantName || 'Main Workspace'}</span>
          </div>

          <button
            onClick={() => void loadData(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── KPI Stat Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider">Hospitals</span>
            <Building2 className="h-4 w-4 text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-white font-mono">{summary ? summary.totalTenants : (loading ? '—' : tenants.length)}</p>
          <p className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            {summary ? summary.activeTenants : tenants.filter(t => t.isActive).length} active workspaces
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider">Total Users</span>
            <Users className="h-4 w-4 text-cyan-400" />
          </div>
          <p className="text-2xl font-bold text-white font-mono">{summary ? summary.totalUsers : (loading ? '—' : signups.length)}</p>
          <p className="text-[10px] text-slate-400 mt-1">Cross-hospital accounts</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider">Active Today</span>
            <UserCheck className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-300 font-mono">{summary ? summary.activeUsersToday : (loading ? '—' : logins.length)}</p>
          <p className="text-[10px] text-slate-400 mt-1">Logged in last 24h</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider">Patients</span>
            <Activity className="h-4 w-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-bold text-white font-mono">{summary ? summary.totalPatients : (loading ? '—' : 0)}</p>
          <p className="text-[10px] text-slate-400 mt-1">Under active care</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider">AI Studies</span>
            <ArrowUpRight className="h-4 w-4 text-violet-400" />
          </div>
          <p className="text-2xl font-bold text-white font-mono">{summary ? summary.totalAnalyses : (loading ? '—' : 0)}</p>
          <p className="text-[10px] text-slate-400 mt-1">Total analyses run</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider">Platform</span>
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="text-sm font-bold text-emerald-400 mt-2 font-mono flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping inline-block" />
            OPERATIONAL
          </p>
          <p className="text-[10px] text-slate-400 mt-1">RLS Isolation active</p>
        </div>
      </div>

      {/* ── Navigation Tabs & Search Bar ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => { setTab('overview'); setSearchQuery(''); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tab === 'overview'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => { setTab('tenants'); setSearchQuery(''); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              tab === 'tenants'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Building2 className="h-3.5 w-3.5" />
            Hospitals ({tenants.length})
          </button>
          <button
            onClick={() => { setTab('signups'); setSearchQuery(''); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              tab === 'signups'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            Signups ({signups.length})
          </button>
          <button
            onClick={() => { setTab('logins'); setSearchQuery(''); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              tab === 'logins'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            Recent Logins ({logins.length})
          </button>
          <button
            onClick={() => { setTab('activity'); setSearchQuery(''); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              tab === 'activity'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Terminal className="h-3.5 w-3.5" />
            Audit Trail ({activity.length})
          </button>
        </div>

        {tab !== 'overview' && (
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              placeholder={`Search ${tab}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        )}
      </div>

      {/* ── Tab 1: Overview ── */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Signups Card */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-400" />
                <h3 className="text-sm font-bold text-white">Latest User Registrations</h3>
              </div>
              <button
                onClick={() => setTab('signups')}
                className="text-xs text-blue-400 hover:underline font-medium"
              >
                View all ({signups.length}) →
              </button>
            </div>

            <div className="divide-y divide-slate-800/80">
              {signups.slice(0, 5).map((user) => (
                <div key={user.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/20">
                      {user.role.replace(/_/g, ' ')}
                    </span>
                    <p className="text-[10px] text-slate-500 mt-1">{user.tenantName} · {timeAgo(user.createdAt)}</p>
                  </div>
                </div>
              ))}
              {signups.length === 0 && (
                <p className="text-xs text-slate-500 py-4 text-center">No signups recorded yet</p>
              )}
            </div>
          </div>

          {/* Recent Logins Card */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Active Login Sessions</h3>
              </div>
              <button
                onClick={() => setTab('logins')}
                className="text-xs text-blue-400 hover:underline font-medium"
              >
                View all ({logins.length}) →
              </button>
            </div>

            <div className="divide-y divide-slate-800/80">
              {logins.slice(0, 5).map((u) => (
                <div key={u.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate">
                      {u.firstName} {u.lastName}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">{u.email}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      {timeAgo(u.lastLoginAt)}
                    </span>
                    <p className="text-[10px] text-slate-500 mt-1">{u.tenantName}</p>
                  </div>
                </div>
              ))}
              {logins.length === 0 && (
                <p className="text-xs text-slate-500 py-4 text-center">No login activity recorded yet</p>
              )}
            </div>
          </div>

          {/* Hospitals Breakdown */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">Registered Hospital Workspaces</h3>
              </div>
              <button
                onClick={() => setTab('tenants')}
                className="text-xs text-blue-400 hover:underline font-medium"
              >
                Manage all ({tenants.length}) →
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {tenants.slice(0, 6).map((t) => (
                <div key={t.id} className="p-3.5 rounded-lg border border-slate-800/80 bg-slate-950/60 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-bold text-white truncate">{t.name}</h4>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-300 border border-blue-500/20">
                        {t.subdomain}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 truncate">{t.contactEmail}</p>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
                    <span>{t.userCount} users · {t.patientCount} patients</span>
                    <span className="text-[10px] text-slate-500">{timeAgo(t.createdAt)}</span>
                  </div>
                </div>
              ))}
              {tenants.length === 0 && (
                <p className="text-xs text-slate-500 py-4 text-center col-span-3">No tenants found</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 2: Hospitals (Tenants) ── */}
      {tab === 'tenants' && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-slate-400 border-b border-slate-800 uppercase text-[10px] tracking-wider font-semibold">
                <tr>
                  <th className="px-4 py-3">Hospital / Workspace</th>
                  <th className="px-4 py-3">Subdomain Slug</th>
                  <th className="px-4 py-3">Contact Email</th>
                  <th className="px-4 py-3 text-center">Users</th>
                  <th className="px-4 py-3 text-center">Patients</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredTenants.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 font-semibold text-white">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 text-blue-400" />
                        <span>{t.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-cyan-300">
                      {t.subdomain}.medaiclinical.com
                    </td>
                    <td className="px-4 py-3 text-slate-300">{t.contactEmail}</td>
                    <td className="px-4 py-3 text-center font-mono font-semibold text-slate-200">{t.userCount}</td>
                    <td className="px-4 py-3 text-center font-mono font-semibold text-slate-200">{t.patientCount}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        t.isActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${t.isActive ? 'bg-emerald-400' : 'bg-red-400'}`} />
                        {t.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-400 font-mono text-[11px]">{formatDate(t.createdAt)}</td>
                  </tr>
                ))}
                {filteredTenants.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                      No hospitals match your search criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab 3: User Signups ── */}
      {tab === 'signups' && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-slate-400 border-b border-slate-800 uppercase text-[10px] tracking-wider font-semibold">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Hospital Workspace</th>
                  <th className="px-4 py-3">Account Status</th>
                  <th className="px-4 py-3 text-right">Signed Up</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredSignups.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 font-semibold text-white">
                      {u.firstName} {u.lastName}
                    </td>
                    <td className="px-4 py-3 text-slate-300 font-mono">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/20">
                        {u.role.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-3 w-3 text-slate-400" />
                        <span>{u.tenantName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        u.isActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {u.isActive ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-400 font-mono text-[11px]">{formatDate(u.createdAt)}</td>
                  </tr>
                ))}
                {filteredSignups.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      No user sign-ups found matching your query.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab 4: User Logins ── */}
      {tab === 'logins' && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-slate-400 border-b border-slate-800 uppercase text-[10px] tracking-wider font-semibold">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Hospital Workspace</th>
                  <th className="px-4 py-3">Last Active</th>
                  <th className="px-4 py-3 text-right">Login Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredLogins.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 font-semibold text-white">
                      {u.firstName} {u.lastName}
                    </td>
                    <td className="px-4 py-3 text-slate-300 font-mono">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                        {u.role.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-3 w-3 text-slate-400" />
                        <span>{u.tenantName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-emerald-400">
                      {timeAgo(u.lastLoginAt)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-400 font-mono text-[11px]">{formatDate(u.lastLoginAt)}</td>
                  </tr>
                ))}
                {filteredLogins.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      No recent user logins recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab 5: Global Audit Trail ── */}
      {tab === 'activity' && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-slate-400 border-b border-slate-800 uppercase text-[10px] tracking-wider font-semibold">
                <tr>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Entity Type</th>
                  <th className="px-4 py-3">Hospital Workspace</th>
                  <th className="px-4 py-3">Actor / User</th>
                  <th className="px-4 py-3">IP Address</th>
                  <th className="px-4 py-3 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredActivity.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 font-semibold text-white">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-cyan-300 border border-slate-700">
                        {a.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300 font-mono text-[11px]">{a.entityType}</td>
                    <td className="px-4 py-3 text-slate-300 font-medium">{a.tenantName}</td>
                    <td className="px-4 py-3 text-slate-200">
                      <div>
                        <p className="font-semibold">{a.userName}</p>
                        <p className="text-[10px] text-slate-500">{a.userEmail}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-400 text-[11px]">{a.ipAddress || 'internal'}</td>
                    <td className="px-4 py-3 text-right text-slate-400 font-mono text-[11px]">{formatDate(a.createdAt)}</td>
                  </tr>
                ))}
                {filteredActivity.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      No security audit events found matching your query.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
