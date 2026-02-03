import { apiClient } from './client';
import type { IAuditLog, ApiResponse } from '@rmp/shared-types';

export const auditService = {
  async getAll(params?: {
    startDate?: string;
    endDate?: string;
    userEmail?: string;
    action?: string;
    entityId?: string;
  }): Promise<IAuditLog[]> {
    const response = await apiClient.get<ApiResponse<IAuditLog[]>>('/audit-logs', { params });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch audit logs');
    }
    return response.data.data;
  },

  async getByTrainer(trainerId: string): Promise<IAuditLog[]> {
    const response = await apiClient.get<ApiResponse<IAuditLog[]>>(`/audit-logs/trainer/${trainerId}`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch trainer audit logs');
    }
    return response.data.data;
  },
};
