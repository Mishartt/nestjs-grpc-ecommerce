import axios, { type AxiosResponse } from 'axios';
import { useAuthStore } from '../shared/auth/store';

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const url = String(error.config?.url ?? '');
      const isPublicAuth = /\/auth\/(login|register|captcha)\b/.test(url);
      if (error.response?.status === 401 && !isPublicAuth) {
        useAuthStore.getState().clearSession();
      }
    }
    return Promise.reject(toApiError(error));
  },
);

function toApiError(error: unknown): Error {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data as { message?: string | string[] } | undefined;
    if (Array.isArray(payload?.message)) {
      return new Error(payload.message.join(', '));
    }
    if (typeof payload?.message === 'string') {
      return new Error(payload.message);
    }
    return new Error(error.message);
  }
  return error instanceof Error ? error : new Error('Request failed');
}

export async function request<T>(promise: Promise<AxiosResponse<T>>): Promise<T> {
  const response = await promise;
  return response.data;
}
