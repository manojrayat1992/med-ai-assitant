import { useState, useEffect } from 'react';
import {
  TrendingUp,
  Clock,
  CheckCircle2,
  Sparkles,
  Calculator,
  ArrowRight,
  FileCheck,
  Zap,
  Loader2,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { growthCalculatorApi } from '@/services/growthCalculatorApi';
import type { GrowthDeltaResult, CalculateGrowthRequest } from '@/types/growthCalculator';

interface PriorStudyDeltaGrowthPanelProps {
  onInsertComparisonText?: (text: string) => void;
}

export function PriorStudyDeltaGrowthPanel({
  onInsertComparisonText,
}: PriorStudyDeltaGrowthPanelProps) {
  const [deltas, setDeltas] = useState<GrowthDeltaResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [insertedIndex, setInsertedIndex] = useState<number | null>(null);

  // Playground calculator state
  const [calcLesion, setCalcLesion] = useState('Right adrenal lesion');
  const [calcAnatomy, setCalcAnatomy] = useState('Adrenal Gland');
  const [calcPriorMm, setCalcPriorMm] = useState<number>(8.0);
  const [calcCurrentMm, setCalcCurrentMm] = useState<number>(14.0);
  const [calcPriorDate, setCalcPriorDate] = useState('2024-05-10');
  const calcCurrentDate = new Date().toISOString().split('T')[0];
  const [customResult, setCustomResult] = useState<GrowthDeltaResult | null>(null);
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    void loadDeltas();
  }, []);

  const loadDeltas = async () => {
    try {
      setLoading(true);
      const data = await growthCalculatorApi.getSampleDeltas();
      setDeltas(data);
    } catch (err) {
      console.error('Failed to load sample deltas', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInsert = (text: string, index: number) => {
    if (onInsertComparisonText) {
      onInsertComparisonText(text);
      setInsertedIndex(index);
      setTimeout(() => setInsertedIndex(null), 3000);
    }
  };

  const handleCalculateCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCalculating(true);
      const req: CalculateGrowthRequest = {
        lesionName: calcLesion,
        anatomy: calcAnatomy,
        priorMeasurementMm: calcPriorMm,
        currentMeasurementMm: calcCurrentMm,
        priorDate: calcPriorDate,
        currentDate: calcCurrentDate,
      };
      const result = await growthCalculatorApi.calculateGrowth(req);
      setCustomResult(result);
    } finally {
      setCalculating(false);
    }
  };

  const recistBadge = (category: GrowthDeltaResult['recistCategory']) => {
    switch (category) {
      case 'PROGRESSIVE_DISEASE':
        return 'bg-red-500/15 border-red-500/40 text-red-300';
      case 'PARTIAL_RESPONSE':
        return 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300';
      case 'COMPLETE_RESPONSE':
        return 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300';
      default:
        return 'bg-slate-500/15 border-slate-500/40 text-slate-300';
    }
  };

  return (
    <div className="space-y-6 p-5">
      {/* Top Banner */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-gradient-to-r from-indigo-950/40 via-slate-900/60 to-purple-950/20 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/20 text-indigo-400">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-white">
                Automated Prior Study Delta & Growth Calculator
              </h3>
              <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                <Zap className="h-3 w-3" />
                Saves 2–3 min/study
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Cross-compares target lesions across PACS/EHR study history, computing volume doubling time (VDT) and RECIST 1.1 intervals with 1-click report insertion.
            </p>
          </div>
        </div>
      </div>

      {/* Historical Comparison Delta Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Matched Historical Lesion Deltas ({deltas.length})
          </h4>
          <span className="text-[11px] text-slate-400">
            Cross-referenced with prior PACS examinations
          </span>
        </div>

        {loading ? (
          <div className="flex h-36 items-center justify-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/30">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
            <span className="text-xs text-slate-400">Loading historical PACS lesion deltas...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {deltas.map((delta, idx) => {
              const isGrowth = delta.linearDeltaMm > 0;
              const isInserted = insertedIndex === idx;

              return (
                <div
                  key={delta.lesionName}
                  className={cn(
                    'flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm transition-all hover:border-slate-700 hover:bg-slate-900/80',
                    delta.recistCategory === 'PROGRESSIVE_DISEASE' && 'border-red-500/30 bg-red-950/10'
                  )}
                >
                <div>
                  {/* Top Bar: Lesion Name & RECIST Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h5 className="text-sm font-semibold text-white">{delta.lesionName}</h5>
                      <span className="text-[11px] text-slate-400">{delta.anatomy || 'Target Lesion'}</span>
                    </div>
                    <span className={cn('rounded-lg border px-2 py-0.5 text-[11px] font-semibold', recistBadge(delta.recistCategory))}>
                      {delta.recistLabel}
                    </span>
                  </div>

                  {/* Measurement Timeline Comparison */}
                  <div className="mt-4 rounded-xl border border-slate-800/80 bg-slate-950/60 p-3.5">
                    <div className="grid grid-cols-3 items-center text-center">
                      <div>
                        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Prior ({delta.priorDate})</span>
                        <div className="mt-1 text-base font-bold text-slate-300">{delta.priorMeasurementMm} mm</div>
                        <span className="text-[10px] text-slate-400">{delta.priorVolumeMm3} mm³</span>
                      </div>

                      <div className="flex flex-col items-center justify-center">
                        <ArrowRight className="h-4 w-4 text-slate-400" />
                        <span className="mt-1 text-[10px] font-semibold text-slate-400">{delta.elapsedDays} days</span>
                      </div>

                      <div>
                        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Current (Today)</span>
                        <div className={cn('mt-1 text-base font-bold', isGrowth ? 'text-red-400' : 'text-emerald-400')}>
                          {delta.currentMeasurementMm} mm
                        </div>
                        <span className="text-[10px] text-slate-400">{delta.currentVolumeMm3} mm³</span>
                      </div>
                    </div>

                    {/* Progress Bar Representation */}
                    <div className="mt-3">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                        <div
                          className={cn('h-full transition-all', isGrowth ? 'bg-red-500' : 'bg-emerald-500')}
                          style={{
                            width: `${Math.min(100, Math.max(20, (delta.currentMeasurementMm / Math.max(delta.priorMeasurementMm, delta.currentMeasurementMm)) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Growth Metrics Pills */}
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-2 text-center">
                      <span className="text-[10px] text-slate-400">Linear Delta</span>
                      <div className={cn('font-semibold', isGrowth ? 'text-red-400' : 'text-emerald-400')}>
                        {delta.linearDeltaMm > 0 ? `+${delta.linearDeltaMm}` : delta.linearDeltaMm} mm ({delta.linearPercentChange > 0 ? `+${delta.linearPercentChange}%` : `${delta.linearPercentChange}%`})
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-2 text-center">
                      <span className="text-[10px] text-slate-400">Volume Change</span>
                      <div className={cn('font-semibold', isGrowth ? 'text-purple-400' : 'text-emerald-400')}>
                        {delta.volumePercentChange > 0 ? `+${delta.volumePercentChange}%` : `${delta.volumePercentChange}%`}
                      </div>
                    </div>
                  </div>

                  {delta.volumeDoublingTimeDays && (
                    <div className="mt-2 flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-950/30 px-2.5 py-1.5 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3 text-amber-400" />
                        Volume Doubling Time (VDT):
                      </span>
                      <span className="font-semibold text-amber-300">{delta.volumeDoublingTimeDays} days</span>
                    </div>
                  )}

                  {/* Generated Clinical Sentence */}
                  <div className="mt-3 rounded-xl border border-slate-800/60 bg-slate-950/40 p-2.5">
                    <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Generated Impression</div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-200">{delta.narrative}</p>
                  </div>
                </div>

                {/* 1-Click Action Button */}
                <div className="mt-4 border-t border-slate-800/60 pt-3">
                  <button
                    type="button"
                    onClick={() => handleInsert(delta.narrative, idx)}
                    className={cn(
                      'flex w-full items-center justify-center gap-2 rounded-xl py-2 text-xs font-semibold transition-all',
                      isInserted
                        ? 'border border-emerald-500/40 bg-emerald-500/20 text-emerald-300'
                        : 'border border-indigo-500/30 bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30'
                    )}
                  >
                    {isInserted ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        <span>Inserted into Draft Report!</span>
                      </>
                    ) : (
                      <>
                        <FileCheck className="h-3.5 w-3.5" />
                        <span>Insert Comparison into Report</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>

      {/* On-the-Fly Growth & Doubling Time Calculator Playground */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
          <Calculator className="h-4 w-4 text-indigo-400" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-white">
            Interactive Lesion Growth & Doubling Time Calculator
          </h4>
          <span className="text-[11px] text-slate-400 ml-auto">
            Schwartz tumor kinetic model & RECIST 1.1
          </span>
        </div>

        <form onSubmit={handleCalculateCustom} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div>
            <label className="text-[11px] font-medium text-slate-400">Lesion Target</label>
            <input
              type="text"
              value={calcLesion}
              onChange={(e) => setCalcLesion(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
              placeholder="e.g. Adrenal lesion"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-slate-400">Anatomy</label>
            <input
              type="text"
              value={calcAnatomy}
              onChange={(e) => setCalcAnatomy(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
              placeholder="e.g. Adrenal Gland"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-slate-400">Prior (mm)</label>
            <input
              type="number"
              step="0.1"
              value={calcPriorMm}
              onChange={(e) => setCalcPriorMm(parseFloat(e.target.value) || 0)}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-slate-400">Prior Date</label>
            <input
              type="date"
              value={calcPriorDate}
              onChange={(e) => setCalcPriorDate(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-slate-400">Current (mm)</label>
            <input
              type="number"
              step="0.1"
              value={calcCurrentMm}
              onChange={(e) => setCalcCurrentMm(parseFloat(e.target.value) || 0)}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={calculating}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-500/20 transition-all hover:from-indigo-500 hover:to-purple-500"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Calculate</span>
            </button>
          </div>
        </form>

        {/* Custom Calculation Result */}
        {customResult && (
          <div className="mt-5 rounded-2xl border border-indigo-500/30 bg-indigo-950/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-500/20 pb-2.5">
              <span className="text-xs font-semibold text-white">{customResult.lesionName}</span>
              <div className="flex items-center gap-2">
                <span className={cn('rounded-lg border px-2 py-0.5 text-[11px] font-semibold', recistBadge(customResult.recistCategory))}>
                  {customResult.recistLabel}
                </span>
                {customResult.volumeDoublingTimeDays && (
                  <span className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                    VDT: {customResult.volumeDoublingTimeDays} days
                  </span>
                )}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
              <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-2.5 text-center">
                <span className="text-[10px] text-slate-400">Linear Growth</span>
                <div className="mt-0.5 font-bold text-white">
                  {customResult.linearDeltaMm > 0 ? `+${customResult.linearDeltaMm}` : customResult.linearDeltaMm} mm (+{customResult.linearPercentChange}%)
                </div>
              </div>

              <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-2.5 text-center">
                <span className="text-[10px] text-slate-400">Volume Increase</span>
                <div className="mt-0.5 font-bold text-purple-300">
                  +{customResult.volumePercentChange}%
                </div>
              </div>

              <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-2.5 text-center">
                <span className="text-[10px] text-slate-400">Growth Velocity</span>
                <div className="mt-0.5 font-bold text-slate-200">
                  {customResult.growthVelocityMmPerMonth} mm/mo
                </div>
              </div>

              <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-2.5 text-center">
                <span className="text-[10px] text-slate-400">Interval</span>
                <div className="mt-0.5 font-bold text-slate-200">
                  {customResult.elapsedDays} days
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-slate-800/80 bg-slate-950/70 p-3">
              <p className="text-xs text-slate-200 leading-relaxed">{customResult.narrative}</p>
              <button
                type="button"
                onClick={() => handleInsert(customResult.narrative, 999)}
                className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-indigo-500/40 bg-indigo-600/30 px-3 py-1.5 text-xs font-semibold text-indigo-200 hover:bg-indigo-600/50"
              >
                <FileCheck className="h-3.5 w-3.5" />
                <span>Insert into Report</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
