import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth-store';
import DashboardLayout from './components/layout/DashboardLayout';
import LoginPage from './pages/auth/LoginPage';

// Route-level code splitting keeps heavy admin-only modules (notably charts)
// out of the initial login/dashboard bundle.
const AdminDashboard = lazy(() => import('./pages/admin/DashboardPage'));
const UsersPage = lazy(() => import('./pages/admin/UsersPage'));
const LanguagesPage = lazy(() => import('./pages/admin/LanguagesPage'));
const CoursesPage = lazy(() => import('./pages/admin/CoursesPage'));
const LessonsPage = lazy(() => import('./pages/admin/LessonsPage'));
const BooksPage = lazy(() => import('./pages/admin/BooksPage'));
const PaymentMethodsPage = lazy(() => import('./pages/admin/PaymentMethodsPage'));
const IncomePage = lazy(() => import('./pages/admin/IncomePage'));
const AdminNotificationsPage = lazy(() => import('./pages/admin/NotificationsPage'));
const BreakMusicPage = lazy(() => import('./pages/admin/BreakMusicPage'));
const ReportsPage = lazy(() => import('./pages/admin/ReportsPage'));
const LandingPage = lazy(() => import('./pages/admin/LandingPage'));
const LeadsPage = lazy(() => import('./pages/admin/LeadsPage'));
const SettingsPage = lazy(() => import('./pages/admin/SettingsPage'));

const TeacherDashboard = lazy(() => import('./pages/teacher/DashboardPage'));
const MyCoursesPage = lazy(() => import('./pages/teacher/MyCoursesPage'));
const StudentsPage = lazy(() => import('./pages/teacher/StudentsPage'));
const NotificationsPage = lazy(() => import('./pages/teacher/NotificationsPage'));
const ChatPage = lazy(() => import('./pages/teacher/ChatPage'));
const GroupChatPage = lazy(() => import('./pages/teacher/GroupChatPage'));

function RouteFallback() {
  return <div className="flex min-h-64 items-center justify-center text-sm text-gray-400">Yuklanmoqda...</div>;
}

function ProtectedRoute({ children, allowedRole }: { children: React.ReactNode; allowedRole: 'ADMIN' | 'TEACHER' }) {
  const { isAuthenticated, role } = useAuthStore();

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (role !== allowedRole) return <Navigate to={role === 'ADMIN' ? '/admin' : '/teacher'} replace />;

  return <>{children}</>;
}

export default function App() {
  const { hydrate, isAuthenticated, role } = useAuthStore();

  useEffect(() => { hydrate(); }, [hydrate]);

  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* Login */}
          <Route path="/login" element={
            isAuthenticated ? <Navigate to={role === 'ADMIN' ? '/admin' : '/teacher'} replace /> : <LoginPage />
          } />

          {/* Admin routes */}
          <Route path="/admin" element={
            <ProtectedRoute allowedRole="ADMIN"><DashboardLayout /></ProtectedRoute>
          }>
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="languages" element={<LanguagesPage />} />
            <Route path="courses" element={<CoursesPage />} />
            <Route path="lessons" element={<LessonsPage />} />
            <Route path="books" element={<BooksPage />} />
            <Route path="payment-methods" element={<PaymentMethodsPage />} />
            <Route path="income" element={<IncomePage />} />
            <Route path="notifications" element={<AdminNotificationsPage />} />
            <Route path="break-music" element={<BreakMusicPage />} />
            <Route path="landing" element={<LandingPage />} />
            <Route path="leads" element={<LeadsPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          {/* Teacher routes */}
          <Route path="/teacher" element={
            <ProtectedRoute allowedRole="TEACHER"><DashboardLayout /></ProtectedRoute>
          }>
            <Route index element={<TeacherDashboard />} />
            <Route path="courses" element={<MyCoursesPage />} />
            <Route path="students" element={<StudentsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="group-chat" element={<GroupChatPage />} />
          </Route>

          {/* Default redirect */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
