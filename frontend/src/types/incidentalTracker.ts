export type IncidentalGuidelineSystem =
  | 'FLEISCHNER'
  | 'TI_RADS'
  | 'BI_RADS'
  | 'LUNG_RADS'
  | 'GENERAL';

export type IncidentalFollowUpStatus =
  | 'PENDING_SCHEDULING'
  | 'SCHEDULED'
  | 'COMPLETED'
  | 'OVERDUE'
  | 'DISMISSED';

export interface IncidentalFinding {
  id: string;
  tenantId: string;
  patientId: string;
  reportId?: string;
  patientName?: string;
  mrn?: string;
  findingText: string;
  guidelineSystem: IncidentalGuidelineSystem;
  recommendationText: string;
  timeframeMonths?: number;
  dueDate?: string;
  status: IncidentalFollowUpStatus;
  followUpModality?: string;
  estimatedRevenueRecapture?: number;
  scheduledDate?: string;
  completedDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface IncidentalTrackerSummary {
  totalCount: number;
  pendingCount: number;
  scheduledCount: number;
  completedCount: number;
  overdueCount: number;
  totalRevenueOpportunity: number;
  recapturedRevenue: number;
  guidelineBreakdown: Record<string, number>;
}

export interface ParseReportRequest {
  patientId: string;
  reportId?: string;
  reportText: string;
  patientName?: string;
  mrn?: string;
}

export interface UpdateStatusRequest {
  status: IncidentalFollowUpStatus;
  scheduledDate?: string;
  completedDate?: string;
  notes?: string;
}
