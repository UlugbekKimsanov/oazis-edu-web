import { useEffect, useState } from 'react';
import { BookOpen, Clock } from 'lucide-react';
import type { Course, LandingContent } from '../../data/landing';
import { Section } from '../ui/Section';
import { CourseCard } from '../ui/CourseCard';
import { Button } from '../ui/Button';
import { fetchCourses, fileUrl, type ApiCourse } from '../../lib/api';

/** Jonli (admin paneldan boshqariladigan) kurs kartasi. */
function ApiCourseCard({
  course,
  text,
}: {
  course: ApiCourse;
  text: LandingContent['courseCard'];
}) {
  const cover = fileUrl(course.imageUrl || course.backgroundUrl);
  const priceText = course.isPremium
    ? course.priceLabel ||
      (course.price ? `${course.price.toLocaleString('ru-RU')} so'm` : '')
    : 'Bepul';
  return (
    <div className="flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      {cover ? (
        <img
          src={cover}
          alt={course.name}
          className="mb-4 h-28 w-full rounded-xl object-cover"
        />
      ) : (
        <div className="mb-4 flex h-28 items-center justify-center rounded-xl bg-primary-light text-5xl">
          <span>{course.flagEmoji || '🎓'}</span>
        </div>
      )}
      <span className="mb-2 inline-block w-fit rounded-full bg-primary-light px-3 py-1 text-xs font-semibold text-primary">
        {text.categoryLabel}
      </span>
      <h3 className="text-base font-bold text-gray-900">{course.name}</h3>
      <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
        {Boolean(course.lessonCount) && (
          <span className="inline-flex items-center gap-1">
            <BookOpen className="h-3.5 w-3.5" /> {course.lessonCount} dars
          </span>
        )}
        {Boolean(course.hours) && (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> {course.hours} soat
          </span>
        )}
      </div>
      <div className="mt-auto pt-4">
        <span className="text-lg font-bold text-gray-900">{priceText}</span>
      </div>
      <a href="#royxatdan-otish" className="mt-4">
        <Button className="w-full">{text.buyLabel}</Button>
      </a>
    </div>
  );
}

export function Courses({
  title,
  courses,
  cardText,
}: {
  title: string;
  courses: Course[];
  cardText: LandingContent['courseCard'];
}) {
  // Jonli katalog: admin paneldagi kurslar. Yuklanmasa statik kontent fallback.
  const [apiCourses, setApiCourses] = useState<ApiCourse[]>([]);
  useEffect(() => {
    let active = true;
    fetchCourses().then((list) => {
      if (active) setApiCourses(list);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <Section id="courses" title={title} className="bg-white">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {apiCourses.length > 0
          ? apiCourses.map((c) => <ApiCourseCard key={c.id} course={c} text={cardText} />)
          : courses.map((c) => <CourseCard key={c.id} course={c} text={cardText} />)}
      </div>
    </Section>
  );
}
