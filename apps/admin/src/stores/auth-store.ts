import { create } from 'zustand';
import type { User, Role } from '../lib/types';

interface AuthState {
  user: User | null;
  token: string | null;
  role: Role | null;
  isAuthenticated: boolean;
  login: (token: string, user: User, rememberMe: boolean) => void;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  role: null,
  isAuthenticated: false,

  login: (token, user, rememberMe) => {
    const storage = rememberMe ? localStorage : sessionStorage;
    const staleStorage = rememberMe ? sessionStorage : localStorage;

    staleStorage.removeItem('token');
    staleStorage.removeItem('user');
    storage.setItem('token', token);
    storage.setItem('user', JSON.stringify(user));
    set({
      token,
      user,
      role: user.role as Role,
      isAuthenticated: true,
    });
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    set({ token: null, user: null, role: null, isAuthenticated: false });
  },

  hydrate: () => {
    const storage = localStorage.getItem('token') ? localStorage : sessionStorage;
    const token = storage.getItem('token');
    const userStr = storage.getItem('user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr) as User;
        set({
          token,
          user,
          role: user.role as Role,
          isAuthenticated: true,
        });
      } catch {
        storage.removeItem('token');
        storage.removeItem('user');
      }
    }
  },
}));
