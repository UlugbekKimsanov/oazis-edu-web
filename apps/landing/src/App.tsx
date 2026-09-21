import { useEffect, useState } from 'react';
import { landingContent, type LandingContent } from './data/landing';
import { fetchLandingContent } from './lib/api';
import { Navbar } from './components/sections/Navbar';
import { Hero } from './components/sections/Hero';
import { Features } from './components/sections/Features';
import { CourseInfo } from './components/sections/CourseInfo';
import { Goals } from './components/sections/Goals';
import { Testimonials } from './components/sections/Testimonials';
import { Courses } from './components/sections/Courses';
import { Bonuses } from './components/sections/Bonuses';
import { SignupForm } from './components/sections/SignupForm';
import { Footer } from './components/sections/Footer';
import { LeadModal } from './components/forms/LeadModal';

function App() {
  // Statik kontent bilan boshlanadi — backend bo'lmasa ham sahifa to'liq ishlaydi.
  const [content, setContent] = useState<LandingContent>(landingContent);
  const [leadModalOpen, setLeadModalOpen] = useState(false);

  useEffect(() => {
    let active = true;
    fetchLandingContent().then((data) => {
      if (active) setContent(data);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <Navbar navbar={content.navbar} />
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
        <Courses title={content.coursesTitle} courses={content.courses} cardText={content.courseCard} />
        <Bonuses title={content.bonusTitle} text={content.bonusText} books={content.bonusBooks} />
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
    </div>
  );
}

export default App;
