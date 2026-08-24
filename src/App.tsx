import { useStore } from './store/useStore';
import { LoginScreen } from './components/auth/LoginScreen';
import { TopBar } from './components/layout/TopBar';
import { Sidebar } from './components/layout/Sidebar';
import { CommandDashboard } from './components/dashboard/CommandDashboard';
import { RoomDetail } from './components/room/RoomDetail';
import { SensorHealthCenter } from './components/health/SensorHealthCenter';
import { AuditLog } from './components/audit/AuditLog';
import { FallAlertModal } from './components/alerts/FallAlertModal';
import { AssistantDrawer } from './components/assistant/AssistantDrawer';

function MainContent() {
  const view = useStore((s) => s.view);
  const selectedRoomId = useStore((s) => s.selectedRoomId);

  if (view === 'room' && selectedRoomId) return <RoomDetail />;
  if (view === 'sensors') return <SensorHealthCenter />;
  if (view === 'audit') return <AuditLog />;
  return <CommandDashboard />;
}

function AppShell() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-bg-canvas)' }}>
      <TopBar />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main className="flex-1 min-w-0 px-4 sm:px-6 py-5 overflow-y-auto">
          <MainContent />
        </main>
      </div>
      <FallAlertModal />
      <AssistantDrawer />
    </div>
  );
}

function App() {
  const session = useStore((s) => s.session);
  return session ? <AppShell /> : <LoginScreen />;
}

export default App;
