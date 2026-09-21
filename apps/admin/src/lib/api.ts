import axios from 'axios';

// Barcha so'rovlar to'g'ridan-to'g'ri backend domeniga boradi (Vite proxy'siz).
// Lokal backend bilan ishlash uchun .env.local da VITE_API_ORIGIN=http://localhost:8080 qo'ying.
export const API_ORIGIN: string =
  (import.meta.env.VITE_API_ORIGIN ?? 'https://api.oazisedu.uz').replace(/\/$/, '');

// WebSocket uchun mos origin (https -> wss, http -> ws)
export const WS_ORIGIN = API_ORIGIN.replace(/^http/, 'ws');

// DB'dagi fayl yo'li -> to'liq URL
export const fileUrl = (p?: string) =>
  p ? (/^https?:\/\//i.test(p) ? p : `${API_ORIGIN}/files/${p.replace(/^\//, '')}`) : '';

const api = axios.create({
  baseURL: `${API_ORIGIN}/api/v1`,
  // So'rov abadiy "pending"da qotmasligi uchun timeout (backend restart bo'lsa ham).
  // Lokal yuklashlar (video/audio) tez, 60s yetarli.
  timeout: 60000,
  // Content-Type qo'lda berilmaydi: axios oddiy obyektlarga application/json,
  // FormData (rasm yuklash) uchun esa multipart/form-data (boundary bilan) qo'yadi.
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token') ?? sessionStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // JSON yuborilganda (FormData bo'lmasa) Content-Type'ni aniq belgilaymiz
  const isForm = typeof FormData !== 'undefined' && config.data instanceof FormData;
  if (!isForm && config.data != null) {
    config.headers['Content-Type'] = 'application/json';
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const isAuthRoute = err.config?.url?.startsWith('/auth');
    const status = err.response?.status;
    // 401 = login qilinmagan/token yaroqsiz, 403 = admin emas — ikkalasida ham login pagega
    if ((status === 401 || status === 403) && !isAuthRoute) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
