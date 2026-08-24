import { useState } from 'react';
import Button from '../../components/ui/Button';

export default function SettingsPage() {
  const [form, setForm] = useState({
    siteName: 'OAZIS',
    supportEmail: 'support@oazis.uz',
    telegramBot: '@oazis_support_bot',
    maxLoginAttempts: 5,
    otpExpireMinutes: 5,
    jwtExpireHours: 4320,
  });

  const handleSave = () => {
    // TODO: POST /api/v1/admin/settings
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Sozlamalar</h1>
        <p className="text-sm text-gray-500 mt-1">Platforma umumiy sozlamalari</p>
      </div>

      <div className="max-w-2xl space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Umumiy</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sayt nomi</label>
              <input value={form.siteName} onChange={(e) => setForm({ ...form, siteName: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Qo'llab-quvvatlash email</label>
              <input value={form.supportEmail} onChange={(e) => setForm({ ...form, supportEmail: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telegram bot</label>
              <input value={form.telegramBot} onChange={(e) => setForm({ ...form, telegramBot: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Xavfsizlik</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Maks. login urinishlar</label>
                <input type="number" value={form.maxLoginAttempts} onChange={(e) => setForm({ ...form, maxLoginAttempts: Number(e.target.value) })} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">OTP amal qilish (daqiqa)</label>
                <input type="number" value={form.otpExpireMinutes} onChange={(e) => setForm({ ...form, otpExpireMinutes: Number(e.target.value) })} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">JWT amal qilish (soat)</label>
              <input type="number" value={form.jwtExpireHours} onChange={(e) => setForm({ ...form, jwtExpireHours: Number(e.target.value) })} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
              <p className="text-xs text-gray-400 mt-1">4320 soat = 6 oy (mobil)</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave}>Saqlash</Button>
        </div>
      </div>
    </div>
  );
}
