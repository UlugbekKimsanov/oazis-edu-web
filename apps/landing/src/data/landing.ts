export interface Stat {
  value: string;
  label: string;
}

export interface Feature {
  icon: string; // lucide icon name
  text: string;
}

export interface CourseInfoItem {
  icon: string;
  text: string;
}

export interface Goal {
  icon: string;
  title: string;
}

export interface Testimonial {
  id: number;
  name: string;
  course: string;
}

export interface Course {
  id: string;
  flag: string;
  name: string;
  students: number;
  price: string;
  rating: number;
}

export interface BonusBook {
  id: number;
  title: string;
}

export interface Contacts {
  phone: string;
  telegram: string;
  instagram: string;
  youtube: string;
}

export interface LandingContent {
  stats: Stat[];
  features: Feature[];
  courseInfo: CourseInfoItem[];
  goals: Goal[];
  testimonials: Testimonial[];
  courses: Course[];
  bonusBooks: BonusBook[];
  contacts: Contacts;
}

export const landingContent: LandingContent = {
  stats: [
    { value: '1000+', label: "o'quvchilar" },
    { value: '7', label: 'kurslar' },
    { value: '280+', label: 'videodarslar' },
  ],
  features: [
    { icon: 'GraduationCap', text: "Malakali ustozlar tomonidan to'liq video darsliklar" },
    { icon: 'ClipboardCheck', text: 'Doimiy nazorat va davomat' },
    { icon: 'MessageCircleQuestion', text: "Mavzuga doir barcha savollarga aniq javoblar" },
    { icon: 'Clock', text: "Istalgan paytda va istalgan joyda o'rganish" },
  ],
  courseInfo: [
    { icon: 'Video', text: "Video va Audio darsliklar orqali chet tillarini o'rgatamiz" },
    { icon: 'Sparkles', text: "Interaktiv va Meta ta'lim metodikalari orqali tushuntirilgan" },
    { icon: 'Bot', text: "AI ustozdan istalgan vaqtda mavzuga doir savollarga javob bor" },
    { icon: 'Award', text: "Kursni muvaffaqiyatli yakunlaganingizdan so'ng maxsus Sertifikat" },
  ],
  goals: [
    { icon: 'MessagesSquare', title: "Atiga 4 oy ichida chet tillarida erkin muloqot darajasi" },
    { icon: 'Brain', title: "Aqliy zo'riqishlarga qarshi uslubda oson ta'lim berish" },
    { icon: 'Timer', title: 'Vaqtingizni maksimal darajada tejab berish' },
  ],
  testimonials: [
    { id: 1, name: "O'quvchi fikri", course: 'Ingliz tili' },
    { id: 2, name: "O'quvchi fikri", course: 'Rus tili' },
    { id: 3, name: "O'quvchi fikri", course: 'Koreys tili' },
    { id: 4, name: "O'quvchi fikri", course: 'Turk tili' },
    { id: 5, name: "O'quvchi fikri", course: 'Arab tili' },
  ],
  courses: [
    { id: 'en', flag: '🇬🇧', name: 'Ingliz tili kursi', students: 136, price: "799 000 so'm", rating: 5.0 },
    { id: 'ru', flag: '🇷🇺', name: 'Rus tili kursi', students: 109, price: "799 000 so'm", rating: 5.0 },
    { id: 'ko', flag: '🇰🇷', name: 'Koreys tili kursi', students: 100, price: "799 000 so'm", rating: 5.0 },
    { id: 'tr', flag: '🇹🇷', name: 'Turk tili kursi', students: 88, price: "799 000 so'm", rating: 5.0 },
    { id: 'ar', flag: '🇸🇦', name: 'Arab tili kursi', students: 72, price: "799 000 so'm", rating: 5.0 },
    { id: 'de', flag: '🇩🇪', name: 'Nemis tili kursi', students: 50, price: "799 000 so'm", rating: 5.0 },
    { id: 'zh', flag: '🇨🇳', name: 'Xitoy tili kursi', students: 33, price: "799 000 so'm", rating: 5.0 },
  ],
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
  contacts: {
    phone: '+998 71 200 53 53',
    telegram: 'https://t.me/oazisedu',
    instagram: 'https://instagram.com/oazisedu',
    youtube: 'https://youtube.com/@oazisedu',
  },
};
