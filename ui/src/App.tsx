import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { Workspace } from '@/components/Workspace';
import { ToastProvider } from '@/components/ToastProvider';
import { SettingsModal } from '@/components/SettingsModal';
import { ConfigProvider } from '@/components/ConfigContext';
import { automationService } from '@/services/automation-service';
import type { AutomationStatus } from '@/types';

function App() {
  const [status, setStatus] = useState<AutomationStatus>('idle');
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const unsubscribe = automationService.on((event) => {
      if (event.type === 'status') {
        setStatus(event.status);
      }
    });
    return unsubscribe;
  }, []);

  return (
    <ConfigProvider>
      <ToastProvider>
        <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#f8f9fc]">
          <Header status={status} onOpenSettings={() => setShowSettings(true)} />
          <Workspace />
        </div>
        <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
      </ToastProvider>
    </ConfigProvider>
  );
}

export default App;
