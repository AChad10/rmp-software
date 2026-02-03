import { apiClient } from './client';
import type { IBSCEntry, ApiResponse, ValidateBSCRequest } from '@rmp/shared-types';

export const bscService = {
  async getAll(params?: { status?: string; quarter?: string }): Promise<IBSCEntry[]> {
    const response = await apiClient.get<ApiResponse<IBSCEntry[]>>('/bsc', { params });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch BSC entries');
    }
    return response.data.data;
  },

  async getPending(): Promise<IBSCEntry[]> {
    const response = await apiClient.get<ApiResponse<IBSCEntry[]>>('/bsc/pending');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch pending BSC entries');
    }
    return response.data.data;
  },

  async getById(id: string): Promise<IBSCEntry> {
    const response = await apiClient.get<ApiResponse<IBSCEntry>>(`/bsc/${id}`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch BSC entry');
    }
    return response.data.data;
  },

  async validate(id: string, data: ValidateBSCRequest): Promise<IBSCEntry> {
    const response = await apiClient.put<ApiResponse<IBSCEntry>>(`/bsc/${id}/validate`, data);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to validate BSC');
    }
    return response.data.data;
  },
};
