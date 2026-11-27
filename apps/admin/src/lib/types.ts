export type Role = 'ADMIN' | 'TEACHER';

export interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: string;
  specialization?: string;
  ball?: number;
  avatarUrl?: string;
  createdAt?: string;
  /** Bosh admin (login javobida keladi) */
  isDefault?: boolean | null;
}

export interface Language {
  id: number;
  name: string;
  description?: string;
  flagImage?: string;
  backgroundImage?: string;
  flagEmoji?: string;
  enabled?: boolean;
  courseCount?: number;
  studentCount?: number;
}

export interface BreakTrack {
  id: number;
  groupId: number;
  title?: string;
  filePath?: string;
}

export interface BreakGroup {
  id: number;
  name: string;
  icon?: string;
  backgroundImage?: string;
  orderIndex?: number;
  tracks?: BreakTrack[];
}

export interface PaymentMethod {
  id: number;
  code: string;
  name: string;
  isNasiya?: boolean;
  enabled?: boolean;
  orderIndex?: number;
}

export interface Course {
  id: number;
  name: string;
  languageId: number;
  languageName?: string;
  coverImage?: string;
  backgroundImage?: string;
  flagEmoji?: string;
  goal?: string;
  author?: string; // kurs muallifi (dars videosida ko'rsatiladi)
  isPremium: boolean;
  price?: number;
  priceLabel?: string;
  orderIndex?: number;
  lessonCount?: number;
  studentCount?: number;
  /** Saytda (landing) sotuvdami — `PATCH /admin/courses/{id}/sale` bilan o'zgaradi. */
  onSale?: boolean;
  /** Landing kartasida ko'rsatiladigan o'quvchilar soni (admin qo'lda belgilaydi). */
  landingStudents?: number;
}

export interface Lesson {
  id: number;
  courseId: number;
  name: string;
  description?: string;
  orderIndex: number;
  durationSec?: number;
  videoUrl?: string;
  coverImage?: string;
  youtubeId?: string; // YouTube unlisted video ID (kiritilsa, mobil ilova YouTube pleyerda ko'rsatadi)
  /** Tejamkor (sekin internet uchun) versiya — videoUrl kabi nisbiy yo'l. */
  videoUrlLow?: string | null;
  /** Tejamkor versiyani tayyorlash holati (server fonda transkod qiladi). */
  videoLowStatus?: VideoLowStatus | null;
  videoLowError?: string | null;
}

export type VideoLowStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'SKIPPED' | 'FAILED';

export interface Vocabulary {
  id: number;
  lessonId: number;
  translationUz: string;
  translationTarget: string;
  orderIndex: number;
}

export interface Audiobook {
  id: number;
  lessonId: number;
  title?: string;
  description?: string;
  filePath?: string;
  pdfPath?: string;
  orderIndex?: number;
}

export interface Question {
  id: number;
  testId: number;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD?: string;
  correctOption: string;
  orderIndex: number;
}

/** Gapdagi bitta bo'shliq — har birining o'z to'g'ri javobi bor */
export interface ExerciseBlank {
  id: number;
  position: number;        // gapdagi tartibi (0 dan)
  correctAnswer: string;
}

export interface Exercise {
  id: number;
  lessonId: number;
  name: string;
  orderIndex: number;
  sentence: string;        // bo'shliqlar '_' bilan (bir nechta bo'lishi mumkin)
  options: string;         // faqat chalg'ituvchi so'zlar, vergul bilan
  blanks: ExerciseBlank[]; // position bo'yicha tartiblangan
}

export interface Test {
  id: number;
  lessonId: number;
  name: string;
}

export interface Book {
  id: number;
  title: string;
  author: string;
  category: 'digital' | 'print';
  description?: string;
  price: number;
  priceLabel?: string;
  isFree: boolean;
  emoji: string;
  coverColor1?: number;
  coverColor2?: number;
  pages?: string;
  pageCount?: number;
  rating: number;
  reviewCount?: number;
  language?: string;
  coverImage?: string;
  coverUrl?: string;
  images?: string | null; // galereya rasmlari — JSON array string (nisbiy yo'llar)
  deliveryType?: 'FREE' | 'NEGOTIABLE' | 'PAID'; // bosma kitoblar uchun
  deliveryPrice?: number;                        // PAID bo'lsa — yetkazib berish narxi
}

export interface StudentProgress {
  /** Qator identifikatori (kursga yozilish yozuvi) — bir o'quvchi bir necha kursda bo'lishi mumkin */
  id: number;
  userId: number;
  firstName: string;
  lastName: string;
  courseId: number;
  courseName: string;
  progress: number;
  lessonsCompleted: number;
  totalLessons: number;
  enrolledAt?: string | null;
  lastActiveAt?: string | null;
}

/** Ustoz ↔ o'quvchi shaxsiy chat xonasi (GET /teacher/chat/rooms) */
export interface ChatRoom {
  courseId: number;
  studentId: number;
  studentName: string;
  courseName: string;
  /** Kursga yozilganmi (yozilmagan o'quvchi ham xabar yozgan bo'lishi mumkin) */
  enrolled?: boolean;
  lastMessage?: string | null;
  lastTime?: string | null;
  lastSenderRole?: string | null;
  /** Oxirgi xabar o'quvchidan — ustoz javobi kutilmoqda */
  awaitingReply?: boolean;
}

export interface TeacherDashboardStats {
  myCourses: number;
  myStudents: number;
  awaitingChats: number;
  activeChats: number;
  recentAwaiting: ChatRoom[];
}

export interface ChatMessage {
  id: number;
  courseId: number;
  studentId: number;
  senderId: number;
  senderRole: string;
  text: string;
  createdAt: string;
  /** Yuklangan media (/files/...) va turi: "image" yoki "file" */
  mediaUrl?: string | null;
  mediaType?: string | null;
  messageType?: string;
  pinned?: boolean;
  conferenceUrl?: string;
  conferenceActive?: boolean;
  conferenceStartAt?: string;
  senderName?: string;
}

export interface DashboardStats {
  totalStudents: number;
  totalTeachers: number;
  totalCourses: number;
  totalLessons: number;
  totalBooks: number;
  activeStudentsToday: number;
  revenue: number;
}

// --- Landing (Oazis marketing sayti) — ikkala frontend uchun bitta kanonik kontrakt. ---
export type {
  BonusBook,
  Contacts as LandingContacts,
  Course as LandingCourseItem,
  CourseInfoItem,
  Feature as LandingFeature,
  Goal as LandingGoal,
  LandingContent,
  NavLink,
  Stat as LandingStat,
  Testimonial as LandingTestimonial,
} from '../../../shared/landing-content';

export interface LandingLead {
  id: number;
  name?: string | null;
  phone: string;
  status: LeadStatus;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export type LeadStatus = 'NEW' | 'PURCHASED' | 'REJECTED';

export interface LeadStats {
  total: number;
  newRequests: number;
  purchased: number;
  rejected: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}
