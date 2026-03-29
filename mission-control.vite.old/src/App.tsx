import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { SessionsPanel } from './components/SessionsPanel';
import { ProjectsPanel } from './components/ProjectsPanel';
import { FileTreePanel } from './components/FileTreePanel';
import { MemoryPanel } from './components/MemoryPanel';
import { ApprovalsPanel } from './components/ApprovalsPanel';
import { ToolsPanel } from './components/ToolsPanel';
import { RunningAppsPanel } from './components/RunningAppsPanel';
import { ChatPanel } from './components/ChatPanel';

type Tab = 'sessions' | 'projects' | 'files' | 'memory' | 'approvals' | 'tools' | 'apps';

const TABS: { id: Tab; label: string }[] = [
  { id: 'sessions',  label: 'Sessions'  },
  { id: 'projects',  label: 'Projects'  },
  { id: 'files',     label: 'Files'     },
  { id: 'memory',    label: 'Memory'    },
  { id: 'approvals', label: 'Approvals' },
  { id: 'tools',     label: 'Tools'     },
  { id: 'apps',      label: 'Running'   },
];

function PanelContent({ tab }: { tab: Tab }) {
  switch (tab) {
    case 'sessions':  return <SessionsPanel />;
    case 'projects':  return <ProjectsPanel />;
    case 'files':     return <FileTreePanel />;
    case 'memory':    return <MemoryPanel />;
    case 'approvals': return <ApprovalsPanel />;
    case 'tools':     return <ToolsPanel />;
    case 'apps':      return <RunningAppsPanel />;
  }
}

export default function App() {
  const [activeLane, setActiveLane] = useState('worklab');
  const [activeTab, setActiveTab] = useState<Tab>('sessions');

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0f1117] text-gray-200">
      <Sidebar activeLane={activeLane} onSelectLane={setActiveLane} />

      {/* Left panel */}
      <div className="w-80 flex-shrink-0 border-r border-[#1e2433] flex flex-col overflow-hidden">
        <div className="flex overflow-x-auto border-b border-[#1e2433] bg-[#0a0d14]">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-3 py-2.5 text-xs font-medium whitespace-nowrap flex-shrink-0 transition-colors border-b-2
                ${activeTab === t.id
                  ? 'text-indigo-300 border-indigo-500'
                  : 'text-gray-500 border-transparent hover:text-gray-300'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <PanelContent tab={activeTab} />
        </div>
      </div>

      {/* Chat */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <ChatPanel activeLane={activeLane} />
      </div>
    </div>
  );
}
