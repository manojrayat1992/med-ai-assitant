import api from './api';
import type { ApiResponse } from '@/types';
import type {
  GrowthDeltaResult,
  CalculateGrowthRequest,
} from '@/types/growthCalculator';

export const growthCalculatorApi = {
  async calculateGrowth(request: CalculateGrowthRequest): Promise<GrowthDeltaResult> {
    try {
      const res = await api.post<ApiResponse<GrowthDeltaResult>>(
        '/longitudinal/growth-calculator',
        request
      );
      return res.data.data;
    } catch {
      // Client-side fallback calculation engine
      return computeClientSideGrowth(request);
    }
  },

  async getSampleDeltas(): Promise<GrowthDeltaResult[]> {
    try {
      const res = await api.get<ApiResponse<GrowthDeltaResult[]>>('/longitudinal/sample-deltas');
      return res.data.data;
    } catch {
      return getFallbackSampleDeltas();
    }
  },
};

export function computeClientSideGrowth(req: CalculateGrowthRequest): GrowthDeltaResult {
  const priorMm = req.priorMeasurementMm;
  const currentMm = req.currentMeasurementMm;
  const priorDate = req.priorDate || '2024-05-10';
  const currentDate = req.currentDate || new Date().toISOString().split('T')[0];
  const lesionName = req.lesionName || (req.anatomy ? `${req.anatomy} lesion` : 'Target lesion');

  const d1 = new Date(priorDate).getTime();
  const d2 = new Date(currentDate).getTime();
  const elapsedDays = Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));

  const linearDelta = currentMm - priorMm;
  const linearPercent = (linearDelta / priorMm) * 100.0;

  const priorVolume = (Math.PI / 6.0) * Math.pow(priorMm, 3);
  const currentVolume = (Math.PI / 6.0) * Math.pow(currentMm, 3);
  const volumePercent = ((currentVolume - priorVolume) / priorVolume) * 100.0;

  let doublingTimeDays: number | null = null;
  if (currentMm > priorMm) {
    const vRatio = currentVolume / priorVolume;
    if (vRatio > 1.0) {
      doublingTimeDays = Math.round((elapsedDays * Math.log(2.0)) / Math.log(vRatio));
    }
  }

  const velocity = Math.round(((linearDelta / elapsedDays) * 30.4375) * 100) / 100;

  let recistCategory: GrowthDeltaResult['recistCategory'] = 'STABLE_DISEASE';
  let recistLabel = 'Stable Disease (SD)';
  if (currentMm <= 0) {
    recistCategory = 'COMPLETE_RESPONSE';
    recistLabel = 'Complete Response (CR)';
  } else if (linearPercent <= -30.0) {
    recistCategory = 'PARTIAL_RESPONSE';
    recistLabel = 'Partial Response (PR)';
  } else if (linearPercent >= 20.0 && linearDelta >= 5.0) {
    recistCategory = 'PROGRESSIVE_DISEASE';
    recistLabel = 'Progressive Disease (PD)';
  }

  let significance: GrowthDeltaResult['clinicalSignificance'] = 'STABLE';
  if (doublingTimeDays && doublingTimeDays > 0 && doublingTimeDays < 400) {
    significance = 'RAPID_GROWTH';
  } else if (linearDelta > 0) {
    significance = 'INDOLENT_GROWTH';
  } else if (linearDelta < 0) {
    significance = 'REGRESSION';
  }

  const capitalized = lesionName.charAt(0).toUpperCase() + lesionName.slice(1);
  const vdtClause = doublingTimeDays ? ` Tumor volume doubling time is ${doublingTimeDays} days.` : '';
  const narrative = currentMm > priorMm
    ? `${capitalized} has grown from ${priorMm.toFixed(1)} mm (${priorDate}) to ${currentMm.toFixed(1)} mm today (+${Math.round(linearPercent)}% diameter, +${Math.round(volumePercent)}% volume).${vdtClause} RECIST 1.1 category: ${recistLabel}.`
    : currentMm < priorMm
    ? `${capitalized} has decreased from ${priorMm.toFixed(1)} mm (${priorDate}) to ${currentMm.toFixed(1)} mm today (${Math.round(linearPercent)}% regression). RECIST 1.1 category: ${recistLabel}.`
    : `${capitalized} is stable at ${currentMm.toFixed(1)} mm, unchanged compared to prior examination dated ${priorDate}. RECIST 1.1 category: ${recistLabel}.`;

  return {
    lesionName,
    anatomy: req.anatomy,
    priorDate,
    currentDate,
    elapsedDays,
    priorMeasurementMm: Math.round(priorMm * 10) / 10,
    currentMeasurementMm: Math.round(currentMm * 10) / 10,
    linearDeltaMm: Math.round(linearDelta * 10) / 10,
    linearPercentChange: Math.round(linearPercent * 10) / 10,
    priorVolumeMm3: Math.round(priorVolume * 10) / 10,
    currentVolumeMm3: Math.round(currentVolume * 10) / 10,
    volumePercentChange: Math.round(volumePercent * 10) / 10,
    volumeDoublingTimeDays: doublingTimeDays,
    growthVelocityMmPerMonth: velocity,
    recistCategory,
    recistLabel,
    clinicalSignificance: significance,
    narrative,
  };
}

export function getFallbackSampleDeltas(): GrowthDeltaResult[] {
  return [
    computeClientSideGrowth({
      lesionName: 'Right adrenal lesion',
      anatomy: 'Adrenal Gland',
      priorMeasurementMm: 8.0,
      currentMeasurementMm: 14.0,
      priorDate: '2024-05-10',
      currentDate: new Date().toISOString().split('T')[0],
    }),
    computeClientSideGrowth({
      lesionName: 'Right lower lobe pulmonary nodule',
      anatomy: 'Lung Right Lower Lobe',
      priorMeasurementMm: 5.0,
      currentMeasurementMm: 7.2,
      priorDate: '2024-03-15',
      currentDate: new Date().toISOString().split('T')[0],
    }),
    computeClientSideGrowth({
      lesionName: 'Segment VI hepatic metastasis',
      anatomy: 'Liver',
      priorMeasurementMm: 22.0,
      currentMeasurementMm: 14.0,
      priorDate: '2024-04-01',
      currentDate: new Date().toISOString().split('T')[0],
    }),
  ];
}
