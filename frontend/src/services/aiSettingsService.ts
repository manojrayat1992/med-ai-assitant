import api from './api';
import type { ApiResponse } from '@/types';

export type AiProvider = 'OPENAI' | 'GROQ' | 'CUSTOM';

export interface AiSettingsView {
  provider: AiProvider;
  baseUrl: string;
  chatModel: string;
  enabled: boolean;
  keyConfigured: boolean;
  apiKeyPreview?: string | null;
  dataAgreementInPlace: boolean;
  usingTenantSettings: boolean;
  updatedAt?: string | null;
}

export interface UpdateAiSettingsRequest {
  provider: AiProvider;
  baseUrl: string;
  chatModel: string;
  apiKey?: string;
  enabled: boolean;
  dataAgreementInPlace: boolean;
}

export interface AiConnectionTestResult {
  provider: AiProvider;
  baseUrl: string;
  chatModel: string;
  tenantManaged: boolean;
  success: boolean;
  message: string;
}

export const aiSettingsService = {
  async get(): Promise<AiSettingsView> {
    const res = await api.get<ApiResponse<AiSettingsView>>('/settings/ai');
    return res.data.data;
  },

  async update(request: UpdateAiSettingsRequest): Promise<AiSettingsView> {
    const res = await api.put<ApiResponse<AiSettingsView>>('/settings/ai', request);
    return res.data.data;
  },

  async reset(): Promise<AiSettingsView> {
    const res = await api.delete<ApiResponse<AiSettingsView>>('/settings/ai');
    return res.data.data;
  },

  async test(): Promise<AiConnectionTestResult> {
    const res = await api.post<ApiResponse<AiConnectionTestResult>>('/settings/ai/test');
    return res.data.data;
  },
};
