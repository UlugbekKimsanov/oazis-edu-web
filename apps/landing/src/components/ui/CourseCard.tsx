import { Star, Users } from 'lucide-react';
import type { Course, LandingContent } from '../../data/landing';
import { Button } from './Button';

export function CourseCard({
  course,
  text,
}: {
  course: Course;
  text: LandingContent['courseCard'];
}) {
  const isExternal = Boolean(course.buyUrl);
  const href = course.buyUrl || '#royxatdan-otish';
  return (
    <div className="flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-4 flex h-28 items-center justify-center rounded-xl bg-primary-light text-5xl">
        <span>{course.flag}</span>
      </div>
      <span className="mb-2 inline-block w-fit rounded-full bg-primary-light px-3 py-1 text-xs font-semibold text-primary">
        {text.categoryLabel}
      </span>
      <h3 className="text-base font-bold text-gray-900">{course.name}</h3>
      <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1">
          <Users className="h-3.5 w-3.5" /> {course.students} {text.studentsLabel}
        </span>
        <span className="inline-flex items-center gap-1">
          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {course.rating.toFixed(1)}
        </span>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-lg font-bold text-gray-900">{course.price}</span>
      </div>
      <a
        href={href}
        {...(isExternal ? { target: '_blank', rel: 'noreferrer' } : {})}
        className="mt-4"
      >
        <Button className="w-full">{text.buyLabel}</Button>
      </a>
    </div>
  );
}
