import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth-store';
import DashboardLayout from './components/layout/DashboardLayout';
import LoginPage from './pages/auth/LoginPage';

// Admin pages
import AdminDashboard from './pages/admin/DashboardPage';
import UsersPage from './pages/admin/UsersPage';
import LanguagesPage from './pages/admin/LanguagesPage';
import CoursesPage from './pages/admin/CoursesPage';
import LessonsPage from './pages/admin/LessonsPage';
import BooksPage from './pages/admin/BooksPage';
import PaymentMethodsPage from './pages/admin/PaymentMethodsPage';
import IncomePage from './pages/admin/IncomePage';
import AdminNotificationsPage from './pages/admin/NotificationsPage';
import BreakMusicPage from './pages/admin/BreakMusicPage';
import ReportsPage from './pages/admin/ReportsPage';
import LandingPage from './pages/admin/LandingPage';
import LeadsPage from './pages/admin/LeadsPage';
import SettingsPage from './pages/admin/SettingsPage';

// Teacher pages
import TeacherDashboard from './pages/teacher/DashboardPage';
import MyCoursesPage from './pages/teacher/MyCoursesPage';
import StudentsPage from './pages/teacher/StudentsPage';
import NotificationsPage from './pages/teacher/NotificationsPage';
import ChatPage from './pages/teacher/ChatPage';
import GroupChatPage from './pages/teacher/GroupChatPage';

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
    </BrowserRouter>
  );
}
