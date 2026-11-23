import type { KeyboardEvent } from 'react';
import { BookOpen, Clock, Gift, Users } from 'lucide-react';
import type { LandingContent } from '../../data/landing';
import { Section } from '../ui/Section';
import { Button } from '../ui/Button';
import { PurchasedBadge } from '../ui/PurchasedBadge';
import { fileUrl, type ApiCourse } from '../../lib/api';
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
  const gifts = course.giftBooks ?? [];
  // Pullik va hali olinmagan kursda butun karta xaridni boshlaydi (tugma shart emas).
  const canBuy = Boolean(course.isPremium) && !course.isEnrolled;
  const buy = () => {
    if (!buying) onBuy({ type: 'course', id: course.id, title: course.name });
  };
  const onCardKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      buy();
    }
  };

  return (
    <div
      {...(canBuy
        ? {
            role: 'button',
            tabIndex: 0,
            onClick: buy,
            onKeyDown: onCardKey,
            'aria-label': `${course.name} — ${text.buyLabel}`,
          }
        : {})}
      className={`flex h-full flex-col rounded-2xl border-2 border-gray-100 bg-white p-5 shadow-sm outline-none transition-[border-color,box-shadow] duration-200 hover:border-primary hover:shadow-md focus-visible:border-primary ${canBuy ? 'cursor-pointer' : ''}`}
    >
      <div className="relative mb-4">
        {cover ? (
          <img
            src={cover}
            alt={course.name}
            loading="lazy"
            decoding="async"
            className="h-28 w-full rounded-xl object-cover"
          />
        ) : (
          <div className="flex h-28 items-center justify-center rounded-xl bg-primary-light text-5xl">
            <span>{course.flagEmoji || '🎓'}</span>
          </div>
        )}
        {gifts.length > 0 && (
          <span
            className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-xs font-semibold text-pink-600 shadow"
            title={`Sovg'a kitob: ${gifts.join(', ')}`}
          >
            <Gift className="h-3.5 w-3.5" /> Sovg'a
          </span>
        )}
      </div>
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
      {gifts.length > 0 && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-pink-600">
          <Gift className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="line-clamp-2">Sovg'a: {gifts.join(', ')}</span>
        </p>
      )}
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
          onClick={(event) => {
            // Karta ham bosiladigan — xarid ikki marta boshlanmasligi uchun.
            event.stopPropagation();
            buy();
          }}
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
 * «Sotuvga chiqarish» bosilganlari). Ro'yxatni `App` yuklaydi (bosh sahifadagi
 * "kurslar" ko'rsatkichi ham shu ro'yxatdan hisoblanadi).
 */
export function Courses({
  title,
  cardText,
  courses,
  loggedIn,
  buyingKey,
  onBuy,
  onFreeInfo,
}: {
  title: string;
  cardText: LandingContent['courseCard'];
  /** null — hali yuklanmoqda. */
  courses: ApiCourse[] | null;
  loggedIn: boolean;
  /** Hozir checkout tokeni so'ralayotgan mahsulot kaliti (`course:5`). */
  buyingKey: string | null;
  onBuy: (product: PurchaseProduct) => void;
  /** Kirgan foydalanuvchi bepul kursni bosganda. */
  onFreeInfo: (title: string) => void;
}) {
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
              loggedIn={loggedIn}
              onBuy={onBuy}
              onFreeInfo={onFreeInfo}
            />
          ))}
        </div>
      )}
    </Section>
  );
}
