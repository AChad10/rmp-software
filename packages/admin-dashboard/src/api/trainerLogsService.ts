import { apiClient } from './client';
import type { ApiResponse, TrainerLogsDraftResult } from '@rmp/shared-types';

export const trainerLogsService = {
  async createAllDrafts(): Promise<TrainerLogsDraftResult[]> {
    const response = await apiClient.post<ApiResponse<TrainerLogsDraftResult[]>>('/trainer-logs/create-drafts');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to create drafts');
    }
    return response.data.data;
  },
};
