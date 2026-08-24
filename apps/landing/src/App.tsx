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
      <Navbar />
      <main>
        <Hero stats={content.stats} onRequestInfo={() => setLeadModalOpen(true)} />
        <Features features={content.features} />
        <CourseInfo items={content.courseInfo} />
        <Goals goals={content.goals} />
        <Testimonials testimonials={content.testimonials} />
        <Courses courses={content.courses} />
        <Bonuses books={content.bonusBooks} />
        <SignupForm />
      </main>
      <Footer contacts={content.contacts} />
      <LeadModal open={leadModalOpen} onClose={() => setLeadModalOpen(false)} />
    </div>
  );
}

export default App;
