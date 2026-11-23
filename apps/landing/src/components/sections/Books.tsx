import { useEffect, useState } from 'react';
import { BookOpen, Star } from 'lucide-react';
import { Section } from '../ui/Section';
import { Button } from '../ui/Button';
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
  onBuy,
}: {
  book: ApiBook;
  buying: boolean;
  onBuy: (product: PurchaseProduct) => void;
}) {
  const cover = fileUrl(book.coverUrl);
  // Backend bilan bir xil qoida: bepul yoki narxsiz kitob uchun to'lov yo'q.
  const isPaid = !book.isFree && Boolean(book.price && book.price > 0);
  const priceText = book.isFree
    ? 'Bepul'
    : book.priceLabel ||
      (book.price ? `${book.price.toLocaleString('ru-RU')} so'm` : '');
  return (
    <div className="flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      {cover ? (
        <img
          src={cover}
          alt={book.title}
          loading="lazy"
          decoding="async"
          className="mb-3 aspect-[3/4] w-full rounded-xl object-cover"
        />
      ) : (
        <div className="mb-3 flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-primary-dark p-3 text-center text-white">
          <span className="text-3xl">{book.emoji || ''}</span>
          <BookOpen className="h-6 w-6" />
        </div>
      )}
      <span className="mb-2 inline-block w-fit rounded-full bg-primary-light px-3 py-1 text-xs font-semibold text-primary">
        {categoryLabel(book.category)}
      </span>
      <h3 className="text-sm font-bold leading-snug text-gray-900">{book.title}</h3>
      {book.author && <p className="mt-1 text-xs text-gray-500">{book.author}</p>}
      {Boolean(book.rating) && (
        <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
          {(book.rating as number).toFixed(1)}
        </div>
      )}
      <div className="mt-auto pt-3">
        <span className="text-base font-bold text-gray-900">{priceText}</span>
      </div>
      {isPaid ? (
        // Pullik kitob — shu sahifaning o'zida kirish va to'lov oqimi boshlanadi.
        <Button
          className="mt-3 w-full"
          disabled={buying}
          onClick={() => onBuy({ type: 'book', id: book.id, title: book.title })}
        >
          {buying ? 'Yuklanmoqda...' : 'Xarid qilish'}
        </Button>
      ) : (
        <a href="#royxatdan-otish" className="mt-3">
          <Button className="w-full">Bepul olish</Button>
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
  buyingKey,
  onBuy,
}: {
  buyingKey: string | null;
  onBuy: (product: PurchaseProduct) => void;
}) {
  const [books, setBooks] = useState<ApiBook[]>([]);

  useEffect(() => {
    let active = true;
    fetchBooks().then((list) => {
      if (!active) return;
      setBooks(list);
      // Mobil ilova #books anchor'iga yo'naltiradi; bo'lim kech render
      // bo'lgani uchun hash mavjud bo'lsa yuklangach qayta scroll qilamiz.
      if (list.length > 0 && window.location.hash === '#books') {
        requestAnimationFrame(() => {
          document.getElementById('books')?.scrollIntoView({ behavior: 'smooth' });
        });
      }
    });
    return () => {
      active = false;
    };
  }, []);

  if (books.length === 0) return null;

  return (
    <Section id="books" title="Kitoblar" className="bg-white">
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
        {books.map((b) => (
          <BookCard
            key={b.id}
            book={b}
            buying={buyingKey === productKey({ type: 'book', id: b.id })}
            onBuy={onBuy}
          />
        ))}
      </div>
    </Section>
  );
}
