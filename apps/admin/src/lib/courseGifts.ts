import { useEffect, useState } from 'react';
import api from './api';
import { apiErrorMessage } from './errors';
import { toast } from '../stores/ui-store';

/** Kurs ↔ sovg'a kitob bog'lanishi (`course_gift_books`). */
export interface GiftLink {
  courseId: number;
  bookId: number;
}

export interface GiftToggleResult {
  ok: boolean;
  /** Amaldan keyin bog'lanish bormi. */
  linked: boolean;
  /** Biriktirilganda kitobni olgan mavjud o'quvchilar soni. */
  granted: number;
}

const keyOf = (courseId: number, bookId: number) => `${courseId}:${bookId}`;

/**
 * Sovg'a kitob bog'lanishlari — «Kurslar» va «Kutubxona» sahifalari bitta manbadan
 * foydalanadi, shuning uchun bog'lanish ikki tomondan ham bir xil ko'rinadi.
 */
export function useCourseGifts() {
  const [links, setLinks] = useState<GiftLink[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    api
      .get('/admin/course-gift-books')
      .then((res) => {
        if (!active) return;
        const list: unknown = res.data?.data ?? res.data;
        setLinks(Array.isArray(list) ? (list as GiftLink[]) : []);
        setLoadError(null);
      })
      .catch((err: unknown) => {
        if (active) setLoadError(apiErrorMessage(err, "Sovg'a kitoblar ro'yxatini yuklab bo'lmadi."));
      });
    return () => {
      active = false;
    };
  }, []);

  const isLinked = (courseId: number, bookId: number) =>
    links.some((l) => l.courseId === courseId && l.bookId === bookId);

  const isBusy = (courseId: number, bookId: number) => busy.includes(keyOf(courseId, bookId));

  /** Bog'lanishni qo'shadi yoki olib tashlaydi (hozirgi holatiga qarab). */
  const toggle = async (courseId: number, bookId: number): Promise<GiftToggleResult> => {
    const key = keyOf(courseId, bookId);
    const has = isLinked(courseId, bookId);
    if (busy.includes(key)) return { ok: false, linked: has, granted: 0 };
    setBusy((p) => [...p, key]);
    try {
      let granted = 0;
      if (has) {
        await api.delete(`/admin/courses/${courseId}/gift-books/${bookId}`);
        setLinks((prev) => prev.filter((l) => !(l.courseId === courseId && l.bookId === bookId)));
      } else {
        const res = await api.post(`/admin/courses/${courseId}/gift-books/${bookId}`);
        granted = Number(res.data?.data?.granted) || 0;
        setLinks((prev) => [...prev, { courseId, bookId }]);
      }
      return { ok: true, linked: !has, granted };
    } catch (err) {
      toast.error(
        apiErrorMessage(err, has ? "Sovg'ani olib tashlab bo'lmadi." : "Sovg'a kitobni biriktirib bo'lmadi."),
      );
      return { ok: false, linked: has, granted: 0 };
    } finally {
      setBusy((p) => p.filter((x) => x !== key));
    }
  };

  return { links, loadError, isLinked, isBusy, toggle };
}
