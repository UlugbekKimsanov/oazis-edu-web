import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Sahifaning URL parametrlarini (filtr, tanlangan kurs va h.k.) eslab qoladi.
 *
 * - Refresh / orqaga-oldinga — URL'ning o'zi orqali ishlaydi.
 * - Boshqa sahifaga o'tib, yon menyudan (bo'sh URL bilan) qaytilganda —
 *   oxirgi saqlangan parametrlar tiklanadi, admin qolgan joyidan davom etadi.
 *
 * `keys` — saqlanadigan parametrlar; modul darajasida `const` bo'lsin
 * (har renderda yangi massiv bo'lsa effekt bekorga qayta ishlaydi).
 */
export function useRememberedSearch(keys: readonly string[]) {
  const location = useLocation();
  const navigate = useNavigate();
  const storageKey = `oazis.admin.search:${location.pathname}`;

  // Bo'sh URL bilan kirilganda — eslab qolingan parametrlarni tiklash (faqat birinchi renderda)
  useEffect(() => {
    if (location.search) return;
    let saved: string | null;
    try {
      saved = localStorage.getItem(storageKey);
    } catch {
      saved = null;
    }
    if (saved) navigate({ pathname: location.pathname, search: saved }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Har o'zgarishda saqlash — faqat ruxsat etilgan kalitlar
  useEffect(() => {
    const current = new URLSearchParams(location.search);
    const keep = new URLSearchParams();
    for (const k of keys) {
      const v = current.get(k);
      if (v) keep.set(k, v);
    }
    const s = keep.toString();
    try {
      if (s) localStorage.setItem(storageKey, `?${s}`);
      else localStorage.removeItem(storageKey);
    } catch {
      /* storage bloklangan bo'lsa — jim */
    }
  }, [location.search, storageKey, keys]);
}
