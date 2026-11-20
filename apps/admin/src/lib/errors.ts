// Backend xatosidan foydalanuvchiga ko'rsatiladigan matnni ajratib oladi.
export function apiErrorMessage(err: unknown, fallback = "Xatolik yuz berdi. Qayta urinib ko'ring."): string {
  const e = err as {
    code?: string;
    message?: string;
    response?: { status?: number; data?: { message?: unknown; error?: unknown } | string };
  };
  const data = e?.response?.data;
  if (data && typeof data === 'object') {
    if (typeof data.message === 'string' && data.message.trim()) return data.message;
    if (typeof data.error === 'string' && data.error.trim()) return data.error;
  }
  const status = e?.response?.status;
  if (status === 413) return 'Fayl hajmi juda katta.';
  if (status === 404) return "Ma'lumot topilmadi.";
  if (status && status >= 500) return "Serverda xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring.";
  if (e?.code === 'ECONNABORTED') return "So'rov vaqti tugadi. Internetni tekshirib, qayta urinib ko'ring.";
  if (e?.message === 'Network Error') return "Serverga ulanib bo'lmadi. Internetni tekshiring.";
  return fallback;
}
