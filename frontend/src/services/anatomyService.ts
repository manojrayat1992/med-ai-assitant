import api from './api';
import type { ApiResponse } from '@/types';

export interface AnatomyDefinitionDto {
  structureCode: string;
  system: 'SKELETAL' | 'RESPIRATORY' | 'URINARY' | 'NERVOUS';
  displayLabel: string;
  paired: boolean;
  supportedSides: ('RIGHT' | 'LEFT' | 'BILATERAL')[];
  viewerKeyPattern: string;
  parentStructureCode: string | null;
}

export interface AnatomyStructuresResponse {
  totalStructures: number;
  systems: Record<string, {
    code: string;
    label: string;
    paired: boolean;
    supportedSides: string[];
    viewerKeyPattern: string;
  }[]>;
}

export const anatomyService = {
  async getCatalog(): Promise<AnatomyDefinitionDto[]> {
    const res = await api.get<ApiResponse<AnatomyDefinitionDto[]>>('/anatomy/catalog');
    return res.data.data;
  },

  async getStructures(): Promise<AnatomyStructuresResponse> {
    const res = await api.get<ApiResponse<AnatomyStructuresResponse>>('/anatomy/structures');
    return res.data.data;
  },

  async getViewerKey(code: string, side = 'UNSPECIFIED'): Promise<string> {
    const res = await api.get<ApiResponse<{ viewerKey: string }>>('/anatomy/viewer-key', {
      params: { code, side },
    });
    return res.data.data.viewerKey;
  },
};
