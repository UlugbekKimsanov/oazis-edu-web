import { useEffect, useRef, type KeyboardEvent } from 'react';
import { BookOpen, Star } from 'lucide-react';
import { Section } from '../ui/Section';
import { Button } from '../ui/Button';
import { PurchasedBadge } from '../ui/PurchasedBadge';
import { fileUrl, type ApiBook } from '../../lib/api';
import { productKey, type PurchaseProduct } from '../../lib/auth';

function categoryLabel(category?: string): string {
  if (category === 'print') return 'Bosma';
  if (category === 'digital') return 'Elektron';
  return 'Kitob';
}

function BookCard({
  book,
  buying,
  onBuy,
  onFree,
  onOwned,
}: {
  book: ApiBook;
  buying: boolean;
  onBuy: (product: PurchaseProduct) => void;
  onFree: (product: PurchaseProduct) => void;
  onOwned: (product: PurchaseProduct) => void;
}) {
  const cover = fileUrl(book.coverUrl);
  // Backend bilan bir xil qoida: bepul yoki narxsiz kitob uchun to'lov yo'q.
  const isPaid = !book.isFree && Boolean(book.price && book.price > 0);
  const priceText = book.isFree
    ? 'Bepul'
    : book.priceLabel ||
      (book.price ? `${book.price.toLocaleString('ru-RU')} so'm` : '');
  // Pullik va hali olinmagan kitobda butun karta xaridni boshlaydi (tugma shart emas).
  const canBuy = isPaid && !book.isPurchased;
  const product: PurchaseProduct = {
    type: 'book',
    id: book.id,
    title: book.title,
    print: book.category === 'print',
  };
  const buy = () => {
    if (!buying) onBuy(product);
  };
  return (
    <div
      {...(canBuy
        ? {
            role: 'button',
            tabIndex: 0,
            onClick: buy,
            onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
              if (event.target !== event.currentTarget) return;
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                buy();
              }
            },
            'aria-label': `${book.title} — Xarid qilish`,
          }
        : {})}
      className={`oz-card flex h-full min-w-0 flex-col rounded-2xl border-2 border-gray-100 bg-white p-5 shadow-sm outline-none ${canBuy ? 'cursor-pointer' : ''}`}
    >
      {/* Kurs kartasi bilan bir xil uslub: tepada rasm bloki, toifa, nom, meta, narx, tugma.
          Kitob muqovasi tik (3:4) bo'lgani uchun blok ichida to'liq, kesilmasdan ko'rsatiladi. */}
      <div className="oz-card-media mb-4 flex h-36 items-center justify-center overflow-hidden rounded-xl bg-primary-light p-2">
        {cover ? (
          <img
            src={cover}
            alt={book.title}
            loading="lazy"
            decoding="async"
            className="h-full w-auto max-w-full rounded-md object-contain shadow-md"
          />
        ) : (
          <span className="flex flex-col items-center gap-2 text-primary">
            {book.emoji && <span className="text-5xl leading-none">{book.emoji}</span>}
            {!book.emoji && <BookOpen className="h-10 w-10" />}
          </span>
        )}
      </div>
      <span className="mb-2 inline-block w-fit rounded-full bg-primary-light px-3 py-1 text-xs font-semibold text-primary">
        {categoryLabel(book.category)}
      </span>
      {/* Uzun/bo'shliqsiz nomlar kartadan chiqib ketmasligi uchun 2 qatorda kesiladi;
          to'liq nom title'da. */}
      <h3
        className="line-clamp-2 text-base font-bold text-gray-900 [overflow-wrap:anywhere]"
        title={book.title}
      >
        {book.title}
      </h3>
      <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
        {book.author && <span className="min-w-0 truncate">{book.author}</span>}
        {Boolean(book.rating) && (
          <span className="inline-flex shrink-0 items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            {(book.rating as number).toFixed(1)}
          </span>
        )}
      </div>
      {/* Narx meta qatoridan keyin darhol turadi; qatordagi kartalar balandligi farq qilsa,
          ortiqcha joy faqat tugma ustiga tushadi — tugmalar bir chiziqda qoladi. */}
      <p className="mt-3 text-lg font-bold text-gray-900">{priceText}</p>
      <div className="mt-auto pt-4">
        {isPaid && book.isPurchased ? (
          <PurchasedBadge onClick={() => onOwned(product)} />
        ) : isPaid ? (
          // Pullik kitob — shu sahifaning o'zida kirish va to'lov oqimi boshlanadi.
          <Button
            className="w-full"
            disabled={buying}
            onClick={(event) => {
              // Karta ham bosiladigan — xarid ikki marta boshlanmasligi uchun.
              event.stopPropagation();
              buy();
            }}
          >
            {buying ? 'Yuklanmoqda...' : 'Xarid qilish'}
          </Button>
        ) : (
          // Bepul kitob — ilovadagi kutubxonada o'qiladi: ilovani yuklashga yo'naltiruvchi oyna.
          <Button className="w-full" onClick={() => onFree(product)}>
            Bepul olish
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Jonli kitoblar bo'limi — admin paneldagi kitoblar katalogi (GET /api/v1/books).
 * API ishlamasa yoki ro'yxat bo'sh bo'lsa bo'lim ko'rsatilmaydi.
 */
export function Books({
  books,
  buyingKey,
  onBuy,
  onFree,
  onOwned,
}: {
  /** Kitoblar ro'yxati — `App` yuklaydi (Bonuslar bo'limi ham shundan foydalanadi). */
  books: ApiBook[];
  buyingKey: string | null;
  onBuy: (product: PurchaseProduct) => void;
  /** Bepul kitob bosilganda ("Bepul olish"). */
  onFree: (product: PurchaseProduct) => void;
  /** Sotib olingan kitob bosilganda. */
  onOwned: (product: PurchaseProduct) => void;
}) {
  const scrolledToHash = useRef(false);
  const hasBooks = books.length > 0;

  useEffect(() => {
    // Mobil ilova #books anchor'iga yo'naltiradi; bo'lim kech render bo'lgani uchun
    // hash mavjud bo'lsa ro'yxat kelgach qayta scroll qilamiz (faqat bir marta).
    if (!hasBooks || scrolledToHash.current || window.location.hash !== '#books') return;
    scrolledToHash.current = true;
    requestAnimationFrame(() => {
      document.getElementById('books')?.scrollIntoView({ behavior: 'smooth' });
    });
  }, [hasBooks]);

  if (books.length === 0) return null;

  return (
    <Section id="books" title="Kitoblar" className="bg-white">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {books.map((b) => (
          <BookCard
            key={b.id}
            book={b}
            buying={buyingKey === productKey({ type: 'book', id: b.id })}
            onBuy={onBuy}
            onFree={onFree}
            onOwned={onOwned}
          />
        ))}
      </div>
    </Section>
  );
}
