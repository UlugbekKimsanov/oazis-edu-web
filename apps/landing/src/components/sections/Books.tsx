import { useEffect, useRef, useState } from 'react';
import { BookOpen, Star } from 'lucide-react';
import { Section } from '../ui/Section';
import { Button } from '../ui/Button';
import { PurchasedBadge } from '../ui/PurchasedBadge';
import { fetchBooks, fileUrl, type ApiBook } from '../../lib/api';
import { productKey, type PurchaseProduct } from '../../lib/auth';

function categoryLabel(category?: string): string {
  if (category === 'print') return 'Bosma';
  if (category === 'digital') return 'Elektron';
  return 'Kitob';
}

function BookCard({
  book,
  buying,
  loggedIn,
  onBuy,
  onFreeInfo,
}: {
  book: ApiBook;
  buying: boolean;
  loggedIn: boolean;
  onBuy: (product: PurchaseProduct) => void;
  onFreeInfo: (title: string) => void;
}) {
  const cover = fileUrl(book.coverUrl);
  // Backend bilan bir xil qoida: bepul yoki narxsiz kitob uchun to'lov yo'q.
  const isPaid = !book.isFree && Boolean(book.price && book.price > 0);
  const priceText = book.isFree
    ? 'Bepul'
    : book.priceLabel ||
      (book.price ? `${book.price.toLocaleString('ru-RU')} so'm` : '');
  return (
    <div className="flex h-full min-w-0 flex-col rounded-2xl border-2 border-gray-100 bg-white p-3 shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-primary hover:shadow-md sm:p-4">
      {cover ? (
        <img
          src={cover}
          alt={book.title}
          loading="lazy"
          decoding="async"
          className="mb-3 aspect-[3/4] w-full rounded-xl object-cover"
        />
      ) : (
        <div className="mb-3 flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-br from-primary to-primary-dark p-3 text-center text-white">
          {book.emoji && <span className="text-3xl leading-none">{book.emoji}</span>}
          <BookOpen className="h-6 w-6" />
        </div>
      )}
      <span className="mb-2 inline-block w-fit rounded-full bg-primary-light px-3 py-1 text-xs font-semibold text-primary">
        {categoryLabel(book.category)}
      </span>
      {/* Sarlavha doim 2 qator joy egallaydi (uzun/bo'shliqsiz nomlar kartadan chiqib
          ketmasligi va kartalar bir tekis turishi uchun); to'liq nom title'da. */}
      <h3
        className="line-clamp-2 min-h-[2.75em] text-sm font-bold leading-snug text-gray-900 [overflow-wrap:anywhere]"
        title={book.title}
      >
        {book.title}
      </h3>
      <p className="mt-1 min-h-4 truncate text-xs text-gray-500">{book.author || ''}</p>
      <div className="mt-2 flex min-h-4 items-center gap-1 text-xs text-gray-500">
        {Boolean(book.rating) && (
          <>
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            {(book.rating as number).toFixed(1)}
          </>
        )}
      </div>
      <div className="mt-auto pt-3">
        <span className="text-sm font-bold text-gray-900 sm:text-base">{priceText}</span>
      </div>
      {isPaid && book.isPurchased ? (
        <PurchasedBadge className="mt-3" />
      ) : isPaid ? (
        // Pullik kitob — shu sahifaning o'zida kirish va to'lov oqimi boshlanadi.
        <Button
          className="mt-3 w-full px-3 sm:px-6"
          disabled={buying}
          onClick={() => onBuy({ type: 'book', id: book.id, title: book.title })}
        >
          {buying ? 'Yuklanmoqda...' : 'Xarid qilish'}
        </Button>
      ) : loggedIn ? (
        // Kirgan foydalanuvchiga ariza formasi ko'rsatilmaydi — ilovada ochilishini aytamiz.
        <Button className="mt-3 w-full px-3 sm:px-6" onClick={() => onFreeInfo(book.title)}>
          Bepul olish
        </Button>
      ) : (
        <a href="#royxatdan-otish" className="mt-3">
          <Button className="w-full px-3 sm:px-6">Bepul olish</Button>
        </a>
      )}
    </div>
  );
}

/**
 * Jonli kitoblar bo'limi — admin paneldagi kitoblar katalogi (GET /api/v1/books).
 * API ishlamasa yoki ro'yxat bo'sh bo'lsa bo'lim ko'rsatilmaydi.
 */
export function Books({
  authToken,
  buyingKey,
  onBuy,
  onFreeInfo,
}: {
  /** Kirgan foydalanuvchi tokeni — sotib olingan kitoblarni belgilash uchun. */
  authToken: string | null;
  buyingKey: string | null;
  onBuy: (product: PurchaseProduct) => void;
  /** Kirgan foydalanuvchi bepul kitobni bosganda. */
  onFreeInfo: (title: string) => void;
}) {
  const [books, setBooks] = useState<ApiBook[]>([]);
  const scrolledToHash = useRef(false);

  useEffect(() => {
    let active = true;
    fetchBooks(authToken).then((list) => {
      if (!active) return;
      setBooks(list);
      // Mobil ilova #books anchor'iga yo'naltiradi; bo'lim kech render
      // bo'lgani uchun hash mavjud bo'lsa yuklangach qayta scroll qilamiz
      // (faqat birinchi yuklanishda — kirish/chiqishdagi qayta so'rovda emas).
      if (!scrolledToHash.current && list.length > 0 && window.location.hash === '#books') {
        scrolledToHash.current = true;
        requestAnimationFrame(() => {
          document.getElementById('books')?.scrollIntoView({ behavior: 'smooth' });
        });
      }
    });
    return () => {
      active = false;
    };
  }, [authToken]);

  if (books.length === 0) return null;

  return (
    <Section id="books" title="Kitoblar" className="bg-white">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
        {books.map((b) => (
          <BookCard
            key={b.id}
            book={b}
            buying={buyingKey === productKey({ type: 'book', id: b.id })}
            loggedIn={authToken !== null}
            onBuy={onBuy}
            onFreeInfo={onFreeInfo}
          />
        ))}
      </div>
    </Section>
  );
}
