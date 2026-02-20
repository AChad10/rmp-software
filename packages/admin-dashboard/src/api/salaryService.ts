import { apiClient } from './client';
import type { ISalaryStatement, IPerClassStatement, ApiResponse, GenerateSalaryRequest } from '@rmp/shared-types';

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

  async generateSingle(data: {
    trainerId: string;
    month: string;
    pdfData: Record<string, any>;
    overwrite?: boolean;
  }): Promise<ISalaryStatement> {
    const response = await apiClient.post<ApiResponse<ISalaryStatement>>(
      '/salary/generate-single',
      data
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to generate statement');
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

  // Per-Class Trainer methods
  async getPerClassStatements(params?: { month?: string; status?: string }): Promise<IPerClassStatement[]> {
    const response = await apiClient.get<ApiResponse<IPerClassStatement[]>>('/salary/per-class/statements', { params });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch per-class statements');
    }
    return response.data.data;
  },

  async sendPerClassLogs(month: string): Promise<{ sent: number; errors: any[] }> {
    const response = await apiClient.post<ApiResponse<{ sent: number; errors: any[] }>>(
      '/salary/per-class/send-logs',
      { month }
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to send log summaries');
    }
    return response.data.data;
  },

  async generatePerClassPayouts(month: string): Promise<{ generated: number; errors: any[] }> {
    const response = await apiClient.post<ApiResponse<{ generated: number; errors: any[] }>>(
      '/salary/per-class/generate-payouts',
      { month }
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to generate payouts');
    }
    return response.data.data;
  },

  async updatePerClassStatus(id: string, status: string): Promise<IPerClassStatement> {
    const response = await apiClient.put<ApiResponse<IPerClassStatement>>(
      `/salary/per-class/statements/${id}/status`,
      { status }
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to update status');
    }
    return response.data.data;
  },
};
