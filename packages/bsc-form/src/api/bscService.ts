import { apiClient } from './client';
import type { ITrainer, IBSCEntry, SubmitBSCRequest, ApiResponse } from '@rmp/shared-types';

export const bscService = {
  // Get trainer details
  async getTrainer(trainerId: string): Promise<ITrainer> {
    const response = await apiClient.get<ApiResponse<ITrainer>>(`/trainers/${trainerId}`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch trainer');
    }
    return response.data.data;
  },

  // Submit BSC self-assessment
  async submitBSC(data: SubmitBSCRequest): Promise<IBSCEntry> {
    const response = await apiClient.post<ApiResponse<IBSCEntry>>('/bsc/submit', data);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to submit BSC');
    }
    return response.data.data;
  },

  // Check if trainer already submitted for this quarter
  async checkExistingSubmission(trainerId: string, quarter: string): Promise<IBSCEntry | null> {
    try {
      const response = await apiClient.get<ApiResponse<IBSCEntry[]>>(
        `/bsc/trainer/${trainerId}`
      );
      if (response.data.success && response.data.data) {
        const existing = response.data.data.find((entry) => entry.quarter === quarter);
        return existing || null;
      }
      return null;
    } catch (error) {
      // If no entries found, return null
      return null;
    }
  },
};
