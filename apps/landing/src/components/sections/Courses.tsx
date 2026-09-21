import type { Course, LandingContent } from '../../data/landing';
import { Section } from '../ui/Section';
import { CourseCard } from '../ui/CourseCard';

export function Courses({
  title,
  courses,
  cardText,
}: {
  title: string;
  courses: Course[];
  cardText: LandingContent['courseCard'];
}) {
  return (
    <Section id="courses" title={title} className="bg-white">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {courses.map((c) => (
          <CourseCard key={c.id} course={c} text={cardText} />
        ))}
      </div>
    </Section>
  );
}
