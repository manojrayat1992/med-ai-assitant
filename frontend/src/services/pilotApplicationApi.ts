import axios from 'axios';
import api from './api';
import type { ApiResponse } from '@/types';
export interface PilotApplication {
  submissionId:string; centreName:string; contactName:string; email:string; location:string;
  reportingSoftware:string; monthlyReportVolume:number; teamSize:number; mainProblem:string;
  integrationNeeds:string; contactConsent:boolean;
}
export type PilotStatus = 'NEW'|'CONTACTED'|'QUALIFIED'|'CLOSED';
export interface PilotReceipt { reference:string; message:string }
export interface PilotEntry {id:string;status:PilotStatus;createdAt:string;updatedAt:string;reviewedBy:string|null;application:PilotApplication}
export const pilotApplicationApi = {
  async submit(payload:PilotApplication){return (await axios.post<ApiResponse<PilotReceipt>>('/api/public/pilot-applications',payload)).data.data;},
  async access(){return (await api.get<ApiResponse<boolean>>('/pilot-applications/access')).data.data;},
  async list(page:number,status:string){return (await api.get<ApiResponse<PilotEntry[]>>('/pilot-applications',{params:{page,status:status||undefined}})).data.data;},
  async update(id:string,status:PilotStatus){await api.patch(`/pilot-applications/${id}/status`,{status});},
};
