import api from './api';
import type { ApiResponse, FileType } from '@/types';
import type { ReportReview } from './reportService';

export interface ReportTemplate {
  id: string;
  name: string;
  modality: FileType;
  body: string;
  createdAt: string;
}

export const reportingService = {
  async templates() {
    return (await api.get<ApiResponse<ReportTemplate[]>>('/reporting/templates')).data.data;
  },
  async saveTemplate(data: Pick<ReportTemplate, 'name' | 'modality' | 'body'>) {
    return (await api.post<ApiResponse<ReportTemplate>>('/reporting/templates', data)).data.data;
  },
  async createDraft(data: { patientId: string; modality: FileType; studyDescription: string; reportText: string }) {
    return (await api.post<ApiResponse<ReportReview>>('/reporting/drafts', data)).data.data;
  },
};
