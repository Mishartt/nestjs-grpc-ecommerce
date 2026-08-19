import { create } from 'zustand';
import type { RegisterRequest, User } from '../../types';

type AuthStatus = 'bootstrapping' | 'ready';

type AuthState = {
  status: AuthStatus;
  token: string | null;
  user: User | null;
  setSession: (token: string, user: User) => void;
  clearSession: () => void;
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'bootstrapping',
  token: localStorage.getItem('accessToken'),
  user: null,

  setSession: (token, user) => {
    localStorage.setItem('accessToken', token);
    set({ token, user, status: 'ready' });
  },

  clearSession: () => {
    localStorage.removeItem('accessToken');
    set({ token: null, user: null, status: 'ready' });
  },

  hydrate: async () => {
    const token = get().token;
    if (!token) {
      set({ user: null, status: 'ready' });
      return;
    }

    try {
      const { authApi } = await import('../../api/client');
      const user = await authApi.me();
      set({ user, status: 'ready' });
    } catch {
      get().clearSession();
    }
  },

  login: async (email, password) => {
    const { authApi } = await import('../../api/client');
    const res = await authApi.login({ email, password });
    if (!res.user) {
      throw new Error('Invalid auth response');
    }
    get().setSession(res.accessToken, res.user);
  },

  register: async (data) => {
    const { authApi } = await import('../../api/client');
    const res = await authApi.register(data);
    if (!res.user) {
      throw new Error('Invalid auth response');
    }
    get().setSession(res.accessToken, res.user);
  },

  logout: () => {
    get().clearSession();
  },
}));
