import { apiClient } from './client';
import type { ITrainer, IBSCEntry, SubmitBSCRequest, ApiResponse } from '@rmp/shared-types';

export const bscService = {
  // Get trainer details by secure BSC access token
  async getTrainerByToken(token: string): Promise<ITrainer> {
    const response = await apiClient.get<ApiResponse<ITrainer>>(`/trainers/bsc-access/${token}`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Invalid or expired access token');
    }
    return response.data.data;
  },

  // Get trainer details by ID (for internal use)
  async getTrainer(trainerId: string): Promise<ITrainer> {
    const response = await apiClient.get<ApiResponse<ITrainer>>(`/trainers/${trainerId}`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch trainer');
    }
    return response.data.data;
  },

  // Submit BSC self-assessment (bscAccessToken proves the caller owns this trainer record)
  async submitBSC(data: SubmitBSCRequest, bscAccessToken: string): Promise<IBSCEntry> {
    try {
      const response = await apiClient.post<ApiResponse<IBSCEntry>>('/bsc/submit', {
        ...data,
        bscAccessToken,
      });
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error || 'Failed to submit BSC');
      }
      return response.data.data;
    } catch (error: any) {
      // Enhanced error message from backend
      const errorMessage = error.response?.data?.error || error.message || 'Failed to submit BSC';
      console.error('BSC submission error:', error.response?.data);
      throw new Error(errorMessage);
    }
  },

  // Check if trainer already submitted for this quarter (uses token-based endpoint)
  async checkExistingSubmission(trainerId: string, quarter: string, bscAccessToken: string): Promise<IBSCEntry | null> {
    try {
      const response = await apiClient.get<ApiResponse<IBSCEntry[]>>(
        `/bsc/check/${trainerId}/${quarter}`,
        { params: { token: bscAccessToken } }
      );
      if (response.data.success && response.data.data && response.data.data.length > 0) {
        return response.data.data[0];
      }
      return null;
    } catch (error) {
      // If no entries found or endpoint errors, return null
      return null;
    }
  },
};
