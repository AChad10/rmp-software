import { create } from 'zustand';
import { authService, type LoginResponse } from '../api/authService';

interface AuthState {
  user: LoginResponse['user'] | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: authService.getStoredUser(),
  token: authService.getToken(),
  isAuthenticated: authService.isAuthenticated(),

  login: async (email: string, password: string) => {
    const response = await authService.login({ email, password });

    // Store token and user data
    localStorage.setItem('auth_token', response.token);
    localStorage.setItem('user', JSON.stringify(response.user));

    set({
      user: response.user,
      token: response.token,
      isAuthenticated: true,
    });
  },

  logout: () => {
    authService.logout();
    set({
      user: null,
      token: null,
      isAuthenticated: false,
    });
  },

  checkAuth: () => {
    const user = authService.getStoredUser();
    const token = authService.getToken();
    set({
      user,
      token,
      isAuthenticated: !!token,
    });
  },
}));
