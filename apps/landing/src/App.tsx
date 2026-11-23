import { useCallback, useEffect, useState } from 'react';
import { landingContent, type LandingContent } from './data/landing';
import { fetchLandingContent } from './lib/api';
import {
  SessionExpiredError,
  apiErrorMessage,
  clearSession,
  createCheckoutToken,
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
import { Bonuses } from './components/sections/Bonuses';
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
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchLandingContent().then((data) => {
      if (active) setContent(data);
    });
    return () => {
      active = false;
    };
  }, []);

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

  /** Kirgan foydalanuvchi uchun checkout tokenini olib, to'lov oynasini ochadi. */
  const startCheckout = useCallback(async (product: PurchaseProduct, buyer: AuthUser) => {
    setBuyingKey(productKey(product));
    setNotice(null);
    try {
      setCheckoutToken(await createCheckoutToken(buyer.token, product.type, product.id));
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        // Token eskirgan — qayta kirishni so'raymiz va xaridni davom ettiramiz.
        clearSession();
        setUser(null);
        setPendingProduct(product);
        setAuthOpen(true);
      } else {
        setNotice(
          `«${product.title}»: ${apiErrorMessage(error, "xaridni boshlab bo'lmadi. Qayta urinib ko'ring.")}`,
        );
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
          onRequestInfo={() => setLeadModalOpen(true)}
        />
        <Features title={content.featuresTitle} features={content.features} />
        <CourseInfo title={content.courseInfoTitle} items={content.courseInfo} />
        <Goals title={content.goalsTitle} goals={content.goals} />
        <Testimonials title={content.testimonialsTitle} testimonials={content.testimonials} />
        <Courses
          title={content.coursesTitle}
          courses={content.courses}
          cardText={content.courseCard}
          buyingKey={buyingKey}
          onBuy={handleBuy}
        />
        <Bonuses title={content.bonusTitle} text={content.bonusText} books={content.bonusBooks} />
        <Books buyingKey={buyingKey} onBuy={handleBuy} />
        <SignupForm cta={content.cta} formCopy={content.leadForm} />
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
        <CheckoutOverlay token={checkoutToken} onClose={closeCheckout} />
      )}
      {notice && (
        // Xarid davom etmagan sababi ko'zga tashlanishi shart (masalan, kurs allaqachon
        // olingan) — shuning uchun burchakdagi toast emas, markazdagi oyna.
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-gray-950/60 p-4 backdrop-blur-sm"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="purchase-notice-title"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setNotice(null);
          }}
        >
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl sm:p-8">
            <h2 id="purchase-notice-title" className="text-xl font-bold text-gray-900">
              Xarid davom etmadi
            </h2>
            <p className="mt-3 text-sm leading-6 text-gray-600">{notice}</p>
            <button
              type="button"
              autoFocus
              className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
              onClick={() => setNotice(null)}
            >
              Tushunarli
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
