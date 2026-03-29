export const LANES = [
  { id: 'worklab',        label: 'WorkLab',       emoji: '🔧', active: true  },
  { id: 'financemanager', label: 'FinanceManager', emoji: '💰', active: false },
  { id: 'businessops',    label: 'BusinessOps',   emoji: '🏢', active: false },
  { id: 'socialhub',      label: 'SocialHub',     emoji: '💬', active: false },
];

export const SESSIONS = [
  { id: 's1', lane: 'worklab', label: 'Main Session',        status: 'active',  model: 'claude-sonnet-4-6' },
  { id: 's2', lane: 'worklab', label: 'Coding Agent',        status: 'idle',    model: 'claude-sonnet-4-6' },
  { id: 's3', lane: 'socialhub', label: 'SocialHub Session', status: 'idle',    model: 'claude-sonnet-4-6' },
];

export const PROJECTS = [
  { id: 'p1', name: 'mission-control', path: '/home/user/OpenClaw/mission-control', status: 'building' },
  { id: 'p2', name: 'lane-map',        path: '/home/user/OpenClaw/lane-map',         status: 'done'     },
];

export const FILE_TREE = [
  { id: 'f1', name: 'OpenClaw/',         depth: 0, type: 'dir' },
  { id: 'f2', name: 'lanes/',            depth: 1, type: 'dir' },
  { id: 'f3', name: 'WorkLab/',          depth: 2, type: 'dir' },
  { id: 'f4', name: 'memory/',           depth: 3, type: 'dir' },
  { id: 'f5', name: 'active-context.md', depth: 4, type: 'file' },
  { id: 'f6', name: 'decisions-log.md',  depth: 4, type: 'file' },
  { id: 'f7', name: 'shared/',           depth: 1, type: 'dir' },
  { id: 'f8', name: 'policies/',         depth: 2, type: 'dir' },
  { id: 'f9', name: 'mission-control/',  depth: 1, type: 'dir' },
  { id: 'f10', name: 'MEMORY.md',        depth: 1, type: 'file' },
  { id: 'f11', name: 'SOUL.md',          depth: 1, type: 'file' },
  { id: 'f12', name: 'AGENTS.md',        depth: 1, type: 'file' },
];

export const MEMORY_STATUS = {
  global: { path: '/home/user/OpenClaw/MEMORY.md', exists: true, size: '458 B' },
  lanes: [
    { lane: 'WorkLab', files: ['active-context.md', 'decisions-log.md'], status: 'current' },
    { lane: 'FinanceManager', files: [], status: 'empty' },
    { lane: 'BusinessOps',   files: [], status: 'empty' },
    { lane: 'SocialHub',     files: [], status: 'empty' },
  ],
};

export const APPROVALS = [
  { id: 'a1', action: 'rm -rf / destructive ops',              rule: 'must-ask'  },
  { id: 'a2', action: 'pnpm install / build / dev',            rule: 'proceed'   },
  { id: 'a3', action: 'write/edit workspace files',            rule: 'proceed'   },
  { id: 'a4', action: 'cross-lane memory access',              rule: 'must-ask'  },
  { id: 'a5', action: 'sudo / system package installs',        rule: 'must-ask'  },
  { id: 'a6', action: 'design tradeoff with multiple paths',   rule: 'ask'       },
  { id: 'a7', action: 'external API / networked actions',      rule: 'must-ask'  },
  { id: 'a8', action: 'lane-local memory updates',             rule: 'proceed'   },
];

export const TOOLS = [
  { id: 't1',  name: 'read',           status: 'available', lanes: ['all']                              },
  { id: 't2',  name: 'write',          status: 'available', lanes: ['all']                              },
  { id: 't3',  name: 'edit',           status: 'available', lanes: ['all']                              },
  { id: 't4',  name: 'exec',           status: 'available', lanes: ['WorkLab']                          },
  { id: 't5',  name: 'web_search',     status: 'available', lanes: ['all']                              },
  { id: 't6',  name: 'web_fetch',      status: 'available', lanes: ['all']                              },
  { id: 't7',  name: 'cron',           status: 'available', lanes: ['all']                              },
  { id: 't8',  name: 'memory_search',  status: 'available', lanes: ['all']                              },
  { id: 't9',  name: 'memory_get',     status: 'available', lanes: ['all']                              },
  { id: 't10', name: 'sessions_spawn', status: 'available', lanes: ['WorkLab']                          },
  { id: 't11', name: 'sessions_send',  status: 'available', lanes: ['WorkLab']                          },
  { id: 't12', name: 'image',          status: 'available', lanes: ['all']                              },
  { id: 't13', name: 'process',        status: 'available', lanes: ['WorkLab']                          },
];

export const RUNNING_APPS = [
  { id: 'r1', name: 'mission-control', url: 'http://localhost:5174', status: 'running', pid: null },
];
