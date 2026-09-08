import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Scan,
  RotateCcw,
  Loader2,
  FileText,
  Activity,
  Layers,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  Crosshair,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { AnatomyViewer } from '@/components/anatomy-viewer/AnatomyViewer';
import { describeMeshName, type ExploredStructure } from '@/components/anatomy-viewer/utils/anatomyMeshDescription';
import { anatomyService, type AnatomyDefinitionDto } from '@/services/anatomyService';
import { reportService, type ReportReview, parseDraft } from '@/services/reportService';
import type { AnatomySelection } from '@/types/clinicalWorkspace';

interface AnatomyTargetPreset {
  label: string;
  system: string;
  viewerKey: string;
  side: 'RIGHT' | 'LEFT' | 'MIDLINE';
  structureCode: string;
}

const PRESET_STRUCTURES: AnatomyTargetPreset[] = [
  { label: 'Right Lung', system: 'RESPIRATORY', viewerKey: 'respiratory.lung.right', side: 'RIGHT', structureCode: 'LUNG' },
  { label: 'Left Lung', system: 'RESPIRATORY', viewerKey: 'respiratory.lung.left', side: 'LEFT', structureCode: 'LUNG' },
  { label: 'Right Humerus', system: 'SKELETAL', viewerKey: 'skeleton.humerus.right', side: 'RIGHT', structureCode: 'HUMERUS' },
  { label: 'Left Humerus', system: 'SKELETAL', viewerKey: 'skeleton.humerus.left', side: 'LEFT', structureCode: 'HUMERUS' },
  { label: 'Right Femur', system: 'SKELETAL', viewerKey: 'skeleton.femur.right', side: 'RIGHT', structureCode: 'FEMUR' },
  { label: 'Left Femur', system: 'SKELETAL', viewerKey: 'skeleton.femur.left', side: 'LEFT', structureCode: 'FEMUR' },
  { label: 'Right Knee', system: 'SKELETAL', viewerKey: 'skeleton.knee.right', side: 'RIGHT', structureCode: 'KNEE' },
  { label: 'Left Knee', system: 'SKELETAL', viewerKey: 'skeleton.knee.left', side: 'LEFT', structureCode: 'KNEE' },
  { label: 'Right Shoulder', system: 'SKELETAL', viewerKey: 'skeleton.shoulder.right', side: 'RIGHT', structureCode: 'SHOULDER' },
  { label: 'Brain', system: 'NERVOUS', viewerKey: 'nervous.brain', side: 'MIDLINE', structureCode: 'BRAIN' },
  { label: 'Right Kidney', system: 'URINARY', viewerKey: 'urinary.kidney.right', side: 'RIGHT', structureCode: 'KIDNEY' },
  { label: 'Left Kidney', system: 'URINARY', viewerKey: 'urinary.kidney.left', side: 'LEFT', structureCode: 'KIDNEY' },
];

export function AnatomyPage() {
  const [catalog, setCatalog] = useState<AnatomyDefinitionDto[]>([]);
  const [recentReports, setRecentReports] = useState<ReportReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // 3D Selection State
  const [selection, setSelection] = useState<AnatomySelection>({
    system: 'RESPIRATORY',
    structureCode: 'LUNG',
    displayName: 'Right Lung',
    side: 'RIGHT',
    region: 'chest',
    viewerKey: 'respiratory.lung.right',
  });

  const [exploredStructure, setExploredStructure] = useState<ExploredStructure | null>(null);
  const [activeTab, setActiveTab] = useState<'catalog' | 'findings'>('catalog');

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError('');
    try {
      const [cat, worklistRes, signedRes] = await Promise.all([
        anatomyService.getCatalog(),
        reportService.worklist(0, 10).catch(() => ({ content: [] })),
        reportService.signedWorklist(0, 10).catch(() => ({ content: [] })),
      ]);
      setCatalog(cat);
      setRecentReports([...worklistRes.content, ...signedRes.content]);
    } catch {
      setError('Could not load anatomical definitions from server.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleMeshClick = useCallback((meshName: string | null) => {
    if (!meshName) {
      setExploredStructure(null);
      return;
    }
    const described = describeMeshName(meshName);
    setExploredStructure(described);
  }, []);

  const selectPreset = (preset: AnatomyTargetPreset) => {
    setSelection({
      system: preset.system,
      structureCode: preset.structureCode,
      displayName: preset.label,
      side: preset.side,
      region: undefined,
      viewerKey: preset.viewerKey,
    });
    setExploredStructure(null);
  };

  const selectDefinition = (def: AnatomyDefinitionDto, side: 'RIGHT' | 'LEFT' | 'BILATERAL' = 'RIGHT') => {
    let key = def.viewerKeyPattern;
    if (def.paired) {
      const sideKey = side === 'LEFT' ? 'left' : 'right';
      key = key.replace('{side}', sideKey);
    }
    const label = `${def.paired ? (side === 'LEFT' ? 'Left ' : 'Right ') : ''}${def.displayLabel.charAt(0).toUpperCase() + def.displayLabel.slice(1)}`;

    setSelection({
      system: def.system,
      structureCode: def.structureCode,
      displayName: label,
      side: def.paired ? side : 'MIDLINE',
      viewerKey: key,
    });
    setExploredStructure(null);
  };

  // Group catalog by system
  const groupedCatalog = useMemo(() => {
    const groups: Record<string, AnatomyDefinitionDto[]> = {};
    for (const item of catalog) {
      if (!groups[item.system]) {
        groups[item.system] = [];
      }
      groups[item.system].push(item);
    }
    return groups;
  }, [catalog]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-3" />
        <p className="text-sm font-medium">Loading 3D Anatomy Engine &amp; Catalog…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1500px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl"
            style={{
              background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)',
              boxShadow: '0 0 20px rgba(139,92,246,0.3)',
            }}
          >
            <Scan className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white">3D Anatomy &amp; Spatial Alignment</h1>
              <span className="badge badge-emerald text-[10px] flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" />
                API Connected
              </span>
            </div>
            <p className="text-sm mt-0.5" style={{ color: 'var(--clr-text-3)' }}>
              Deterministic 3D spatial mapping and finding correlation for clinical report review.
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
            <Link to="/clinical-workspace" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Clinical Workspace
            </Link>
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Main Content Layout */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left / Center 3D Viewer (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="overflow-hidden border" style={{ borderColor: 'var(--clr-border, #1e2d45)' }}>
            <CardHeader className="py-3 px-4 border-b flex flex-row items-center justify-between" style={{ borderColor: 'var(--clr-border, #1e2d45)' }}>
              <div>
                <CardTitle className="text-base flex items-center gap-2 text-white">
                  <Crosshair className="h-4 w-4 text-blue-400" />
                  {selection.displayName}
                </CardTitle>
                <CardDescription className="text-xs">
                  {selection.system} · {selection.viewerKey || 'Whole Body View'}
                </CardDescription>
              </div>

              {exploredStructure && (
                <div className="px-2.5 py-1 rounded-md bg-violet-950/60 border border-violet-500/30 text-[11px] text-violet-300 font-medium">
                  Clicked: {exploredStructure.label} ({exploredStructure.side})
                </div>
              )}
            </CardHeader>

            <CardContent className="p-0 relative">
              {/* 3D Viewer Container */}
              <div
                className="h-[520px] w-full rounded-b-xl overflow-hidden relative"
                style={{ background: '#0a0f1d' }}
              >
                <AnatomyViewer
                  selection={selection}
                  onExploredMeshChange={handleMeshClick}
                  size="workspace"
                />
              </div>

              {/* Quick Preset Selector Bar */}
              <div
                className="p-3 border-t flex flex-wrap items-center gap-1.5 overflow-x-auto"
                style={{ borderColor: 'var(--clr-border, #1e2d45)', background: 'var(--surface-2, #1a2235)' }}
              >
                <span className="text-[11px] font-semibold text-slate-400 mr-1 flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-amber-400" />
                  Presets:
                </span>
                {PRESET_STRUCTURES.map((preset) => {
                  const isActive = selection.viewerKey === preset.viewerKey;
                  return (
                    <button
                      key={preset.viewerKey}
                      onClick={() => selectPreset(preset)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-slate-800/70 text-slate-300 hover:bg-slate-700/80 hover:text-white'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar: Catalog & Mapped Findings (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="border" style={{ borderColor: 'var(--clr-border, #1e2d45)' }}>
            <CardHeader className="py-2.5 px-4 border-b" style={{ borderColor: 'var(--clr-border, #1e2d45)' }}>
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab('catalog')}
                  className={`flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
                    activeTab === 'catalog'
                      ? 'border-blue-500 text-white'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Layers className="h-3.5 w-3.5" />
                  Anatomy Catalog ({catalog.length})
                </button>
                <button
                  onClick={() => setActiveTab('findings')}
                  className={`flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
                    activeTab === 'findings'
                      ? 'border-emerald-500 text-white'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Activity className="h-3.5 w-3.5 text-emerald-400" />
                  Live Finding Links ({recentReports.length})
                </button>
              </div>
            </CardHeader>

            <CardContent className="p-4 max-h-[520px] overflow-y-auto space-y-4">
              {activeTab === 'catalog' && (
                <div className="space-y-4">
                  {Object.entries(groupedCatalog).map(([system, items]) => (
                    <div key={system} className="space-y-2">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        {system} System
                      </h3>
                      <div className="space-y-1.5">
                        {items.map((def) => {
                          const isCurrentlySelected = selection.structureCode === def.structureCode;
                          return (
                            <div
                              key={def.structureCode}
                              className={`p-2.5 rounded-lg border transition-all ${
                                isCurrentlySelected
                                  ? 'border-blue-500/50 bg-blue-950/30'
                                  : 'border-slate-800 hover:border-slate-700 bg-slate-900/40'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-xs font-semibold text-white">
                                    {def.displayLabel.charAt(0).toUpperCase() + def.displayLabel.slice(1)}
                                  </p>
                                  <p className="text-[10px] text-slate-500 font-mono">
                                    {def.viewerKeyPattern}
                                  </p>
                                </div>

                                {def.paired ? (
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() => selectDefinition(def, 'RIGHT')}
                                      className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-blue-400 hover:bg-blue-600 hover:text-white transition-colors"
                                    >
                                      Right
                                    </button>
                                    <button
                                      onClick={() => selectDefinition(def, 'LEFT')}
                                      className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-blue-400 hover:bg-blue-600 hover:text-white transition-colors"
                                    >
                                      Left
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => selectDefinition(def, 'RIGHT')}
                                    className="px-2.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-violet-300 hover:bg-violet-600 hover:text-white transition-colors"
                                  >
                                    View
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'findings' && (
                <div className="space-y-3">
                  {recentReports.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 text-xs">
                      No clinical reports found. Upload a study to see real findings mapped to 3D structures.
                    </div>
                  ) : (
                    recentReports.map((report) => {
                      const parsed = parseDraft(report.draftContent);
                      const findings = parsed?.findings ?? [];
                      return (
                        <div
                          key={report.id}
                          className="p-3 rounded-lg border border-slate-800 bg-slate-900/50 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-white">
                              {report.patientName ?? 'Patient'}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {report.status}
                            </span>
                          </div>

                          {findings.length > 0 ? (
                            <div className="space-y-1.5">
                              {findings.slice(0, 2).map((f, i) => (
                                <div
                                  key={i}
                                  className="flex items-start justify-between gap-2 text-[11px] p-1.5 rounded bg-slate-950/60 border border-slate-800/80"
                                >
                                  <span className="text-slate-300 line-clamp-1">{f.description}</span>
                                  {f.region && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] bg-blue-500/10 text-blue-400 border border-blue-500/20 whitespace-nowrap">
                                      {f.region}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[11px] text-slate-500 truncate">
                              {report.finalContent || 'No extracted structured findings'}
                            </p>
                          )}

                          <div className="flex items-center justify-between pt-1">
                            <Link
                              to={`/clinical-workspace/${report.id}`}
                              className="text-[11px] text-blue-400 hover:underline flex items-center gap-1"
                            >
                              Open in Workspace <ExternalLink className="h-2.5 w-2.5" />
                            </Link>
                            <button
                              onClick={() => {
                                // Smart switch to lung or humerus based on report modality
                                if (report.analysisType?.includes('IMAGE')) {
                                  selectPreset(PRESET_STRUCTURES[0]);
                                }
                              }}
                              className="text-[11px] text-violet-400 hover:text-violet-300 flex items-center gap-0.5"
                            >
                              Highlight on 3D <ChevronRight className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
