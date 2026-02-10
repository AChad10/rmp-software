import { apiClient } from './client';
import type { ISalaryStatement, ApiResponse, GenerateSalaryRequest } from '@rmp/shared-types';

export const salaryService = {
  async getAll(params?: { month?: string; trainerId?: string; status?: string }): Promise<ISalaryStatement[]> {
    const response = await apiClient.get<ApiResponse<ISalaryStatement[]>>('/salary/statements', { params });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch salary statements');
    }
    return response.data.data;
  },

  async getById(id: string): Promise<ISalaryStatement> {
    const response = await apiClient.get<ApiResponse<ISalaryStatement>>(`/salary/statements/${id}`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch salary statement');
    }
    return response.data.data;
  },

  async generate(data: GenerateSalaryRequest): Promise<{ generatedCount: number; statements: ISalaryStatement[] }> {
    const response = await apiClient.post<ApiResponse<{ generatedCount: number; statements: ISalaryStatement[] }>>(
      '/salary/generate',
      data
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to generate salary statements');
    }
    return response.data.data;
  },

  async updateStatus(id: string, status: 'draft' | 'sent' | 'paid'): Promise<ISalaryStatement> {
    const response = await apiClient.put<ApiResponse<ISalaryStatement>>(
      `/salary/statements/${id}/status`,
      { status }
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to update salary statement status');
    }
    return response.data.data;
  },

  async createDrafts(month: string): Promise<{ draftsCreated: number; errors: any[] }> {
    const response = await apiClient.post<ApiResponse<{ draftsCreated: number; errors: any[] }>>(
      '/salary/create-drafts',
      { month }
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to create Gmail drafts');
    }
    return response.data.data;
  },

  getPdfUrl(statementId: string): string {
    return `${apiClient.defaults.baseURL?.replace('/api', '')}/pdfs/${statementId}.pdf`;
  },
};
