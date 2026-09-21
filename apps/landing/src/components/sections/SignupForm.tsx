import type { LandingContent } from '../../data/landing';
import { Container } from '../ui/Container';
import { LeadForm } from '../forms/LeadForm';

export function SignupForm({
  cta,
  formCopy,
}: {
  cta: LandingContent['cta'];
  formCopy: LandingContent['leadForm'];
}) {
  return (
    <section id="royxatdan-otish" className="bg-gradient-to-br from-primary to-primary-dark py-16 sm:py-20">
      <Container>
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="text-white">
            <h2 className="text-2xl font-bold leading-snug sm:text-3xl md:text-4xl">
              {cta.description}
            </h2>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-lg sm:p-8">
            <h3 className="mb-5 text-xl font-bold text-gray-900">{cta.title}</h3>
            <LeadForm
              nameLabel={cta.nameLabel}
              phoneLabel={cta.phoneLabel}
              submitLabel={cta.submitLabel}
              copy={formCopy}
            />
          </div>
        </div>
      </Container>
    </section>
  );
}
