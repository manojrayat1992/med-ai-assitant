import api from './api';
import type { ApiResponse } from '@/types';

export interface PlatformSummary {
  totalTenants: number;
  activeTenants: number;
  totalUsers: number;
  totalPatients: number;
  totalAnalyses: number;
  activeUsersToday: number;
  systemStatus: string;
  generatedAt: string;
}

export interface TenantOverview {
  id: string;
  name: string;
  subdomain: string;
  contactEmail: string;
  isActive: boolean;
  createdAt: string;
  userCount: number;
  patientCount: number;
}

export interface UserSignupItem {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  tenantName: string;
  subdomain: string;
}

export interface UserLoginItem {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  lastLoginAt: string;
  tenantName: string;
  subdomain: string;
}

export interface PlatformActivityItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  ipAddress: string | null;
  createdAt: string;
  tenantName: string;
  userEmail: string;
  userName: string;
}

export const platformAdminApi = {
  async getSummary(): Promise<PlatformSummary> {
    return (await api.get<ApiResponse<PlatformSummary>>('/platform/summary')).data.data;
  },

  async getTenants(): Promise<TenantOverview[]> {
    return (await api.get<ApiResponse<TenantOverview[]>>('/platform/tenants')).data.data;
  },

  async getSignups(): Promise<UserSignupItem[]> {
    return (await api.get<ApiResponse<UserSignupItem[]>>('/platform/signups')).data.data;
  },

  async getLogins(): Promise<UserLoginItem[]> {
    return (await api.get<ApiResponse<UserLoginItem[]>>('/platform/logins')).data.data;
  },

  async getActivity(): Promise<PlatformActivityItem[]> {
    return (await api.get<ApiResponse<PlatformActivityItem[]>>('/platform/activity')).data.data;
  },
};
