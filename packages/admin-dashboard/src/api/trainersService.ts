import { apiClient } from './client';
import type { ITrainer, ApiResponse, CreateTrainerRequest, UpdateTrainerRequest } from '@rmp/shared-types';

export const trainersService = {
  async getAll(params?: { status?: string; search?: string }): Promise<ITrainer[]> {
    const response = await apiClient.get<ApiResponse<ITrainer[]>>('/trainers', { params });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch trainers');
    }
    return response.data.data;
  },

  async getById(id: string): Promise<ITrainer> {
    const response = await apiClient.get<ApiResponse<ITrainer>>(`/trainers/${id}`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch trainer');
    }
    return response.data.data;
  },

  async create(data: CreateTrainerRequest): Promise<ITrainer> {
    const response = await apiClient.post<ApiResponse<ITrainer>>('/trainers', data);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to create trainer');
    }
    return response.data.data;
  },

  async update(id: string, data: UpdateTrainerRequest): Promise<ITrainer> {
    const response = await apiClient.put<ApiResponse<ITrainer>>(`/trainers/${id}`, data);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to update trainer');
    }
    return response.data.data;
  },

  async delete(id: string): Promise<void> {
    const response = await apiClient.delete<ApiResponse>(`/trainers/${id}`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to delete trainer');
    }
  },
};
