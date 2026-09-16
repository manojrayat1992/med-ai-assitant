import api from './api';
import type { ApiResponse } from '@/types';
export type FeedbackCategory = 'WRONG_SUGGESTION' | 'MISSED_FINDING' | 'OTHER';
export interface FeedbackRequest { submissionId: string; category: FeedbackCategory; originalSuggestion: string; explanation: string; correction: string }
export interface ReportFeedback {
  id: string; reportId: string; submittedBy: string; category: FeedbackCategory; createdAt: string;
  content: {originalSuggestion: string; explanation: string; correction: string; reportSnapshot: string | null; reportStatus: string; reportUpdatedAt: string};
}
export const reportFeedbackApi = {
  async list(reportId: string, page=0) {return (await api.get<ApiResponse<ReportFeedback[]>>(`/reports/${reportId}/feedback`, {params:{page}})).data.data;},
  async submit(reportId: string, request: FeedbackRequest) {return (await api.post<ApiResponse<ReportFeedback>>(`/reports/${reportId}/feedback`, request)).data.data;},
};
