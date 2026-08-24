import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function DashboardLayout() {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <main className="ml-[260px] p-6">
        <Outlet />
      </main>
    </div>
  );
}
