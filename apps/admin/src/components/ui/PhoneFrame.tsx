// ─────────────────────────────────────────────────────────────
// iPhone 12 Pro ramka (390 × 844) — mobil ilova preview'lari uchun umumiy.
// Ichidagi kontent 390×844 ekranga joylashadi; kattalashtirish uchun
// tashqarida transform: scale(zoom) ishlatiladi.
// ─────────────────────────────────────────────────────────────
export default function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative rounded-[52px] bg-black shadow-2xl"
      style={{ width: 390, height: 844, padding: 12 }}
    >
      {/* Notch */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 w-36 h-7 bg-black rounded-b-2xl z-30" />
      {/* Ekran — background va kontent shu ichida joylashadi */}
      <div className="w-full h-full rounded-[40px] overflow-hidden bg-[#E8F5EE] relative">
        {children}
      </div>
    </div>
  );
}
