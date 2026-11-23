import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { landingContent, type LandingContent } from './data/landing';
import {
  fetchBooks,
  fetchCourses,
  fetchLandingContent,
  type ApiBook,
  type ApiCourse,
} from './lib/api';
import { clearPendingPurchase, loadPendingPurchase, savePendingPurchase } from './lib/appLinks';
import { AppDownloadDialog, type AppDownloadInfo } from './components/app/AppDownloadDialog';
import {
  SessionExpiredError,
  apiErrorMessage,
  clearSession,
  createCheckoutToken,
  enrollFreeCourse,
  loadSession,
  productKey,
  saveSession,
  type AuthUser,
  type PurchaseProduct,
} from './lib/auth';
import { AuthModal } from './components/auth/AuthModal';
import { CheckoutOverlay } from './components/checkout/CheckoutOverlay';
import { Navbar } from './components/sections/Navbar';
import { Hero } from './components/sections/Hero';
import { Features } from './components/sections/Features';
import { CourseInfo } from './components/sections/CourseInfo';
import { Goals } from './components/sections/Goals';
import { Testimonials } from './components/sections/Testimonials';
import { Courses } from './components/sections/Courses';
import { Books } from './components/sections/Books';
import { Bonuses, type GiftBookItem } from './components/sections/Bonuses';
import { SignupForm } from './components/sections/SignupForm';
import { Footer } from './components/sections/Footer';
import { LeadModal } from './components/forms/LeadModal';

function App() {
  // Statik kontent bilan boshlanadi — backend bo'lmasa ham sahifa to'liq ishlaydi.
  const [content, setContent] = useState<LandingContent>(landingContent);
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  // Checkout tokeni: mobil ilovadan (?t=...) yoki shu sahifadagi xariddan — faqat state'da.
  const [checkoutToken, setCheckoutToken] = useState<string | null>(
    () => new URLSearchParams(window.location.search).get('t'),
  );

  // Landing'dagi foydalanuvchi sessiyasi (mobil ilova bilan bir xil hisob).
  const [user, setUser] = useState<AuthUser | null>(loadSession);
  const [authOpen, setAuthOpen] = useState(false);
  // Kirishdan keyin davom ettiriladigan xarid.
  const [pendingProduct, setPendingProduct] = useState<PurchaseProduct | null>(null);
  const [buyingKey, setBuyingKey] = useState<string | null>(null);

  // "Darslarni ilovada davom ettiring" oynasi (to'lovdan keyin yoki bepul kurs boshlanganda).
  const [appDialog, setAppDialog] = useState<AppDownloadInfo | null>(null);
  // To'lov oynasi qaysi mahsulot uchun ochilgani — to'lovga ketishdan oldin eslab qolinadi.
  const checkoutProductRef = useRef<PurchaseProduct | null>(null);
  // Kitoblar bo'limini qayta yuklash (xarid tasdiqlangach "Sotib olingan" chiqishi uchun).
  const [booksRefreshKey, setBooksRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    fetchLandingContent().then((data) => {
      if (active) setContent(data);
    });
    return () => {
      active = false;
    };
  }, []);

  // Sotuvdagi kurslar (null — yuklanmoqda). Kirish/chiqishda qayta so'raladi:
  // "Sotib olingan" belgisi foydalanuvchiga bog'liq. Bosh sahifadagi "kurslar"
  // ko'rsatkichi ham shu ro'yxat uzunligidan olinadi.
  const [courses, setCourses] = useState<ApiCourse[] | null>(null);
  const authToken = user?.token ?? null;
  useEffect(() => {
    let active = true;
    fetchCourses(authToken).then((list) => {
      if (active) setCourses(list);
    });
    return () => {
      active = false;
    };
  }, [authToken]);

  // Kitoblar katalogi — "Kitoblar" va "Bonuslar" bo'limlari uchun. Kirish/chiqishda va
  // xarid tasdiqlangach (booksRefreshKey) qayta so'raladi.
  const [books, setBooks] = useState<ApiBook[]>([]);
  useEffect(() => {
    let active = true;
    fetchBooks(authToken).then((list) => {
      if (active) setBooks(list);
    });
    return () => {
      active = false;
    };
  }, [authToken, booksRefreshKey]);

  // Bonuslar: sotuvdagi kurslarga admin biriktirgan HAQIQIY sovg'a kitoblar.
  const giftItems = useMemo<GiftBookItem[]>(() => {
    const byBook = new Map<number, GiftBookItem>();
    for (const course of courses ?? []) {
      (course.giftBookIds ?? []).forEach((bookId, index) => {
        const book = books.find((b) => b.id === bookId);
        const existing = byBook.get(bookId);
        if (existing) {
          existing.courses.push(course.name);
          return;
        }
        byBook.set(bookId, {
          bookId,
          title: book?.title ?? course.giftBooks?.[index] ?? '',
          cover: book?.coverUrl,
          category: book?.category,
          courses: [course.name],
        });
      });
    }
    return [...byBook.values()].filter((g) => g.title);
  }, [courses, books]);

  // Token URL orqali referrer/analytics'ga sizib chiqmasligi uchun
  // u o'qilgan zahoti manzildan olib tashlanadi; overlay state orqali ochiq qoladi.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has('t')) {
      url.searchParams.delete('t');
      window.history.replaceState(null, '', url.toString());
    }
  }, []);

  const closeCheckout = useCallback(() => setCheckoutToken(null), []);

  // To'lov provayderiga ketishdan oldin xaridni eslab qolamiz — foydalanuvchi saytga
  // qaytganda to'lov tasdiqlangan bo'lsa, shu zahoti ilovaga yo'naltiruvchi oyna chiqadi.
  const rememberCheckout = useCallback(() => {
    const product = checkoutProductRef.current;
    if (product) savePendingPurchase(product);
  }, []);

  // To'lovdan qaytish: eslab qolingan xarid hisobga tushganini tekshiramiz. Birinchi
  // tekshiruv darhol; to'lov tasdig'i kechiksa, ~45 soniya davomida qayta so'raladi.
  // To'lov bekor qilingan bo'lsa hech narsa ko'rsatilmaydi.
  useEffect(() => {
    const pending = loadPendingPurchase();
    if (!pending || !authToken) return;
    let active = true;
    let attempt = 0;
    let timer: number | undefined;

    const check = async () => {
      attempt += 1;
      let done: boolean;
      let printBook = false;
      if (pending.type === 'course') {
        const list = await fetchCourses(authToken);
        if (!active) return;
        done = list.some((c) => c.id === pending.id && c.isEnrolled);
        if (done) setCourses(list);
      } else {
        const list = await fetchBooks(authToken);
        if (!active) return;
        const bought = list.find((b) => b.id === pending.id && b.isPurchased);
        done = Boolean(bought);
        printBook = bought?.category === 'print';
        if (done) setBooksRefreshKey((k) => k + 1);
      }
      if (done) {
        clearPendingPurchase();
        setAppDialog(
          pending.type === 'course'
            ? {
                tone: 'success',
                hasAccount: true,
                title: "To'lov qabul qilindi!",
                text: `«${pending.title}» kursi hisobingizda ochildi. Darslarni OAZIS ilovasida davom ettirishingiz mumkin.`,
              }
            : printBook
              ? {
                  tone: 'success',
                  hasAccount: true,
                  mode: 'delivery',
                  title: "To'lov qabul qilindi!",
                  text: `«${pending.title}» bosma kitobi uchun buyurtmangiz qabul qilindi. Tez orada operatorlarimiz ushbu kitobni kerakli manzilga yetkazib berish bo'yicha siz bilan aloqaga chiqishadi.`,
                }
              : {
                  tone: 'success',
                  hasAccount: true,
                  title: "To'lov qabul qilindi!",
                  text: `«${pending.title}» elektron kitobi hisobingizga qo'shildi. Uni OAZIS ilovasidagi kutubxonangizda o'qishingiz mumkin.`,
                },
        );
        return;
      }
      if (attempt < 15) timer = window.setTimeout(() => void check(), 3000);
    };
    void check();

    return () => {
      active = false;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [authToken]);

  /** Kirgan foydalanuvchi uchun checkout tokenini olib, to'lov oynasini ochadi. */
  const startCheckout = useCallback(async (product: PurchaseProduct, buyer: AuthUser) => {
    setBuyingKey(productKey(product));

    try {
      const token = await createCheckoutToken(buyer.token, product.type, product.id);
      checkoutProductRef.current = product;
      setCheckoutToken(token);
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        // Token eskirgan — qayta kirishni so'raymiz va xaridni davom ettiramiz.
        clearSession();
        setUser(null);
        setPendingProduct(product);
        setAuthOpen(true);
      } else {
        // Sabab ko'zga tashlanishi shart (masalan, kurs allaqachon olingan) — markazdagi oyna.
        setAppDialog({
          tone: 'warning',
          mode: 'message',
          hasAccount: true,
          title: 'Xarid davom etmadi',
          text: `«${product.title}»: ${apiErrorMessage(error, "xaridni boshlab bo'lmadi. Qayta urinib ko'ring.")}`,
        });
      }
    } finally {
      setBuyingKey(null);
    }
  }, []);

  const handleBuy = useCallback(
    (product: PurchaseProduct) => {
      if (buyingKey) return;
      if (!user) {
        setPendingProduct(product);
        setAuthOpen(true);
        return;
      }
      void startCheckout(product, user);
    },
    [buyingKey, user, startCheckout],
  );

  const handleAuthenticated = useCallback(
    (nextUser: AuthUser) => {
      saveSession(nextUser);
      setUser(nextUser);
      setAuthOpen(false);
      if (pendingProduct) {
        const product = pendingProduct;
        setPendingProduct(null);
        void startCheckout(product, nextUser);
      }
    },
    [pendingProduct, startCheckout],
  );

  const closeAuth = useCallback(() => {
    setAuthOpen(false);
    setPendingProduct(null);
  }, []);

  const handleLogout = useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  // Bepul kurs/kitob: to'lov yo'q — darslar ilovada o'tiladi, shuni tushuntirib,
  // qurilmaga mos do'konga yo'naltiramiz. Kirgan foydalanuvchi bepul kursga darhol
  // yoziladi (ilovada tayyor turishi uchun); xato bo'lsa ham oyna ko'rsatiladi.
  const handleFree = useCallback(
    (product: PurchaseProduct) => {
      const isCourse = product.type === 'course';
      if (user && isCourse) {
        enrollFreeCourse(user.token, product.id)
          .then(() => fetchCourses(user.token))
          .then(setCourses)
          .catch(() => undefined);
      }
      setAppDialog({
        tone: 'info',
        hasAccount: user !== null,
        title: isCourse ? 'Darslar mobil ilovada' : 'Kitob mobil ilovada',
        text: isCourse
          ? `«${product.title}» kursini mobil ilova orqali o'rganishingiz mumkin.`
          : `«${product.title}» elektron kitobini mobil ilova orqali o'qishingiz mumkin.`,
      });
    },
    [user],
  );

  // Sotib olingan mahsulot bosilganda: u qayerda ochilishini eslatamiz.
  const handleOwned = useCallback((product: PurchaseProduct) => {
    setAppDialog({
      tone: 'success',
      hasAccount: true,
      mode: product.print ? 'delivery' : 'app',
      title: product.print ? 'Buyurtma qabul qilingan' : 'Bu sizda bor',
      text:
        product.type === 'course'
          ? `«${product.title}» kursi hisobingizda ochiq. Darslarni OAZIS ilovasida davom ettirishingiz mumkin.`
          : product.print
            ? `«${product.title}» bosma kitobi uchun to'lovingiz qabul qilingan — operatorlarimiz ushbu kitobni kerakli manzilga yetkazib berish bo'yicha siz bilan aloqaga chiqishadi.`
            : `«${product.title}» elektron kitobi hisobingizda bor. Uni OAZIS ilovasidagi kutubxonangizda o'qishingiz mumkin.`,
    });
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <Navbar
        navbar={content.navbar}
        user={user}
        onLogin={() => setAuthOpen(true)}
        onLogout={handleLogout}
      />
      <main>
        <Hero
          hero={content.hero}
          stats={content.stats}
          coursesOnSale={courses && courses.length > 0 ? courses.length : null}
          loggedIn={user !== null}
          onRequestInfo={() => setLeadModalOpen(true)}
          onLogin={() => setAuthOpen(true)}
        />
        <Features title={content.featuresTitle} features={content.features} />
        <CourseInfo title={content.courseInfoTitle} items={content.courseInfo} />
        <Goals title={content.goalsTitle} goals={content.goals} />
        <Testimonials title={content.testimonialsTitle} testimonials={content.testimonials} />
        <Courses
          title={content.coursesTitle}
          cardText={content.courseCard}
          courses={courses}
          buyingKey={buyingKey}
          onBuy={handleBuy}
          onFree={handleFree}
          onOwned={handleOwned}
        />
        <Bonuses title={content.bonusTitle} text={content.bonusText} gifts={giftItems} />
        <Books
          books={books}
          buyingKey={buyingKey}
          onBuy={handleBuy}
          onFree={handleFree}
          onOwned={handleOwned}
        />
        {/* Ariza formasi faqat hali kirmagan mehmon uchun. */}
        {!user && <SignupForm cta={content.cta} formCopy={content.leadForm} />}
      </main>
      <Footer logo={content.navbar.logo} footer={content.footer} contacts={content.contacts} />
      <LeadModal
        open={leadModalOpen}
        onClose={() => setLeadModalOpen(false)}
        modal={content.leadModal}
        cta={content.cta}
        formCopy={content.leadForm}
      />
      <AuthModal
        open={authOpen}
        reason={
          pendingProduct
            ? `«${pendingProduct.title}»ni xarid qilish uchun hisobingizga kiring yoki ro'yxatdan o'ting.`
            : undefined
        }
        onClose={closeAuth}
        onAuthenticated={handleAuthenticated}
      />
      {checkoutToken && (
        <CheckoutOverlay
          token={checkoutToken}
          onClose={closeCheckout}
          onBeforeRedirect={rememberCheckout}
        />
      )}
      {appDialog && <AppDownloadDialog info={appDialog} onClose={() => setAppDialog(null)} />}
    </div>
  );
}

export default App;
