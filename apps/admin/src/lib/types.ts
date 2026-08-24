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
  isPremium: boolean;
  price?: number;
  priceLabel?: string;
  orderIndex?: number;
  lessonCount?: number;
  studentCount?: number;
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
}

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

export interface Exercise {
  id: number;
  lessonId: number;
  name: string;
  orderIndex: number;
  sentence: string;
  options: string;
  correctAnswer: string;
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
  deliveryType?: 'FREE' | 'NEGOTIABLE' | 'PAID'; // bosma kitoblar uchun
  deliveryPrice?: number;                        // PAID bo'lsa — yetkazib berish narxi
}

export interface StudentProgress {
  userId: number;
  firstName: string;
  lastName: string;
  courseId: number;
  courseName: string;
  progress: number;
  lessonsCompleted: number;
  totalLessons: number;
}

export interface ChatMessage {
  id: number;
  courseId: number;
  studentId: number;
  senderId: number;
  senderRole: string;
  text: string;
  createdAt: string;
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

// --- Landing (Oazis marketing sayti) ---
export interface LandingLabelValue {
  label: string;
  value: string;
}

export interface LandingTitleDesc {
  title: string;
  description: string;
}

export interface LandingTestimonial {
  name: string;
  videoUrl: string;
}

export interface LandingCourse {
  flag: string;
  title: string;
  students: number;
  price: string;
  rating: number;
}

export interface LandingContacts {
  phone: string;
  telegram: string;
  instagram: string;
  youtube: string;
}

export interface LandingContent {
  stats: LandingLabelValue[];
  features: LandingTitleDesc[];
  courseInfo: LandingTitleDesc[];
  goals: LandingTitleDesc[];
  testimonials: LandingTestimonial[];
  courses: LandingCourse[];
  bonusText: string;
  contacts: LandingContacts;
}

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
