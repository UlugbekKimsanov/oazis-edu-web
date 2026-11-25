import type { LandingContent, Stat } from "../../data/landing";
import { Container } from "../ui/Container";
import { Button } from "../ui/Button";
import { CountUp } from "../ui/CountUp";
import { PhoneMockup } from "../ui/PhoneMockup";

export function Hero({
  hero,
  stats,
  coursesOnSale,
  loggedIn,
  onRequestInfo,
  onLogin,
}: {
  hero: LandingContent["hero"];
  stats: Stat[];
  /** Saytda sotuvdagi kurslar soni; null — hali noma'lum (kontentdagi qiymat ko'rsatiladi). */
  coursesOnSale: number | null;
  loggedIn: boolean;
  onRequestInfo: () => void;
  /** "Kirish" tugmasi — kirish/ro'yxatdan o'tish oynasini ochadi. */
  onLogin: () => void;
}) {
  return (
    <section
      id="top"
      className="relative overflow-hidden bg-gradient-to-br from-primary to-primary-dark text-white"
    >
      <Container className="py-16 sm:py-20 lg:py-24">
        {/* Keng ekranda: chapda matn, o'ngda jonli ilova maketi; telefonda maket matn ostida. */}
        <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-10">
          <div className="mx-auto max-w-3xl text-center lg:mx-0 lg:text-left">
            <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl md:text-5xl">
              {hero.title}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base text-white/85 sm:text-lg lg:mx-0">
              {hero.subtitle}
            </p>
            {/* Kirgan foydalanuvchiga "Ma'lumot olish" va "Kirish" kerak emas —
              u allaqachon hisobida, shuning uchun tugmalar ko'rsatilmaydi. */}
            {!loggedIn && (
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
                <Button type="button" variant="white" onClick={onRequestInfo} attention>
                  {hero.primaryBtn}
                </Button>
                <Button type="button" variant="outlineWhite" onClick={onLogin} attention>
                  {hero.secondaryBtn}
                </Button>
              </div>
            )}

            <div className="mx-auto mt-12 grid max-w-xl grid-cols-3 gap-4 sm:gap-8 lg:mx-0">
              {stats.map((s) => (
                <div key={s.label} className="text-center lg:text-left">
                  <div className="text-2xl font-extrabold sm:text-4xl">
                    {/* "kurslar" ko'rsatkichi qo'lda yozilmaydi — saytda sotuvdagi kurslar soni. */}
                    <CountUp
                      value={
                        coursesOnSale !== null && /kurs/i.test(s.label)
                          ? coursesOnSale
                          : s.value
                      }
                    />
                  </div>
                  <div className="mt-1 text-xs text-white/75 sm:text-sm">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <PhoneMockup />
        </div>
      </Container>
    </section>
  );
}
