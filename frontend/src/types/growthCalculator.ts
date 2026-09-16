export type RecistCategory =
  | 'PROGRESSIVE_DISEASE'
  | 'STABLE_DISEASE'
  | 'PARTIAL_RESPONSE'
  | 'COMPLETE_RESPONSE';

export type ClinicalSignificance =
  | 'RAPID_GROWTH'
  | 'INDOLENT_GROWTH'
  | 'STABLE'
  | 'REGRESSION';

export interface GrowthDeltaResult {
  lesionName: string;
  anatomy?: string;
  priorDate: string;
  currentDate: string;
  elapsedDays: number;
  priorMeasurementMm: number;
  currentMeasurementMm: number;
  linearDeltaMm: number;
  linearPercentChange: number;
  priorVolumeMm3: number;
  currentVolumeMm3: number;
  volumePercentChange: number;
  volumeDoublingTimeDays?: number | null;
  growthVelocityMmPerMonth: number;
  recistCategory: RecistCategory;
  recistLabel: string;
  clinicalSignificance: ClinicalSignificance;
  narrative: string;
}

export interface CalculateGrowthRequest {
  lesionName?: string;
  anatomy?: string;
  priorMeasurementMm: number;
  currentMeasurementMm: number;
  priorDate?: string;
  currentDate?: string;
}
