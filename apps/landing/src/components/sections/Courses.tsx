import type { Course } from '../../data/landing';
import { Section } from '../ui/Section';
import { CourseCard } from '../ui/CourseCard';

export function Courses({ courses }: { courses: Course[] }) {
  return (
    <Section id="kurslar" title="Kurslar" className="bg-white">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {courses.map((c) => (
          <CourseCard key={c.id} course={c} />
        ))}
      </div>
    </Section>
  );
}
