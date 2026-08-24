import { useEffect, useState } from 'react';
import { Users, GraduationCap, MessageSquare, ClipboardList } from 'lucide-react';
import StatsCard from '../../components/ui/StatsCard';
import api from '../../lib/api';

interface TeacherStats {
  myCourses: number;
  myStudents: number;
  pendingQuestions: number;
  unreadChats: number;
}

export default function TeacherDashboard() {
  const [stats, setStats] = useState<TeacherStats | null>(null);

  useEffect(() => {
    api.get('/teacher/dashboard').then((r) => setStats(r.data.data ?? r.data)).catch(() => {
      setStats({ myCourses: 3, myStudents: 47, pendingQuestions: 8, unreadChats: 5 });
    });
  }, []);

  if (!stats) return <div className="flex items-center justify-center h-64 text-gray-400">Yuklanmoqda...</div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">O'qituvchi paneli</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard title="Kurslarim" value={stats.myCourses} icon={GraduationCap} from="#2E9E6E" to="#1F7A55" />
        <StatsCard title="O'quvchilarim" value={stats.myStudents} icon={Users} from="#6366F1" to="#4338CA" />
        <StatsCard title="Javob kutayotgan savollar" value={stats.pendingQuestions} icon={ClipboardList} from="#F59E0B" to="#D97706" />
        <StatsCard title="O'qilmagan xabarlar" value={stats.unreadChats} icon={MessageSquare} from="#EC4899" to="#BE185D" />
      </div>

      {/* Recent questions */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">So'nggi savollar</h2>
        <div className="space-y-3">
          {[
            { student: 'Alisher K.', question: '"Present Perfect" va "Past Simple" farqi nima?', lesson: 'Grammar Basics', time: '10 min oldin' },
            { student: 'Malika R.', question: 'Ushbu gapni qanday tarjima qilaman?', lesson: 'Daily Routine', time: '25 min oldin' },
            { student: 'Jasur T.', question: "Pronunciation bo'yicha tavsiya bering", lesson: 'Greetings', time: '1 soat oldin' },
          ].map((q, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-blue-600">{q.student[0]}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">{q.student}</span>
                  <span className="text-xs text-gray-400">• {q.lesson}</span>
                </div>
                <p className="text-sm text-gray-600 mt-0.5 truncate">{q.question}</p>
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap">{q.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
