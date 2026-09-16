import api from './api';
import type { ApiResponse } from '@/types';
import type {
  IncidentalFinding,
  IncidentalTrackerSummary,
  ParseReportRequest,
  UpdateStatusRequest,
  IncidentalFollowUpStatus,
  IncidentalGuidelineSystem,
} from '@/types/incidentalTracker';

export const incidentalTrackerApi = {
  async getFindings(params?: {
    patientId?: string;
    status?: IncidentalFollowUpStatus;
    guideline?: IncidentalGuidelineSystem;
  }): Promise<IncidentalFinding[]> {
    const res = await api.get<ApiResponse<IncidentalFinding[]>>('/incidental-findings', {
      params,
    });
    return res.data.data;
  },

  async getSummary(): Promise<IncidentalTrackerSummary> {
    const res = await api.get<ApiResponse<IncidentalTrackerSummary>>('/incidental-findings/summary');
    return res.data.data;
  },

  async parseReport(request: ParseReportRequest): Promise<IncidentalFinding[]> {
    const res = await api.post<ApiResponse<IncidentalFinding[]>>(
      '/incidental-findings/parse',
      request
    );
    return res.data.data;
  },

  async updateStatus(
    findingId: string,
    request: UpdateStatusRequest
  ): Promise<IncidentalFinding> {
    const res = await api.patch<ApiResponse<IncidentalFinding>>(
      `/incidental-findings/${findingId}/status`,
      request
    );
    return res.data.data;
  },
};
