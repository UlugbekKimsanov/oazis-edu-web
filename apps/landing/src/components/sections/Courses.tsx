import { useEffect, useState } from 'react';
import { BookOpen, Clock, Users } from 'lucide-react';
import type { LandingContent } from '../../data/landing';
import { Section } from '../ui/Section';
import { Button } from '../ui/Button';
import { PurchasedBadge } from '../ui/PurchasedBadge';
import { fetchCourses, fileUrl, type ApiCourse } from '../../lib/api';
import { productKey, type PurchaseProduct } from '../../lib/auth';

/** Jonli (admin paneldan boshqariladigan) kurs kartasi. */
function ApiCourseCard({
  course,
  text,
  buying,
  loggedIn,
  onBuy,
  onFreeInfo,
}: {
  course: ApiCourse;
  text: LandingContent['courseCard'];
  buying: boolean;
  loggedIn: boolean;
  onBuy: (product: PurchaseProduct) => void;
  onFreeInfo: (title: string) => void;
}) {
  const cover = fileUrl(course.imageUrl || course.backgroundUrl);
  const priceText = course.isPremium
    ? course.priceLabel ||
      (course.price ? `${course.price.toLocaleString('ru-RU')} so'm` : '')
    : 'Bepul';
  return (
    <div className="flex h-full flex-col rounded-2xl border-2 border-gray-100 bg-white p-5 shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-primary hover:shadow-md">
      {cover ? (
        <img
          src={cover}
          alt={course.name}
          loading="lazy"
          decoding="async"
          className="mb-4 h-28 w-full rounded-xl object-cover"
        />
      ) : (
        <div className="mb-4 flex h-28 items-center justify-center rounded-xl bg-primary-light text-5xl">
          <span>{course.flagEmoji || '🎓'}</span>
        </div>
      )}
      <span className="mb-2 inline-block w-fit rounded-full bg-primary-light px-3 py-1 text-xs font-semibold text-primary">
        {text.categoryLabel}
      </span>
      <h3 className="text-base font-bold text-gray-900">{course.name}</h3>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
        {Boolean(course.students) && (
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" /> {course.students} {text.studentsLabel}
          </span>
        )}
        {Boolean(course.lessonCount) && (
          <span className="inline-flex items-center gap-1">
            <BookOpen className="h-3.5 w-3.5" /> {course.lessonCount} dars
          </span>
        )}
        {Boolean(course.hours) && (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> {course.hours} soat
          </span>
        )}
      </div>
      <div className="mt-auto pt-4">
        <span className="text-lg font-bold text-gray-900">{priceText}</span>
      </div>
      {course.isPremium && course.isEnrolled ? (
        <PurchasedBadge className="mt-4" />
      ) : course.isPremium ? (
        // Pullik kurs — shu sahifaning o'zida kirish va to'lov oqimi boshlanadi.
        <Button
          className="mt-4 w-full"
          disabled={buying}
          onClick={() => onBuy({ type: 'course', id: course.id, title: course.name })}
        >
          {buying ? 'Yuklanmoqda...' : text.buyLabel}
        </Button>
      ) : loggedIn ? (
        // Kirgan foydalanuvchiga ariza formasi ko'rsatilmaydi — ilovada ochilishini aytamiz.
        <Button className="mt-4 w-full" onClick={() => onFreeInfo(course.name)}>
          Bepul boshlash
        </Button>
      ) : (
        <a href="#royxatdan-otish" className="mt-4">
          <Button className="w-full">Bepul boshlash</Button>
        </a>
      )}
    </div>
  );
}

/**
 * Saytda sotuvdagi kurslar — tizimdagi haqiqiy kurslar (admin panelda
 * «Sotuvga chiqarish» bosilganlari). Namunaviy (mock) kartalar ko'rsatilmaydi.
 */
export function Courses({
  title,
  cardText,
  authToken,
  buyingKey,
  onBuy,
  onFreeInfo,
}: {
  title: string;
  cardText: LandingContent['courseCard'];
  /** Kirgan foydalanuvchi tokeni — sotib olingan kurslarni belgilash uchun. */
  authToken: string | null;
  /** Hozir checkout tokeni so'ralayotgan mahsulot kaliti (`course:5`). */
  buyingKey: string | null;
  onBuy: (product: PurchaseProduct) => void;
  /** Kirgan foydalanuvchi bepul kursni bosganda. */
  onFreeInfo: (title: string) => void;
}) {
  // null — hali yuklanmoqda.
  const [courses, setCourses] = useState<ApiCourse[] | null>(null);
  useEffect(() => {
    let active = true;
    // Kirish/chiqishda qayta so'raladi: "Sotib olingan" belgisi foydalanuvchiga bog'liq.
    fetchCourses(authToken).then((list) => {
      if (active) setCourses(list);
    });
    return () => {
      active = false;
    };
  }, [authToken]);

  return (
    <Section id="courses" title={title} className="bg-white">
      {courses !== null && courses.length === 0 ? (
        <p className="text-center text-sm text-gray-500">
          Hozircha sotuvdagi kurslar yo'q. Tez orada yangi kurslar qo'shiladi.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {(courses ?? []).map((c) => (
            <ApiCourseCard
              key={c.id}
              course={c}
              text={cardText}
              buying={buyingKey === productKey({ type: 'course', id: c.id })}
              loggedIn={authToken !== null}
              onBuy={onBuy}
              onFreeInfo={onFreeInfo}
            />
          ))}
        </div>
      )}
    </Section>
  );
}
