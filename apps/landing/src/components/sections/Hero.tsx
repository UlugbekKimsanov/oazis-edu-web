import type { LandingContent, Stat } from '../../data/landing';
import { Container } from '../ui/Container';
import { Button } from '../ui/Button';

export function Hero({
  hero,
  stats,
  onRequestInfo,
}: {
  hero: LandingContent['hero'];
  stats: Stat[];
  onRequestInfo: () => void;
}) {
  return (
    <section
      id="top"
      className="relative overflow-hidden bg-gradient-to-br from-primary to-primary-dark text-white"
    >
      <Container className="py-20 sm:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl md:text-5xl">
            {hero.title}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base text-white/85 sm:text-lg">
            {hero.subtitle}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button type="button" variant="white" onClick={onRequestInfo}>
              {hero.primaryBtn}
            </Button>
            <a href="#royxatdan-otish">
              <Button variant="outlineWhite">{hero.secondaryBtn}</Button>
            </a>
          </div>
        </div>

        <div className="mx-auto mt-14 grid max-w-3xl grid-cols-3 gap-4 sm:gap-8">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-2xl font-extrabold sm:text-4xl">{s.value}</div>
              <div className="mt-1 text-xs text-white/75 sm:text-sm">{s.label}</div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
