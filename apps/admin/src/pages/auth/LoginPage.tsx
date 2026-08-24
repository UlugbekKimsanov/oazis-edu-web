import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth-store';
import api from '../../lib/api';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/login', { email, password, mobile: false });
      const data = res.data.data ?? res.data;

      if (!data?.token) {
        setError("Noto'g'ri javob qaytdi");
        return;
      }

      const role = data.role;
      if (role !== 'ADMIN' && role !== 'TEACHER') {
        setError("Faqat admin va o'qituvchilar kira oladi.");
        return;
      }

      const user = {
        id: data.id,
        firstName: data.firstName,
        lastName: data.lastName,
        email,
        phone: data.phone,
        role: data.role,
      };

      login(data.token, user, rememberMe);
      navigate(role === 'ADMIN' ? '/admin' : '/teacher');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || "Email yoki parol noto'g'ri");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[var(--primary-light)] to-white px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[var(--primary)] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[var(--primary)]/30">
            <span className="text-white font-bold text-xl">O</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">OAZIS Panel</h1>
          <p className="text-sm text-gray-500 mt-1">Admin yoki O'qituvchi sifatida kiring</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-colors"
              placeholder="admin@oazis.uz"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Parol</label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-colors"
              placeholder="••••••••"
            />
          </div>

          <label className="mb-6 flex cursor-pointer items-center gap-2 text-sm text-gray-600 select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 accent-[var(--primary)]"
            />
            Eslab qolish
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[var(--primary)] text-white text-sm font-semibold rounded-lg hover:bg-[var(--primary-dark)] transition-colors disabled:opacity-50 shadow-sm"
          >
            {loading ? 'Kirish...' : 'Kirish'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">OAZIS Education Platform v1.0</p>
      </div>
    </div>
  );
}
