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

type StoredSession = Pick<AuthState, 'user' | 'token' | 'role' | 'isAuthenticated'>;

const EMPTY_SESSION: StoredSession = { user: null, token: null, role: null, isAuthenticated: false };

/**
 * Saqlangan sessiyani SINXRON o'qiydi — store yaratilgan zahoti auth ma'lum bo'ladi.
 * Aks holda birinchi renderda `isAuthenticated=false` bo'lib, refresh qilinganda
 * ProtectedRoute /login'ga, u esa dashboard'ga otib yuborar edi (joriy sahifa yo'qolardi).
 */
function readStoredSession(): StoredSession {
  try {
    const storage = localStorage.getItem('token') ? localStorage : sessionStorage;
    const token = storage.getItem('token');
    const userStr = storage.getItem('user');
    if (!token || !userStr) return EMPTY_SESSION;
    try {
      const user = JSON.parse(userStr) as User;
      return { token, user, role: user.role as Role, isAuthenticated: true };
    } catch {
      storage.removeItem('token');
      storage.removeItem('user');
      return EMPTY_SESSION;
    }
  } catch {
    // storage bloklangan (private rejim va h.k.)
    return EMPTY_SESSION;
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  ...readStoredSession(),

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

  // Moslik uchun qoldirildi (App mount'da chaqiradi) — holatni storage bilan qayta sinxronlaydi
  hydrate: () => set(readStoredSession()),
}));
