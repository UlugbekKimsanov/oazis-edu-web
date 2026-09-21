export const LANDING_ICON_NAMES = [
  'GraduationCap',
  'ClipboardCheck',
  'MessageCircleQuestion',
  'Clock',
  'Video',
  'Sparkles',
  'Bot',
  'Award',
  'MessagesSquare',
  'Brain',
  'Timer',
  'BookOpen',
  'Star',
  'Users',
  'Globe',
  'Headphones',
  'Zap',
  'TrendingUp',
  'CheckCircle2',
  'Activity',
  'Library',
  'MessageSquare',
  'PlayCircle',
  'Dumbbell',
  'Music',
  'Bell',
  'CreditCard',
  'Settings',
  'ClipboardList',
  'FileQuestion',
  'UserCheck',
  'Camera',
  'Send',
] as const;

export type LandingIconName = (typeof LANDING_ICON_NAMES)[number];

export const LANDING_SCHEMA_VERSION = 2;

export interface NavLink {
  label: string;
  href: string;
}

export interface Stat {
  value: string;
  label: string;
}

export interface Feature {
  icon: string;
  text: string;
}

export interface CourseInfoItem {
  icon: string;
  text: string;
}

export interface Goal {
  icon: string;
  title: string;
  image?: string;
}

export interface Testimonial {
  id: number;
  name: string;
  course: string;
  videoUrl?: string;
  image?: string;
}

export interface Course {
  id: string;
  flag: string;
  name: string;
  students: number;
  price: string;
  rating: number;
  buyUrl?: string;
}

export interface BonusBook {
  id: number;
  title: string;
  cover?: string;
}

export interface Contacts {
  phone: string;
  telegram: string;
  instagram: string;
  youtube: string;
}

export interface LandingContent {
  schemaVersion: number;
  navbar: { logo: string; links: NavLink[]; ctaLabel: string; menuLabel: string };
  hero: { title: string; subtitle: string; primaryBtn: string; secondaryBtn: string };
  stats: Stat[];
  featuresTitle: string;
  features: Feature[];
  courseInfoTitle: string;
  courseInfo: CourseInfoItem[];
  goalsTitle: string;
  goals: Goal[];
  testimonialsTitle: string;
  testimonials: Testimonial[];
  coursesTitle: string;
  courses: Course[];
  courseCard: { categoryLabel: string; studentsLabel: string; buyLabel: string };
  bonusTitle: string;
  bonusText: string;
  bonusBooks: BonusBook[];
  cta: {
    title: string;
    description: string;
    nameLabel: string;
    phoneLabel: string;
    submitLabel: string;
  };
  leadForm: {
    optionalLabel: string;
    namePlaceholder: string;
    phonePlaceholder: string;
    loadingLabel: string;
    invalidPhoneMessage: string;
    successMessage: string;
    errorMessage: string;
  };
  leadModal: { title: string; description: string; closeLabel: string };
  footer: { company: string; socialTitle: string; contactTitle: string };
  contacts: Contacts;
}

export const DEFAULT_LANDING_CONTENT: LandingContent = {
  schemaVersion: LANDING_SCHEMA_VERSION,
  navbar: {
    logo: 'OAZIS',
    links: [
      { label: 'Kurslar', href: '#courses' },
      { label: 'Biz haqimizda', href: '#about' },
      { label: 'Fikrlar', href: '#testimonials' },
    ],
    ctaLabel: "Ro'yxatdan o'tish",
    menuLabel: 'Menyu',
  },
  hero: {
    title: "BILIMGA BIR MARTA TO'LAYMIZ, BILIMSIZLIKKA ESA BIR UMR!",
    subtitle:
      "Oazis Chet tillarini atiga 4 oy ichida interaktiv va online usulda tez va oson o'rganing va maqsadingizga erishing!",
    primaryBtn: "Ma'lumot olish",
    secondaryBtn: 'Kirish',
  },
  stats: [
    { value: '1000+', label: "o'quvchilar" },
    { value: '7', label: 'kurslar' },
    { value: '280+', label: 'videodarslar' },
  ],
  featuresTitle: 'Nima uchun OAZIS platformasi?',
  features: [
    { icon: 'GraduationCap', text: "Malakali ustozlar tomonidan to'liq video darsliklar" },
    { icon: 'ClipboardCheck', text: 'Doimiy nazorat va davomat' },
    { icon: 'MessageCircleQuestion', text: "Mavzuga doir barcha savollarga aniq javoblar" },
    { icon: 'Clock', text: "Istalgan paytda va istalgan joyda o'rganish" },
  ],
  courseInfoTitle: 'Kurslar haqida qisqacha',
  courseInfo: [
    { icon: 'Video', text: "Video va Audio darsliklar orqali chet tillarini o'rgatamiz" },
    { icon: 'Sparkles', text: "Interaktiv va Meta ta'lim metodikalari orqali tushuntirilgan" },
    { icon: 'Bot', text: "AI ustozdan istalgan vaqtda mavzuga doir savollarga javob bor" },
    { icon: 'Award', text: "Kursni muvaffaqiyatli yakunlaganingizdan so'ng maxsus Sertifikat" },
  ],
  goalsTitle: 'Bizning maqsadimiz',
  goals: [
    { icon: 'MessagesSquare', title: "Atiga 4 oy ichida chet tillarida erkin muloqot darajasi" },
    { icon: 'Brain', title: "Aqliy zo'riqishlarga qarshi uslubda oson ta'lim berish" },
    { icon: 'Timer', title: 'Vaqtingizni maksimal darajada tejab berish' },
  ],
  testimonialsTitle: "O'quvchilarimiz fikrlari",
  testimonials: [
    { id: 1, name: "O'quvchi fikri", course: 'Ingliz tili' },
    { id: 2, name: "O'quvchi fikri", course: 'Rus tili' },
    { id: 3, name: "O'quvchi fikri", course: 'Koreys tili' },
    { id: 4, name: "O'quvchi fikri", course: 'Turk tili' },
    { id: 5, name: "O'quvchi fikri", course: 'Arab tili' },
  ],
  coursesTitle: 'Kurslar',
  courses: [
    { id: 'en', flag: '🇬🇧', name: 'Ingliz tili kursi', students: 136, price: "799 000 so'm", rating: 5 },
    { id: 'ru', flag: '🇷🇺', name: 'Rus tili kursi', students: 109, price: "799 000 so'm", rating: 5 },
    { id: 'ko', flag: '🇰🇷', name: 'Koreys tili kursi', students: 100, price: "799 000 so'm", rating: 5 },
    { id: 'tr', flag: '🇹🇷', name: 'Turk tili kursi', students: 88, price: "799 000 so'm", rating: 5 },
    { id: 'ar', flag: '🇸🇦', name: 'Arab tili kursi', students: 72, price: "799 000 so'm", rating: 5 },
    { id: 'de', flag: '🇩🇪', name: 'Nemis tili kursi', students: 50, price: "799 000 so'm", rating: 5 },
    { id: 'zh', flag: '🇨🇳', name: 'Xitoy tili kursi', students: 33, price: "799 000 so'm", rating: 5 },
  ],
  courseCard: {
    categoryLabel: 'Til kurslari',
    studentsLabel: "o'quvchi",
    buyLabel: 'Harid qilish',
  },
  bonusTitle: 'Bonuslar',
  bonusText:
    "Harid qilgan Til kursingizning maxsus interaktiv kitoblarini bepul bonus sifatida sovg'a qilamiz!",
  bonusBooks: [
    { id: 1, title: 'Ingliz tili kitobi' },
    { id: 2, title: 'Rus tili kitobi' },
    { id: 3, title: 'Koreys tili kitobi' },
    { id: 4, title: 'Turk tili kitobi' },
    { id: 5, title: 'Arab tili kitobi' },
    { id: 6, title: 'Nemis tili kitobi' },
    { id: 7, title: 'Xitoy tili kitobi' },
    { id: 8, title: 'Grammatika kitobi' },
  ],
  cta: {
    title: "Kursga qo'shilish",
    description:
      "Hoziroq ro'yxatdan o'tib tanlagan kursingizga a'zo bo'ling va maqsadingizga erishing!",
    nameLabel: 'Ism',
    phoneLabel: 'Telefon raqam',
    submitLabel: 'Tasdiqlash',
  },
  leadForm: {
    optionalLabel: 'ixtiyoriy',
    namePlaceholder: 'Ismingiz',
    phonePlaceholder: '+998 XX XXX XX XX',
    loadingLabel: 'Yuborilmoqda...',
    invalidPhoneMessage: "Telefon raqamini to'liq kiriting.",
    successMessage: "Arizangiz qabul qilindi! Tez orada siz bilan bog'lanamiz.",
    errorMessage: "Xatolik yuz berdi. Iltimos, keyinroq qayta urinib ko'ring.",
  },
  leadModal: {
    title: "Siz bilan bog'lanamiz",
    description:
      "Telefon raqamingizni qoldiring. Mutaxassisimiz sizga kurslar haqida batafsil ma'lumot beradi.",
    closeLabel: 'Yopish',
  },
  footer: {
    company: 'Oazis Company',
    socialTitle: 'Bizning ijtimoiy sahifalar',
    contactTitle: 'Yagona aloqa markazi',
  },
  contacts: {
    phone: '+998 71 200 53 53',
    telegram: 'https://t.me/oazisedu',
    instagram: 'https://instagram.com/oazisedu',
    youtube: 'https://youtube.com/@oazisedu',
  },
};

type UnknownRecord = Record<string, unknown>;

const recordOf = (value: unknown): UnknownRecord =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};

const stringOf = (value: unknown, fallback: string): string =>
  typeof value === 'string' ? value : fallback;

const nonEmptyStringOf = (value: unknown, fallback: string): string =>
  typeof value === 'string' && value.trim() ? value : fallback;

const safeNavigationOf = (value: unknown, fallback: string): string => {
  const candidate = stringOf(value, fallback).trim();
  return /^(?:#[^\s]*|\/(?!\/)[^\s]*|https?:\/\/[^\s]+)$/i.test(candidate)
    ? candidate
    : fallback;
};

const optionalExternalUrlOf = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const candidate = value.trim();
  return /^https?:\/\/[^\s]+$/i.test(candidate) ? candidate : undefined;
};

const externalUrlOf = (value: unknown, fallback: string): string => {
  if (value === '') return '';
  return optionalExternalUrlOf(value) ?? fallback;
};

const optionalMediaPathOf = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const candidate = value.trim();
  if (/^https?:\/\/[^\s]+$/i.test(candidate)) return candidate;
  if (
    !candidate.includes('..') &&
    /^\/?[a-z0-9][a-z0-9._/-]*$/i.test(candidate) &&
    !candidate.startsWith('//')
  ) {
    return candidate;
  }
  return undefined;
};

const numberOf = (value: unknown, fallback: number): number => {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
};

export function landingSchemaVersionOf(value: unknown): number {
  return numberOf(recordOf(value).schemaVersion, 1);
}

export function isLandingSchemaSupported(value: unknown): boolean {
  return landingSchemaVersionOf(value) <= LANDING_SCHEMA_VERSION;
}

const arrayOf = <T>(
  value: unknown,
  fallback: readonly unknown[],
  mapper: (item: unknown, index: number) => T,
): T[] => (Array.isArray(value) ? value : fallback).map(mapper);

/**
 * Converts old/partial landing JSON into the canonical schema. In particular,
 * V22 rows used `{title, description}` for cards and `title` for courses.
 */
export function normalizeLandingContent(value: unknown): LandingContent {
  const raw = recordOf(value);
  const d = DEFAULT_LANDING_CONTENT;
  const navbar = recordOf(raw.navbar);
  const hero = recordOf(raw.hero);
  const cta = recordOf(raw.cta);
  const courseCard = recordOf(raw.courseCard);
  const leadForm = recordOf(raw.leadForm);
  const leadModal = recordOf(raw.leadModal);
  const footer = recordOf(raw.footer);
  const contacts = recordOf(raw.contacts);

  const links = arrayOf(navbar.links, d.navbar.links, (item, index) => {
    const current = recordOf(item);
    const fallback = d.navbar.links[index] ?? { label: 'Havola', href: '#' };
    return {
      label: stringOf(current.label, fallback.label),
      href: safeNavigationOf(current.href, fallback.href),
    };
  });

  const stats = arrayOf(raw.stats, d.stats, (item, index) => {
    const current = recordOf(item);
    const fallback = d.stats[index] ?? { value: '0', label: 'Nomi' };
    return {
      value: stringOf(current.value, fallback.value),
      label: stringOf(current.label, fallback.label),
    };
  });

  const features = arrayOf(raw.features, d.features, (item, index) => {
    const current = recordOf(item);
    const fallback = d.features[index] ?? { icon: 'Sparkles', text: 'Yangi imkoniyat' };
    return {
      icon: nonEmptyStringOf(current.icon, fallback.icon),
      text: stringOf(current.text, stringOf(current.title, fallback.text)),
    };
  });

  const courseInfo = arrayOf(raw.courseInfo, d.courseInfo, (item, index) => {
    const current = recordOf(item);
    const fallback = d.courseInfo[index] ?? { icon: 'Video', text: "Yangi ma'lumot" };
    return {
      icon: nonEmptyStringOf(current.icon, fallback.icon),
      text: stringOf(current.text, stringOf(current.title, fallback.text)),
    };
  });

  const goals = arrayOf(raw.goals, d.goals, (item, index) => {
    const current = recordOf(item);
    const fallback = d.goals[index] ?? { icon: 'Timer', title: 'Yangi maqsad' };
    return {
      icon: nonEmptyStringOf(current.icon, fallback.icon),
      title: stringOf(current.title, stringOf(current.text, fallback.title)),
      image: optionalMediaPathOf(current.image),
    };
  });

  const testimonials = arrayOf(raw.testimonials, d.testimonials, (item, index) => {
    const current = recordOf(item);
    const fallback = d.testimonials[index] ?? { id: index + 1, name: "O'quvchi fikri", course: 'Kurs' };
    return {
      id: numberOf(current.id, fallback.id),
      name: stringOf(current.name, fallback.name),
      course: stringOf(current.course, fallback.course),
      videoUrl: optionalExternalUrlOf(current.videoUrl),
      image: optionalMediaPathOf(current.image),
    };
  });

  const courses = arrayOf(raw.courses, d.courses, (item, index) => {
    const current = recordOf(item);
    const fallback = d.courses[index] ?? {
      id: `course-${index + 1}`,
      flag: '🏳️',
      name: 'Yangi kurs',
      students: 0,
      price: "799 000 so'm",
      rating: 5,
    };
    return {
      id: nonEmptyStringOf(current.id, fallback.id),
      flag: stringOf(current.flag, fallback.flag),
      name: stringOf(current.name, stringOf(current.title, fallback.name)),
      students: Math.max(0, numberOf(current.students, fallback.students)),
      price: stringOf(current.price, fallback.price),
      rating: Math.min(5, Math.max(0, numberOf(current.rating, fallback.rating))),
      buyUrl: optionalExternalUrlOf(current.buyUrl),
    };
  });

  const bonusBooks = arrayOf(raw.bonusBooks, d.bonusBooks, (item, index) => {
    const current = recordOf(item);
    const fallback = d.bonusBooks[index] ?? { id: index + 1, title: 'Yangi kitob' };
    return {
      id: numberOf(current.id, fallback.id),
      title: stringOf(current.title, fallback.title),
      cover: optionalMediaPathOf(current.cover),
    };
  });

  return {
    schemaVersion: numberOf(raw.schemaVersion, LANDING_SCHEMA_VERSION),
    navbar: {
      logo: stringOf(navbar.logo, d.navbar.logo),
      links,
      ctaLabel: stringOf(navbar.ctaLabel, d.navbar.ctaLabel),
      menuLabel: stringOf(navbar.menuLabel, d.navbar.menuLabel),
    },
    hero: {
      title: stringOf(hero.title, d.hero.title),
      subtitle: stringOf(hero.subtitle, d.hero.subtitle),
      primaryBtn: stringOf(hero.primaryBtn, d.hero.primaryBtn),
      secondaryBtn: stringOf(hero.secondaryBtn, d.hero.secondaryBtn),
    },
    stats,
    featuresTitle: stringOf(raw.featuresTitle, d.featuresTitle),
    features,
    courseInfoTitle: stringOf(raw.courseInfoTitle, d.courseInfoTitle),
    courseInfo,
    goalsTitle: stringOf(raw.goalsTitle, d.goalsTitle),
    goals,
    testimonialsTitle: stringOf(raw.testimonialsTitle, d.testimonialsTitle),
    testimonials,
    coursesTitle: stringOf(raw.coursesTitle, d.coursesTitle),
    courses,
    courseCard: {
      categoryLabel: stringOf(courseCard.categoryLabel, d.courseCard.categoryLabel),
      studentsLabel: stringOf(courseCard.studentsLabel, d.courseCard.studentsLabel),
      buyLabel: stringOf(courseCard.buyLabel, d.courseCard.buyLabel),
    },
    bonusTitle: stringOf(raw.bonusTitle, d.bonusTitle),
    bonusText: stringOf(raw.bonusText, d.bonusText),
    bonusBooks,
    cta: {
      title: stringOf(cta.title, d.cta.title),
      description: stringOf(cta.description, d.cta.description),
      nameLabel: stringOf(cta.nameLabel, d.cta.nameLabel),
      phoneLabel: stringOf(cta.phoneLabel, d.cta.phoneLabel),
      submitLabel: stringOf(cta.submitLabel, d.cta.submitLabel),
    },
    leadForm: {
      optionalLabel: stringOf(leadForm.optionalLabel, d.leadForm.optionalLabel),
      namePlaceholder: stringOf(leadForm.namePlaceholder, d.leadForm.namePlaceholder),
      phonePlaceholder: stringOf(leadForm.phonePlaceholder, d.leadForm.phonePlaceholder),
      loadingLabel: stringOf(leadForm.loadingLabel, d.leadForm.loadingLabel),
      invalidPhoneMessage: stringOf(leadForm.invalidPhoneMessage, d.leadForm.invalidPhoneMessage),
      successMessage: stringOf(leadForm.successMessage, d.leadForm.successMessage),
      errorMessage: stringOf(leadForm.errorMessage, d.leadForm.errorMessage),
    },
    leadModal: {
      title: stringOf(leadModal.title, d.leadModal.title),
      description: stringOf(leadModal.description, d.leadModal.description),
      closeLabel: stringOf(leadModal.closeLabel, d.leadModal.closeLabel),
    },
    footer: {
      company: stringOf(footer.company, d.footer.company),
      socialTitle: stringOf(footer.socialTitle, d.footer.socialTitle),
      contactTitle: stringOf(footer.contactTitle, d.footer.contactTitle),
    },
    contacts: {
      phone: stringOf(contacts.phone, d.contacts.phone),
      telegram: externalUrlOf(contacts.telegram, d.contacts.telegram),
      instagram: externalUrlOf(contacts.instagram, d.contacts.instagram),
      youtube: externalUrlOf(contacts.youtube, d.contacts.youtube),
    },
  };
}

export const landingContent = normalizeLandingContent(DEFAULT_LANDING_CONTENT);
