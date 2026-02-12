import { apiClient } from './client';
import type { ApiResponse } from '@rmp/shared-types';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    userId: string;
    email: string;
    name: string;
    picture?: string;
    role: 'admin' | 'trainer';
  };
}

export interface GoogleLoginRequest {
  credential: string;
}

export interface GoogleConfigResponse {
  clientId: string | null;
  enabled: boolean;
}

export const authService = {
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await apiClient.post<ApiResponse<LoginResponse>>(
      '/auth/login',
      credentials
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Login failed');
    }
    return response.data.data;
  },

  async googleLogin(credential: string): Promise<LoginResponse> {
    const response = await apiClient.post<ApiResponse<LoginResponse>>(
      '/auth/google',
      { credential }
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Google login failed');
    }
    return response.data.data;
  },

  async getGoogleConfig(): Promise<GoogleConfigResponse> {
    const response = await apiClient.get<ApiResponse<GoogleConfigResponse>>(
      '/auth/google/config'
    );
    if (!response.data.success || !response.data.data) {
      throw new Error('Failed to get Google config');
    }
    return response.data.data;
  },

  async logout(): Promise<void> {
    // Clear local storage
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
  },

  getStoredUser(): LoginResponse['user'] | null {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  getToken(): string | null {
    return localStorage.getItem('auth_token');
  },

  isAuthenticated(): boolean {
    return !!this.getToken();
  },
};
