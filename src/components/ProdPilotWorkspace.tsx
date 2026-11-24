import React, { useState, useMemo, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  LayoutDashboard,
  Rocket,
  FolderKanban,
  Calendar as CalendarIcon,
  BarChart3,
  FileText,
  Sparkles,
  Settings,
  Plus,
  Search,
  Download,
  Upload,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Users,
  ChevronLeft,
  ChevronRight,
  X,
  Copy,
  Send,
  RefreshCw,
  FileSpreadsheet,
  ShieldAlert,
  ArrowRight,
  Check,
  Play,
  Info,
  RotateCcw
} from 'lucide-react';
import { AppUser, Project } from '../types';

export type ProdPilotPage =
  | 'dashboard'
  | 'mep'
  | 'kanban'
  | 'planning'
  | 'reports'
  | 'minutes'
  | 'assistant'
  | 'settings';

export type MepStatus =
  | 'Brouillon'
  | 'Préparation'
  | 'En validation'
  | 'Planifiée'
  | 'En cours'
  | 'Réussie'
  | 'Échec'
  | 'Annulée';

export type MepTaskStatus = 'À faire' | 'En cours' | 'En validation' | 'Terminé';

export interface MepPerson {
  name: string;
  role: string;
}

export interface MepTask {
  id: string;
  title: string;
  kind: 'Jalon' | 'Tâche';
  assignee: string;
  offset: number;
  duration: number;
  status: MepTaskStatus;
  notes: string;
}

export interface MepMinute {
  id: string;
  mepId: string;
  date: string;
  type: string;
  subject: string;
  attendees: string;
  summary: string;
  decisions: string;
  actions: string;
  risks: string;
  updatedAt?: string;
}

export interface MepEntry {
  id: string;
  ref?: string;
  projectId: string;
  project: string;
  title: string;
  version: string;
  date: string;
  owner: string;
  environment: 'Production' | 'Préproduction' | 'Recette';
  status: MepStatus;
  priority: 'Critique' | 'Haute' | 'Normale' | 'Basse';
  goNoGo: 'En attente' | 'GO' | 'NO-GO';
  changeNumbers: string;
  ritmNumbers: string;
  rollback: string;
  description: string;
  people: MepPerson[];
  tasks: MepTask[];
  minutes: MepMinute[];
  createdAt?: string;
  updatedAt?: string;
}

interface ProdPilotDb {
  mep: MepEntry[];
  kanban: any[];
}

interface ProdPilotWorkspaceProps {
  currentUser: AppUser;
  projects?: Project[];
  activeProjectId?: string;
}

const MEP_STATUSES: MepStatus[] = [
  'Brouillon',
  'Préparation',
  'En validation',
  'Planifiée',
  'En cours',
  'Réussie',
  'Échec',
  'Annulée',
];

const KANBAN_COLUMNS: MepTaskStatus[] = [
  'À faire',
  'En cours',
  'En validation',
  'Terminé',
];

const isoToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const uid = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 9).toUpperCase()}`;

const dayStr = (s?: string) => String(s || '').slice(0, 10);

const addDays = (dateStr: string, days: number) => {
  const d = new Date(`${dateStr}T12:00:00`);
  if (isNaN(d.getTime())) return dateStr;
  d.setDate(d.getDate() + Number(days || 0));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const fmtDate = (s?: string) => {
  if (!s) return '—';
  const d = new Date(s.length === 10 ? `${s}T12:00` : s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString('fr-FR', {
    dateStyle: 'medium',
    ...(s.length > 10 ? { timeStyle: 'short' } : {}),
  });
};

const normalizeTask = (t: Partial<MepTask>): MepTask => ({
  id: t.id || uid('TASK'),
  title: t.title || 'Tâche',
  kind: t.kind === 'Jalon' ? 'Jalon' : 'Tâche',
  assignee: t.assignee || '',
  offset: Number(t.offset ?? 0),
  duration: Math.max(1, Number(t.duration ?? 1)),
  status: KANBAN_COLUMNS.includes(t.status as MepTaskStatus)
    ? (t.status as MepTaskStatus)
    : 'À faire',
  notes: t.notes || '',
});

const createDefaultTasks = (): MepTask[] =>
  [
    { title: 'Cadrage et validation du périmètre', kind: 'Jalon' as const, offset: -15, duration: 1, status: 'À faire' as const },
    { title: 'Préparation technique et prérequis', kind: 'Tâche' as const, offset: -10, duration: 3, status: 'À faire' as const },
    { title: 'Tests et validation préproduction', kind: 'Jalon' as const, offset: -5, duration: 1, status: 'À faire' as const },
    { title: 'Validation CAB / Go-No-Go', kind: 'Jalon' as const, offset: -2, duration: 1, status: 'À faire' as const },
    { title: 'Exécution de la mise en production', kind: 'Jalon' as const, offset: 0, duration: 1, status: 'À faire' as const },
    { title: 'Contrôles post-MEP et hypercare', kind: 'Tâche' as const, offset: 1, duration: 1, status: 'À faire' as const },
    { title: 'Bilan et clôture', kind: 'Jalon' as const, offset: 2, duration: 1, status: 'À faire' as const },
  ].map((t) => normalizeTask(t));

const getMepRef = (m: MepEntry) => m.ref || `MEP-${m.id.slice(-5)}`;
const isClosedMep = (m: MepEntry) => ['Réussie', 'Échec', 'Annulée'].includes(m.status);
const isLateMep = (m: MepEntry) => Boolean(m.date && dayStr(m.date) < isoToday() && !isClosedMep(m));

const getTaskDates = (m: MepEntry, t: MepTask) => {
  const base = dayStr(m.date) || isoToday();
  const start = addDays(base, t.offset);
  const end = addDays(start, Math.max(0, t.duration - 1));
  return { start, end };
};

const getMepProgress = (m: MepEntry) => {
  const ts = m.tasks || [];
  if (!ts.length) return 0;
  return Math.round((ts.filter((t) => t.status === 'Terminé').length / ts.length) * 100);
};

const normalizeMep = (x: any, projects: Project[]): MepEntry => {
  const project = projects.find((p) => p.id === x.projectId) || projects.find((p) => p.name === x.project);
  return { ...x, projectId: project?.id || x.projectId || '', project: project?.name || x.project || 'Projet non classé', minutes: Array.isArray(x.minutes) ? x.minutes : [], changeNumbers: x.changeNumbers || x.changeRef || '', ritmNumbers: x.ritmNumbers || '', people: Array.isArray(x.people) ? x.people : [], tasks: (x.tasks || []).map(normalizeTask) };
};

const getStatusBadgeClasses = (status: string) => {
  if (['Réussie', 'Terminé', 'GO'].includes(status)) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }
  if (['Échec', 'Annulée', 'NO-GO'].includes(status)) {
    return 'bg-rose-50 text-rose-700 border-rose-200';
  }
  if (['En cours', 'Planifiée'].includes(status)) {
    return 'bg-sky-50 text-sky-700 border-sky-200';
  }
  if (['En validation', 'En attente'].includes(status)) {
    return 'bg-amber-50 text-amber-800 border-amber-200';
  }
  return 'bg-indigo-50 text-indigo-700 border-indigo-200';
};

export const ProdPilotWorkspace: React.FC<ProdPilotWorkspaceProps> = ({
  currentUser,
  projects: clarityProjects = [],
  activeProjectId,
}) => {
  const [db, setDb] = useState<ProdPilotDb>({ mep: [], kanban: [] });
  const [mepLoaded, setMepLoaded] = useState(false);
  const [mepLoadError, setMepLoadError] = useState<string | null>(null);
  const mepRevision = useRef(1);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => { let active = true; fetch('/api/meps', { credentials: 'same-origin' }).then(async (r) => { const data = await r.json(); if (!r.ok) throw new Error(data.error || 'Chargement MEP impossible'); return data; }).then((data) => { if (!active) return; const meps = (data.meps || []).map((m: any) => normalizeMep(m, clarityProjects)); setDb({ mep: meps, kanban: [] }); mepRevision.current = Number(data.revision) || 1; setMepLoadError(null); setMepLoaded(true); }).catch((error) => { console.error(error); if (active) { setMepLoadError(error instanceof Error ? error.message : 'Impossible de charger les MEP depuis le serveur'); } }); return () => { active = false; }; }, [currentUser.id]);
  useEffect(() => { setDb((current) => ({ ...current, mep: current.mep.map((m) => ({ ...m, project: clarityProjects.find((p) => p.id === m.projectId)?.name || m.project })) })); }, [clarityProjects]);

  const [page, setPage] = useState<ProdPilotPage>(activeProjectId ? 'mep' : 'dashboard');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Filters
  const [mepSearch, setMepSearch] = useState('');
  const [mepStatusFilter, setMepStatusFilter] = useState('');
  const [mepPriorityFilter, setMepPriorityFilter] = useState('');
  const [mepDateFilter, setMepDateFilter] = useState('');
  const [kanbanProjectFilter, setKanbanProjectFilter] = useState('');
  const [minuteSearch, setMinuteSearch] = useState('');
  const [minuteProjectFilter, setMinuteProjectFilter] = useState('');

  // Calendar State
  const [calendarDate, setCalendarDate] = useState<Date>(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string>(isoToday());

  // MEP Modal State
  const [isMepModalOpen, setIsMepModalOpen] = useState(false);
  const [editMepId, setEditMepId] = useState<string | null>(null);
  const [mepForm, setMepForm] = useState<Partial<MepEntry>>({});
  const [personDraft, setPersonDraft] = useState<MepPerson[]>([]);
  const [taskDraft, setTaskDraft] = useState<MepTask[]>([]);

  // Minute Modal State
  const [isMinuteModalOpen, setIsMinuteModalOpen] = useState(false);
  const [editMinuteId, setEditMinuteId] = useState<string | null>(null);
  const [minuteForm, setMinuteForm] = useState<Partial<MepMinute>>({});

  // Confirmation Dialog State (replaces window.confirm / window.alert)
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    danger?: boolean;
    onConfirm: () => void;
  } | null>(null);

  // Assistant Copilot State
  const [assistantSource, setAssistantSource] = useState('');
  const [assistantFileInfo, setAssistantFileInfo] = useState('Aucun fichier chargé.');
  const [assistantPromptText, setAssistantPromptText] = useState('');
  const [assistantJson, setAssistantJson] = useState('');
  const [assistantParsed, setAssistantParsed] = useState<any[]>([]);
  const [assistantPreviewMsg, setAssistantPreviewMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [isAiParsing, setIsAiParsing] = useState(false);

  // Copilot Studio Direct Line State
  const [copilotUrl, setCopilotUrl] = useState('');
  const [copilotConnected, setCopilotConnected] = useState(false);
  const [copilotBusy, setCopilotBusy] = useState(false);
  const [copilotInput, setCopilotInput] = useState('');
  const [copilotMessages, setCopilotMessages] = useState<{ role: 'bot' | 'user' | 'system'; text: string }[]>([
    {
      role: 'bot',
      text: 'Bonjour ! Je suis votre assistant de pilotage de production. Vous pouvez analyser automatiquement la source chargée à gauche ou connecter un agent Copilot Studio.',
    },
  ]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 2600);
  };

  const persistDb = (next: ProdPilotDb) => {
    const syncedKanban = next.mep.flatMap((m) => (m.tasks || []).map((t) => ({ id: t.id, type: 'task', mepId: m.id, title: t.title, status: t.status, date: getTaskDates(m, t).start, owner: t.assignee || m.owner, mepTitle: m.title, kind: t.kind })));
    const finalDb = { ...next, kanban: syncedKanban };
    setDb(finalDb);
    // Serialize writes so concurrent edits cannot reuse the same PostgreSQL revision.
    writeQueue.current = writeQueue.current.then(async () => {
      const response = await fetch('/api/meps', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ meps: finalDb.mep, revision: mepRevision.current }) });
      const result = await response.json().catch(() => ({}));
      if (response.status === 409) throw new Error('Les MEP ont été modifiées ailleurs. Rechargez la page avant de continuer.');
      if (!response.ok) throw new Error(result.error || 'Sauvegarde MEP impossible');
      mepRevision.current = Number(result.revision) || mepRevision.current + 1;
    }).catch((error) => { console.error('Persistance MEP serveur:', error); showToast(error.message || 'Erreur de sauvegarde serveur'); });
  };

  // Computed collections
  const allTasks = useMemo(
    () =>
      db.mep.flatMap((m) =>
        (m.tasks || []).map((t) => ({
          ...t,
          mep: m,
          mepId: m.id,
          ...getTaskDates(m, t),
        }))
      ),
    [db.mep]
  );

  const projectNames = useMemo(() => {
    const set = new Set<string>();
    db.mep.forEach((m) => {
      const p = (m.project || 'Projet non classé').trim();
      if (p) set.add(p);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [db.mep]);



  // Dashboard Metrics
  const dashboardStats = useMemo(() => {
    const today = isoToday();
    const activeMeps = db.mep.filter((x) => !isClosedMep(x));
    const upcomingMeps = activeMeps.filter((x) => dayStr(x.date) >= today);
    const lateTasks = allTasks.filter((t) => t.end < today && t.status !== 'Terminé');
    const risks = activeMeps.filter(
      (x) => x.priority === 'Critique' || x.priority === 'Haute' || isLateMep(x) || x.goNoGo === 'NO-GO'
    );

    const statusColors: Record<MepStatus, string> = {
      Brouillon: '#6366f1',
      Préparation: '#0ea5e9',
      'En validation': '#f59e0b',
      Planifiée: '#3b82f6',
      'En cours': '#8b5cf6',
      Réussie: '#10b981',
      Échec: '#f43f5e',
      Annulée: '#94a3b8',
    };

    const statusCounts = MEP_STATUSES.map((s) => ({
      status: s,
      count: db.mep.filter((m) => m.status === s).length,
      color: statusColors[s],
    })).filter((x) => x.count > 0);

    let acc = 0;
    const total = db.mep.length;
    const donutGradient = total
      ? `conic-gradient(${statusCounts
          .map((item) => {
            const from = acc;
            acc += (item.count / total) * 100;
            return `${item.color} ${from}% ${acc}%`;
          })
          .join(',')})`
      : undefined;

    const nextDeadlines = [
      ...activeMeps.map((x) => ({
        id: x.id,
        title: x.title,
        date: x.date,
        owner: x.owner,
        label: 'MEP',
        ref: getMepRef(x),
      })),
      ...allTasks
        .filter((t) => t.status !== 'Terminé')
        .map((t) => ({
          id: t.id,
          title: t.title,
          date: t.start,
          owner: t.assignee || t.mep.owner,
          label: t.kind,
          ref: getMepRef(t.mep),
        })),
    ]
      .filter((x) => dayStr(x.date) >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 6);

    const recentMeps = [...db.mep]
      .sort((a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''))
      .slice(0, 5);

    const colCounts = KANBAN_COLUMNS.map((c) => ({
      col: c,
      count: allTasks.filter((t) => t.status === c).length,
    }));
    const maxColCount = Math.max(1, ...colCounts.map((c) => c.count));

    return {
      activeCount: activeMeps.length,
      upcomingCount: upcomingMeps.length,
      lateTasksCount: lateTasks.length,
      risks,
      statusCounts,
      donutGradient,
      nextDeadlines,
      recentMeps,
      colCounts,
      maxColCount,
    };
  }, [db.mep, allTasks]);

  // Filtered MEP table list
  const filteredMeps = useMemo(() => {
    const q = mepSearch.toLowerCase().trim();
    const today = isoToday();
    return db.mep.filter((x) => {
      const matchQuery = !q || JSON.stringify(x).toLowerCase().includes(q);
      const matchStatus = !mepStatusFilter || x.status === mepStatusFilter;
      const matchPriority = !mepPriorityFilter || x.priority === mepPriorityFilter;
      const matchDate =
        !mepDateFilter ||
        (mepDateFilter === 'future' ? dayStr(x.date) >= today : dayStr(x.date) < today);
      const matchProject = !activeProjectId || x.projectId === activeProjectId;
      return matchQuery && matchStatus && matchPriority && matchDate && matchProject;
    });
  }, [db.mep, mepSearch, mepStatusFilter, mepPriorityFilter, mepDateFilter, activeProjectId]);

  // MEP Modal handlers
  const openMepForm = (id: string | null = null, extraTask = false) => {
    setEditMepId(id);
    const existing = id ? db.mep.find((m) => m.id === id) : undefined;
    if (existing) {
      setMepForm({ ...existing });
      setPersonDraft((existing.people || []).map((p) => ({ ...p })));
      const baseTasks = (existing.tasks || []).map(normalizeTask);
      if (extraTask) {
        baseTasks.push(
          normalizeTask({ title: 'Nouvelle tâche', kind: 'Tâche', offset: 0, duration: 1, status: 'À faire' })
        );
      }
      setTaskDraft(baseTasks);
    } else {
      setMepForm({
        projectId: clarityProjects.find((p) => p.id === activeProjectId)?.id || clarityProjects[0]?.id || '',
        project: clarityProjects.find((p) => p.id === activeProjectId)?.name || clarityProjects[0]?.name || '',
        title: '',
        version: '',
        date: `${isoToday()}T22:00`,
        owner: currentUser.displayName || '',
        environment: 'Production',
        status: 'Brouillon',
        priority: 'Normale',
        goNoGo: 'En attente',
        changeNumbers: '',
        ritmNumbers: '',
        rollback: '',
        description: '',
      });
      setPersonDraft([]);
      setTaskDraft(createDefaultTasks());
    }
    setIsMepModalOpen(true);
  };

  const handleSaveMep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mepForm.projectId || !clarityProjects.some((p) => p.id === mepForm.projectId)) { showToast('Sélectionnez un projet Clarity existant.'); return; }
    const now = new Date().toISOString();
    const cleanPeople = personDraft
      .filter((p) => p.name.trim())
      .map((p) => ({ name: p.name.trim(), role: (p.role || '').trim() }));
    const cleanTasks = taskDraft.map(normalizeTask);

    if (editMepId) {
      const updatedMeps = db.mep.map((m) =>
        m.id === editMepId
          ? {
              ...m,
              ...mepForm,
              projectId: (mepForm.projectId || '').trim(),
              project: clarityProjects.find((p) => p.id === mepForm.projectId)?.name || '',
              people: cleanPeople,
              tasks: cleanTasks,
              updatedAt: now,
            }
          : m
      ) as MepEntry[];
      persistDb({ ...db, mep: updatedMeps });
    } else {
      const id = uid('MEP');
      const newEntry: MepEntry = {
        id,
        ref: `MEP-${id.slice(-5)}`,
        projectId: (mepForm.projectId || '').trim(),
        project: clarityProjects.find((p) => p.id === mepForm.projectId)?.name || '',
        title: (mepForm.title || 'Nouvelle MEP').trim(),
        version: (mepForm.version || '').trim(),
        date: mepForm.date || `${isoToday()}T22:00`,
        owner: (mepForm.owner || currentUser.displayName || 'CPP').trim(),
        environment: (mepForm.environment as any) || 'Production',
        status: (mepForm.status as MepStatus) || 'Brouillon',
        priority: (mepForm.priority as any) || 'Normale',
        goNoGo: (mepForm.goNoGo as any) || 'En attente',
        changeNumbers: (mepForm.changeNumbers || '').trim(),
        ritmNumbers: (mepForm.ritmNumbers || '').trim(),
        rollback: (mepForm.rollback || '').trim(),
        description: (mepForm.description || '').trim(),
        people: cleanPeople,
        tasks: cleanTasks,
        minutes: [],
        createdAt: now,
        updatedAt: now,
      };
      persistDb({ ...db, mep: [newEntry, ...db.mep] });
    }
    setIsMepModalOpen(false);
    showToast('MEP enregistrée — planning recalculé');
  };

  const handleDeleteMep = (m: MepEntry) => {
    setConfirmAction({
      title: 'Supprimer cette MEP ?',
      message: `La fiche "${m.title}" (${getMepRef(m)}) et toutes ses tâches associées seront supprimées.`,
      confirmLabel: 'Supprimer la MEP',
      danger: true,
      onConfirm: () => {
        persistDb({ ...db, mep: db.mep.filter((x) => x.id !== m.id) });
        setConfirmAction(null);
        showToast('MEP supprimée');
      },
    });
  };

  const schedulePreviewText = useMemo(() => {
    const base = dayStr(mepForm.date) || isoToday();
    const first = taskDraft.length ? Math.min(...taskDraft.map((t) => Number(t.offset) || 0)) : 0;
    const last = taskDraft.length
      ? Math.max(...taskDraft.map((t) => (Number(t.offset) || 0) + Math.max(1, Number(t.duration) || 1) - 1))
      : 0;
    return `Avec une MEP le ${fmtDate(mepForm.date || base)}, le plan s'étend du ${fmtDate(addDays(base, first))} au ${fmtDate(addDays(base, last))}. Toute modification de la date MEP recalculera automatiquement les dates.`;
  }, [mepForm.date, taskDraft]);

  // Kanban Task Status update
  const handleMoveKanbanTask = (taskId: string, newStatus: MepTaskStatus) => {
    const updated = db.mep.map((m) => ({
      ...m,
      tasks: (m.tasks || []).map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)),
    }));
    persistDb({ ...db, mep: updated });
    showToast('Avancement mis à jour');
  };

  // Calendar events
  const calendarEvents = useMemo(() => {
    const ev: {
      date: string;
      title: string;
      type: 'mep' | 'milestone' | 'task';
      status: string;
      owner: string;
      mep: MepEntry;
    }[] = [];
    db.mep.forEach((m) => {
      if (m.date) {
        ev.push({
          date: dayStr(m.date),
          title: m.title,
          type: 'mep',
          status: m.status,
          owner: m.owner,
          mep: m,
        });
      }
    });
    allTasks.forEach((t) => {
      let cur = t.start;
      let guard = 0;
      while (cur <= t.end && guard < 90) {
        ev.push({
          date: cur,
          title: t.title,
          type: t.kind === 'Jalon' ? 'milestone' : 'task',
          status: t.status,
          owner: t.assignee || t.mep.owner,
          mep: t.mep,
        });
        cur = addDays(cur, 1);
        guard++;
      }
    });
    return ev;
  }, [db.mep, allTasks]);

  const calendarDays = useMemo(() => {
    const y = calendarDate.getFullYear();
    const m = calendarDate.getMonth();
    const first = new Date(y, m, 1);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(y, m, 1 - offset);
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      cells.push({
        key,
        dayNum: d.getDate(),
        isCurrentMonth: d.getMonth() === m,
        items: calendarEvents.filter((x) => x.date === key),
      });
    }
    return cells;
  }, [calendarDate, calendarEvents]);

  // Minutes Handlers
  const openMinuteModal = (minuteId: string | null = null) => {
    if (!db.mep.length) {
      showToast('Créez une MEP avant son compte rendu');
      return;
    }
    setEditMinuteId(minuteId);
    if (minuteId) {
      for (const m of db.mep) {
        const hit = (m.minutes || []).find((r) => r.id === minuteId);
        if (hit) {
          setMinuteForm({ ...hit, mepId: m.id });
          setIsMinuteModalOpen(true);
          return;
        }
      }
    }
    setMinuteForm({
      mepId: db.mep[0]?.id || '',
      date: `${isoToday()}T09:00`,
      type: 'Point projet',
      subject: '',
      attendees: '',
      summary: '',
      decisions: '',
      actions: '',
      risks: '',
    });
    setIsMinuteModalOpen(true);
  };

  const handleSaveMinute = (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = minuteForm.mepId;
    if (!targetId) {
      showToast('Sélectionnez une MEP');
      return;
    }
    const entry: MepMinute = {
      id: editMinuteId || uid('CR'),
      mepId: targetId,
      date: minuteForm.date || `${isoToday()}T09:00`,
      type: minuteForm.type || 'Point projet',
      subject: minuteForm.subject || '',
      attendees: minuteForm.attendees || '',
      summary: minuteForm.summary || '',
      decisions: minuteForm.decisions || '',
      actions: minuteForm.actions || '',
      risks: minuteForm.risks || '',
      updatedAt: new Date().toISOString(),
    };
    const updatedMeps = db.mep.map((m) => {
      const cleaned = (m.minutes || []).filter((r) => r.id !== entry.id);
      if (m.id === targetId) {
        return { ...m, minutes: [entry, ...cleaned] };
      }
      return { ...m, minutes: cleaned };
    });
    persistDb({ ...db, mep: updatedMeps });
    setIsMinuteModalOpen(false);
    setEditMinuteId(null);
    showToast('Compte rendu enregistré');
  };

  const handleDeleteMinute = (minuteId: string) => {
    setConfirmAction({
      title: 'Supprimer ce compte rendu ?',
      message: 'Ce compte rendu de réunion sera définitivement retiré de la fiche MEP.',
      confirmLabel: 'Supprimer',
      danger: true,
      onConfirm: () => {
        const updatedMeps = db.mep.map((m) => ({
          ...m,
          minutes: (m.minutes || []).filter((r) => r.id !== minuteId),
        }));
        persistDb({ ...db, mep: updatedMeps });
        setConfirmAction(null);
        showToast('Compte rendu supprimé');
      },
    });
  };

  // Exports & Backup
  const downloadFile = (name: string, content: string, mime: string) => {
    const a = document.createElement('a');
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBackupJson = () => {
    downloadFile(`prodpilot-sauvegarde-${isoToday()}.json`, JSON.stringify(db, null, 2), 'application/json');
    showToast('Sauvegarde JSON exportée');
  };

  const handleExportCsv = () => {
    const rows: any[][] = [
      [
        'Projet',
        'MEP',
        'Application',
        'Version',
        'N° Change ServiceNow',
        'RITM',
        'Date MEP',
        'Responsable',
        'Statut',
        'Priorité',
        'Intervenants',
        'Nb comptes rendus',
        'Type action',
        'Jalon / tâche',
        'Responsable action',
        'Date début',
        'Date fin',
        'Statut action',
      ],
    ];
    db.mep.forEach((m) => {
      const tasks = m.tasks || [];
      const peopleStr = (m.people || []).map((p) => `${p.name} (${p.role})`).join(' | ');
      const minCount = (m.minutes || []).length;
      if (!tasks.length) {
        rows.push([
          m.project || 'Projet non classé',
          getMepRef(m),
          m.title,
          m.version,
          m.changeNumbers,
          m.ritmNumbers,
          m.date,
          m.owner,
          m.status,
          m.priority,
          peopleStr,
          minCount,
          '',
          '',
          '',
          '',
          '',
          '',
        ]);
      }
      tasks.forEach((t) => {
        const d = getTaskDates(m, t);
        rows.push([
          m.project || 'Projet non classé',
          getMepRef(m),
          m.title,
          m.version,
          m.changeNumbers,
          m.ritmNumbers,
          m.date,
          m.owner,
          m.status,
          m.priority,
          peopleStr,
          minCount,
          t.kind,
          t.title,
          t.assignee,
          d.start,
          d.end,
          t.status,
        ]);
      });
    });
    const csv =
      '\uFEFF' +
      rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
    downloadFile(`prodpilot-mep-${isoToday()}.csv`, csv, 'text/csv;charset=utf-8');
    showToast('Export MEP CSV généré');
  };

  const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!Array.isArray(parsed.mep)) throw new Error('Format invalide');
      const restoredMeps = parsed.mep.map((m: any) => {
        const project = clarityProjects.find((p) => p.id === m.projectId) || clarityProjects.find((p) => p.name === m.project);
        if (!project) throw new Error(`La MEP « ${m.title || m.id} » n'est liée à aucun projet Clarity existant. Réaffectez-la avant restauration.`);
        return { ...m, projectId: project.id, project: project.name, changeNumbers: m.changeNumbers || m.changeRef || '', ritmNumbers: m.ritmNumbers || '', people: m.people || [], minutes: m.minutes || [], tasks: (m.tasks || []).map(normalizeTask) };
      });
      setConfirmAction({
        title: 'Restaurer la sauvegarde ?',
        message: `Remplacer les ${db.mep.length} MEP actuelles par les ${restoredMeps.length} MEP contenues dans "${file.name}" ?`,
        confirmLabel: 'Restaurer',
        onConfirm: () => {
          persistDb({ mep: restoredMeps, kanban: [] });
          setConfirmAction(null);
          showToast('Sauvegarde restaurée');
        },
      });
    } catch {
      showToast('Fichier JSON invalide ou incompatible');
    }
  };

  // Assistant Copilot & Spreadsheet Import Handlers
  const handleAssistantFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      if (['xlsx', 'xls', 'csv'].includes(ext)) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = sheet ? XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false }).slice(0, 500) : [];
        const content = JSON.stringify({ file: file.name, sheet: sheetName, rows }, null, 2);
        setAssistantSource(content);
        setAssistantFileInfo(`${file.name} · ${rows.length} ligne(s) lues dans l'onglet « ${sheetName} » (max 500 lignes).`);
      } else {
        const content = await file.text();
        setAssistantSource(content);
        setAssistantFileInfo(`${file.name} · ${(file.size / 1024).toFixed(1)} Ko chargés.`);
      }
      setAssistantPromptText('');
      showToast('Fichier chargé. Prêt pour analyse ou prompt Copilot.');
    } catch (err: any) {
      showToast(err?.message || 'Impossible de lire le fichier');
    }
  };

  const buildCopilotPrompt = () => {
    const src = assistantSource.trim();
    if (!src) {
      showToast('Ajoutez un texte ou importez un fichier d’abord');
      return '';
    }
    const schemaExample = {
      mep: [
        {
          project: 'Nom du projet',
          title: 'Application / intitulé de la MEP',
          version: 'Version',
          date: '2026-12-15T22:00',
          owner: 'Responsable MEP',
          environment: 'Production',
          status: 'Brouillon',
          priority: 'Normale',
          goNoGo: 'En attente',
          changeNumbers: 'CHG0000000',
          ritmNumbers: 'RITM0000000',
          rollback: 'Plan de retour arrière',
          description: 'Périmètre et procédure',
          people: [{ name: 'Prénom Nom', role: 'Rôle' }],
          tasks: [
            { title: 'Validation recette', kind: 'Jalon', assignee: 'Prénom Nom', offset: -5, duration: 1, status: 'À faire', notes: '' },
          ],
        },
      ],
    };
    const prompt = `Tu es un assistant senior de gestion de mise en production et de pilotage de projets IT. Analyse les données ci-dessous et prépare toutes les fiches projet/MEP réellement identifiables.\n\nRÈGLES STRICTES :\n- N'invente aucune information, date, personne, référence ServiceNow, version ou décision.\n- Si une donnée manque, utilise une chaîne vide et signale-la dans "missingFields".\n- Conserve exactement les références CHG et RITM trouvées dans la source.\n- Distingue le nom du projet de l'application ou de l'intitulé de la MEP.\n- Convertis les dates connues en ISO 8601 local YYYY-MM-DDTHH:mm ; si l'heure est inconnue, utilise 00:00.\n- Réponds UNIQUEMENT avec un JSON valide conforme à ce schéma : ${JSON.stringify(schemaExample)}\n\nDONNÉES À ANALYSER :\n${src}`;
    setAssistantPromptText(prompt);
    setAssistantJson('');
    setAssistantParsed([]);
    setAssistantPreviewMsg(null);
    showToast('Prompt Copilot préparé');
    return prompt;
  };

  const handleCopyPrompt = async () => {
    const v = assistantPromptText || buildCopilotPrompt();
    if (!v) return;
    try {
      await navigator.clipboard.writeText(v);
      showToast('Prompt copié dans le presse-papiers');
    } catch {
      showToast('Impossible de copier automatiquement');
    }
  };

  const handleAnalyzeWithClarityAI = async () => {
    const src = assistantSource.trim();
    if (!src) {
      showToast('Ajoutez une source texte ou Excel avant l’analyse');
      return;
    }
    setIsAiParsing(true);
    try {
      const res = await fetch('/api/pm-ai/parse-mep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceText: src }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        const formatted = JSON.stringify(json.data, null, 2);
        setAssistantJson(formatted);
        previewAssistantJson(formatted);
        showToast(`Analyse terminée (${json.provider === 'GEMINI' ? 'IA Clarity Gemini' : 'Extracteur structuré'}) — vérifiez avant import`);
      } else {
        showToast(json.error || 'Échec de l’analyse');
      }
    } catch {
      showToast('Erreur de communication avec le serveur');
    } finally {
      setIsAiParsing(false);
    }
  };

  const handleConnectCopilot = async () => {
    const endpoint = copilotUrl.trim();
    if (!endpoint) {
      showToast('Renseignez le Token Endpoint Copilot Studio');
      return;
    }
    setCopilotBusy(true);
    try {
      const res = await fetch('/api/copilot/directline/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setCopilotMessages((prev) => [...prev, { role: 'system', text: data.error || 'Connexion impossible' }]);
        return;
      }
      setCopilotConnected(true);
      setCopilotMessages([
        { role: 'system', text: `Connexion établie (expiration du jeton : ${Math.round((data.expiresIn || 3600) / 60)} min).` },
        { role: 'bot', text: 'Bonjour ! Je peux analyser la source chargée et préparer les projets et MEP.' },
      ]);
      showToast('Agent Copilot connecté');
    } catch {
      setCopilotMessages((prev) => [...prev, { role: 'system', text: 'Erreur réseau lors de la connexion Copilot.' }]);
    } finally {
      setCopilotBusy(false);
    }
  };

  const handleSendCopilotMessage = async (textToSend?: string) => {
    const message = (textToSend ?? copilotInput).trim();
    if (!message || !copilotConnected) return;
    if (!textToSend) setCopilotInput('');
    setCopilotMessages((prev) => [...prev, { role: 'user', text: message }]);
    setCopilotBusy(true);
    try {
      const sendRes = await fetch('/api/copilot/directline/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message }),
      });
      const sendData = await sendRes.json();
      if (!sendRes.ok || !sendData.success) {
        setCopilotMessages((prev) => [...prev, { role: 'system', text: sendData.error || 'Envoi impossible' }]);
        return;
      }
      const seen = new Set<string>();
      let foundText = false;
      for (let i = 0; i < 18; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        const pollRes = await fetch('/api/copilot/directline/poll');
        const pollData = await pollRes.json();
        for (const a of pollData.activities || []) {
          const key = a.id || `${a.timestamp || ''}-${a.text || ''}`;
          if (seen.has(key)) continue;
          seen.add(key);
          if (a.text) {
            foundText = true;
            setCopilotMessages((prev) => [...prev, { role: 'bot', text: a.text }]);
            const cleaned = a.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
            if ((cleaned.startsWith('{') || cleaned.startsWith('[')) && /("mep"|"meps")/i.test(cleaned)) {
              try {
                JSON.parse(cleaned);
                setAssistantJson(cleaned);
                previewAssistantJson(cleaned);
                showToast('Réponse JSON reçue et prévisualisée');
              } catch {
                // ignore non-JSON
              }
            }
          }
        }
        if (foundText) break;
      }
      if (!foundText) {
        setCopilotMessages((prev) => [...prev, { role: 'system', text: 'Aucune réponse texte reçue après 18 secondes.' }]);
      }
    } finally {
      setCopilotBusy(false);
    }
  };

  const previewAssistantJson = (overrideRaw?: string) => {
    try {
      const raw = (overrideRaw ?? assistantJson)
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '');
      if (!raw) {
        setAssistantParsed([]);
        setAssistantPreviewMsg({ type: 'err', text: 'Collez un JSON valide avant de prévisualiser.' });
        return 0;
      }
      const obj = JSON.parse(raw);
      const list = Array.isArray(obj) ? obj : obj.mep || obj.meps || obj.projects || [];
      if (!Array.isArray(list) || !list.length) {
        throw new Error('Aucune MEP trouvée. Le JSON doit contenir une propriété "mep" avec un tableau.');
      }
      let validCount = 0;
      const mapped = list.map((x: any, idx: number) => {
        const projectInput = String(x.project || x.projectName || '').trim();
        const linkedProject = clarityProjects.find((p) => p.id === String(x.projectId || '') || p.name.toLowerCase() === projectInput.toLowerCase());
        const project = linkedProject?.name || projectInput;
        const projectId = linkedProject?.id || '';
        const title = String(x.title || x.application || x.name || '').trim();
        const date = String(x.date || x.mepDate || '').trim();
        const owner = String(x.owner || x.responsable || '').trim();
        const changeNumbers = String(x.changeNumbers || x.change || x.changeRef || '').trim();
        const ritmNumbers = String(x.ritmNumbers || x.ritm || '').trim();
        const missing: string[] = [];
        if (!project || !projectId) missing.push('projet Clarity existant (sélectionner un projet du portefeuille)');
        if (!title) missing.push('intitulé');
        if (!date) missing.push('date MEP');
        if (!owner) missing.push('responsable');
        if (date && isNaN(new Date(date).getTime())) missing.push('date invalide');
        const duplicate = db.mep.some(
          (m) =>
            m.project.toLowerCase() === project.toLowerCase() &&
            m.title.toLowerCase() === title.toLowerCase() &&
            dayStr(m.date) === dayStr(date)
        );
        if (!missing.length) validCount++;
        return {
          ...x,
          _index: idx + 1,
          project,
          projectId,
          title,
          date,
          owner,
          changeNumbers,
          ritmNumbers,
          missing,
          duplicate,
        };
      });
      setAssistantParsed(mapped);
      setAssistantPreviewMsg({
        type: validCount > 0 ? 'ok' : 'err',
        text: `${validCount} MEP prête(s) sur ${mapped.length}. Les doublons potentiels sont signalés.`,
      });
      return validCount;
    } catch (err: any) {
      setAssistantParsed([]);
      setAssistantPreviewMsg({
        type: 'err',
        text: err?.message || 'JSON invalide. Vérifiez le format.',
      });
      return 0;
    }
  };

  const handleImportAssistantMeps = () => {
    const ready = assistantParsed.filter((x) => !x.missing?.length);
    if (!ready.length) {
      showToast('Aucune MEP complète à créer');
      return;
    }
    let created = 0;
    let duplicates = 0;
    const newEntries: MepEntry[] = [];
    ready.forEach((x) => {
      if (x.duplicate) {
        duplicates++;
        return;
      }
      const id = uid('MEP');
      const date = x.date.length === 10 ? `${x.date}T00:00` : x.date;
      newEntries.push({
        id,
        ref: `MEP-${id.slice(-5)}`,
        projectId: x.projectId,
        project: x.project,
        title: x.title,
        version: String(x.version || ''),
        date,
        owner: x.owner,
        environment: ['Production', 'Préproduction', 'Recette'].includes(x.environment) ? x.environment : 'Production',
        status: MEP_STATUSES.includes(x.status) ? x.status : 'Brouillon',
        priority: ['Critique', 'Haute', 'Normale', 'Basse'].includes(x.priority) ? x.priority : 'Normale',
        goNoGo: ['GO', 'NO-GO', 'En attente'].includes(x.goNoGo) ? x.goNoGo : 'En attente',
        changeNumbers: x.changeNumbers,
        ritmNumbers: x.ritmNumbers,
        rollback: String(x.rollback || ''),
        description: String(x.description || ''),
        people: Array.isArray(x.people)
          ? x.people.filter((p: any) => p.name).map((p: any) => ({ name: String(p.name), role: String(p.role || '') }))
          : [],
        tasks: Array.isArray(x.tasks) && x.tasks.length ? x.tasks.map(normalizeTask) : createDefaultTasks(),
        minutes: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      created++;
    });
    if (created > 0) {
      persistDb({ ...db, mep: [...newEntries, ...db.mep] });
      setPage('mep');
    }
    showToast(`${created} MEP créée(s) · ${duplicates} doublon(s) ignoré(s)`);
  };

  // Reporting computed values
  const reportStats = useMemo(() => {
    const m = db.mep;
    const today = isoToday();
    const done = m.filter((x) => ['Réussie', 'Échec'].includes(x.status));
    const success = done.filter((x) => x.status === 'Réussie').length;
    const completeTasks = allTasks.filter((t) => t.status === 'Terminé').length;
    const lateTasks = allTasks.filter((t) => t.end < today && t.status !== 'Terminé').length;
    const minutesCount = m.reduce((sum, x) => sum + (x.minutes || []).length, 0);
    const successPct = done.length ? Math.round((success / done.length) * 100) : 0;
    const tasksPct = allTasks.length ? Math.round((completeTasks / allTasks.length) * 100) : 0;
    const statusMap: Record<string, number> = {};
    m.forEach((x) => {
      statusMap[x.status] = (statusMap[x.status] || 0) + 1;
    });

    return {
      totalMep: m.length,
      doneCount: done.length,
      successCount: success,
      successPct,
      totalTasks: allTasks.length,
      completeTasks,
      lateTasks,
      tasksPct,
      projectsCount: projectNames.length,
      minutesCount,
      inProgressCount: m.filter((x) => x.status === 'En cours').length,
      atRiskCount: m.filter((x) => isLateMep(x) || x.priority === 'Critique' || x.goNoGo === 'NO-GO').length,
      statusEntries: Object.entries(statusMap),
    };
  }, [db.mep, allTasks, projectNames]);

  const navItems: { id: ProdPilotPage; label: string; icon: any; badge?: string | number }[] = [
    { id: 'dashboard', label: 'Vue générale', icon: LayoutDashboard },
    { id: 'mep', label: 'Mises en production', icon: Rocket, badge: db.mep.length },
    { id: 'kanban', label: 'Kanban', icon: FolderKanban },
    { id: 'planning', label: 'Planning & calendrier', icon: CalendarIcon },
    { id: 'reports', label: 'Reporting', icon: BarChart3 },
    { id: 'minutes', label: 'Comptes rendus', icon: FileText },
    { id: 'assistant', label: 'Assistant Copilot', icon: Sparkles, badge: 'IA' },
    { id: 'settings', label: 'Paramètres & sauvegarde', icon: Settings },
  ];

  if (!mepLoaded) return <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-sm text-slate-500"><span>{mepLoadError || 'Chargement des MEP depuis PostgreSQL…'}</span>{mepLoadError && <button onClick={() => window.location.reload()} className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold">Réessayer</button>}</div>;

  return (
    <div className="space-y-5">
      {/* Clarity-Styled ProdPilot Workspace Header & Navigation Strip */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white flex items-center justify-center font-black shadow-sm shrink-0">
              <Rocket className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <span>Production Control</span>
                <span>·</span>
                <span className="capitalize">
                  {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                Pilotage des Mises en Production
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            <button
              onClick={handleBackupJson}
              className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exporter JSON</span>
            </button>
            <button
              onClick={() => openMepForm(null)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Programmer une MEP</span>
            </button>
          </div>
        </div>

        {/* Sub-Navigation Segmented Bar */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto scrollbar-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = page === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-white text-indigo-700 shadow-xs ring-1 ring-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-indigo-600' : 'text-slate-500'}`} />
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono tabular-nums ${
                      active ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-200/80 text-slate-600'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* =====================================================================
          1. DASHBOARD (VUE GÉNÉRALE)
         ===================================================================== */}
      {page === 'dashboard' && (
        <div className="space-y-6">
          {/* Welcome Banner */}
          <div className="bg-gradient-to-r from-indigo-50 via-white to-sky-50 border border-indigo-100 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider mb-1">
                Centre de Commandement Production
              </div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">
                Bonjour {currentUser.displayName}, votre production sous contrôle.
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                Suivi des MEP, des Changes ServiceNow associés, des équipes intervenantes et des jalons planifiés.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleBackupJson}
                className="px-4 py-2 bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exporter le rapport</span>
              </button>
            </div>
          </div>

          {/* 4 KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
              <div className="flex items-center justify-between text-xs font-bold text-indigo-700">
                <span>MEP ouvertes</span>
                <Rocket className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-3xl font-black text-slate-900 font-mono tabular-nums mt-3">
                {dashboardStats.activeCount}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Déploiements à piloter</div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
              <div className="flex items-center justify-between text-xs font-bold text-sky-700">
                <span>MEP à venir</span>
                <CalendarIcon className="w-4 h-4 text-sky-600" />
              </div>
              <div className="text-3xl font-black text-slate-900 font-mono tabular-nums mt-3">
                {dashboardStats.upcomingCount}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Fenêtres planifiées</div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
              <div className="flex items-center justify-between text-xs font-bold text-amber-700">
                <span>Tâches en retard</span>
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-3xl font-black text-slate-900 font-mono tabular-nums mt-3">
                {dashboardStats.lateTasksCount}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Jalons ou tâches à traiter</div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
              <div className="flex items-center justify-between text-xs font-bold text-rose-700">
                <span>MEP à risque</span>
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              </div>
              <div className="text-3xl font-black text-slate-900 font-mono tabular-nums mt-3">
                {dashboardStats.risks.length}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Critiques, hautes ou en retard</div>
            </div>
          </div>

          {/* Row 1: Portefeuille MEP Donut + Points de vigilance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Portefeuille MEP</h3>
                  <p className="text-xs text-slate-500">Répartition par statut</p>
                </div>
                <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg">
                  Stockage local
                </span>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-6 py-2">
                <div
                  className="w-36 h-36 rounded-full grid place-items-center relative shrink-0 bg-slate-100"
                  style={dashboardStats.donutGradient ? { background: dashboardStats.donutGradient } : undefined}
                >
                  <div className="w-24 h-24 rounded-full bg-white flex flex-col items-center justify-center shadow-inner">
                    <span className="text-2xl font-black text-slate-900 font-mono tabular-nums">
                      {db.mep.length}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">MEP</span>
                  </div>
                </div>
                <div className="flex-1 w-full space-y-2.5">
                  {dashboardStats.statusCounts.length === 0 ? (
                    <div className="text-xs text-slate-400 text-center py-6">Aucune MEP enregistrée</div>
                  ) : (
                    dashboardStats.statusCounts.map((item) => (
                      <div key={item.status} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-slate-700 font-medium">
                          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: item.color }} />
                          <span>{item.status}</span>
                        </div>
                        <span className="font-bold font-mono tabular-nums text-slate-900">{item.count}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Points de vigilance</h3>
                  <p className="text-xs text-slate-500">Retards, No-Go et priorités opérationnelles</p>
                </div>
                <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg">
                  À surveiller
                </span>
              </div>
              <div className="divide-y divide-slate-100">
                {dashboardStats.risks.length === 0 ? (
                  <div className="text-xs text-slate-400 text-center py-8">Aucun point de vigilance identifié.</div>
                ) : (
                  dashboardStats.risks.slice(0, 5).map((x) => (
                    <div key={x.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate">{x.title}</div>
                          <div className="text-[11px] text-slate-500">
                            {getMepRef(x)} · {x.changeNumbers || 'Change non renseigné'}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-rose-700 whitespace-nowrap shrink-0">
                        {isLateMep(x) ? 'En retard' : x.goNoGo === 'NO-GO' ? 'NO-GO' : x.priority}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Row 2: Prochaines échéances + Avancement des tâches */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Prochaines échéances</h3>
                  <p className="text-xs text-slate-500">MEP et tâches à venir</p>
                </div>
                <button
                  onClick={() => setPage('planning')}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                >
                  <span>Tout voir</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="divide-y divide-slate-100">
                {dashboardStats.nextDeadlines.length === 0 ? (
                  <div className="text-xs text-slate-400 text-center py-8">Aucune échéance enregistrée.</div>
                ) : (
                  dashboardStats.nextDeadlines.map((item) => (
                    <div key={`${item.label}-${item.id}`} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">{item.title}</div>
                        <div className="text-[11px] text-slate-500">
                          {item.label} · {item.ref} · {item.owner || 'Non affecté'}
                        </div>
                      </div>
                      <span className="text-[11px] font-mono tabular-nums text-slate-600 whitespace-nowrap shrink-0">
                        {fmtDate(item.date)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Avancement des tâches</h3>
                  <p className="text-xs text-slate-500">Progression du plan de production</p>
                </div>
                <button
                  onClick={() => setPage('kanban')}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                >
                  <span>Ouvrir Kanban</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-4 pt-2">
                {dashboardStats.colCounts.map((c, idx) => {
                  const pct = Math.round((c.count / dashboardStats.maxColCount) * 100);
                  const barColors = ['bg-indigo-500', 'bg-sky-500', 'bg-amber-500', 'bg-emerald-500'];
                  return (
                    <div key={c.col} className="grid grid-cols-[100px_1fr_32px] items-center gap-3 text-xs">
                      <span className="font-semibold text-slate-700">{c.col}</span>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className={`h-full rounded-full ${barColors[idx]}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-right font-mono tabular-nums font-bold text-slate-900">{c.count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Row 3: MEP récemment modifiées */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">MEP récemment modifiées</h3>
              <p className="text-xs text-slate-500">Dernières créations et mises à jour</p>
            </div>
            <div className="divide-y divide-slate-100">
              {dashboardStats.recentMeps.length === 0 ? (
                <div className="text-xs text-slate-400 text-center py-6">Aucune activité récente.</div>
              ) : (
                dashboardStats.recentMeps.map((x) => (
                  <div key={x.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">{x.title}</div>
                      <div className="text-[11px] text-slate-500">
                        {getMepRef(x)} · {x.project} · Change {x.changeNumbers || '—'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${getStatusBadgeClasses(x.status)}`}>
                        {x.status}
                      </span>
                      <button
                        onClick={() => openMepForm(x.id)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 cursor-pointer"
                        title="Modifier"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          2. MISES EN PRODUCTION (TABLE + FILTERS + CRUD)
         ===================================================================== */}
      {page === 'mep' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-black text-slate-900">Registre des Mises en production</h3>
              <p className="text-xs text-slate-500">
                Une fiche MEP centralise le Change ServiceNow, les intervenants, les jalons et les tâches.
              </p>
            </div>
            <button
              onClick={() => openMepForm(null)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Programmer une MEP</span>
            </button>
          </div>

          {/* Toolbar */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="relative lg:col-span-2">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={mepSearch}
                onChange={(e) => setMepSearch(e.target.value)}
                placeholder="Rechercher MEP, Change, application, responsable…"
                className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <select
              value={mepStatusFilter}
              onChange={(e) => setMepStatusFilter(e.target.value)}
              className="text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 font-medium cursor-pointer"
            >
              <option value="">Tous les statuts</option>
              {MEP_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <select
              value={mepPriorityFilter}
              onChange={(e) => setMepPriorityFilter(e.target.value)}
              className="text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 font-medium cursor-pointer"
            >
              <option value="">Toutes priorités</option>
              <option value="Critique">Critique</option>
              <option value="Haute">Haute</option>
              <option value="Normale">Normale</option>
              <option value="Basse">Basse</option>
            </select>

            <select
              value={mepDateFilter}
              onChange={(e) => setMepDateFilter(e.target.value)}
              className="text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 font-medium cursor-pointer"
            >
              <option value="">Toutes les dates</option>
              <option value="future">À venir</option>
              <option value="past">Passées</option>
            </select>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="p-3.5">Réf MEP</th>
                    <th className="p-3.5">Projet</th>
                    <th className="p-3.5">Application / Version</th>
                    <th className="p-3.5">N° Change SNOW</th>
                    <th className="p-3.5">Fenêtre MEP</th>
                    <th className="p-3.5">Responsable</th>
                    <th className="p-3.5">Équipe</th>
                    <th className="p-3.5">Avancement</th>
                    <th className="p-3.5">Statut</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMeps.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-10 text-center text-slate-400">
                        Aucune MEP correspondante. Programmez votre première mise en production.
                      </td>
                    </tr>
                  ) : (
                    filteredMeps.map((x) => {
                      const pct = getMepProgress(x);
                      return (
                        <tr key={x.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3.5 font-mono font-bold text-indigo-700 whitespace-nowrap">
                            {getMepRef(x)}
                          </td>
                          <td className="p-3.5 text-slate-700 font-medium max-w-[180px] truncate">
                            {x.project || 'Projet non classé'}
                          </td>
                          <td className="p-3.5">
                            <div className="font-bold text-slate-900">{x.title}</div>
                            <div className="text-[11px] text-slate-500">
                              {x.version || 'Version non précisée'} · {x.environment}
                            </div>
                          </td>
                          <td className="p-3.5">
                            <div className="font-mono font-semibold text-sky-700">{x.changeNumbers || '—'}</div>
                            {x.ritmNumbers && (
                              <div className="text-[11px] font-mono text-slate-500">RITM : {x.ritmNumbers}</div>
                            )}
                          </td>
                          <td className="p-3.5 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                            {fmtDate(x.date)}
                          </td>
                          <td className="p-3.5 text-slate-800 font-medium">{x.owner}</td>
                          <td className="p-3.5 text-slate-600 font-mono tabular-nums whitespace-nowrap">
                            {(x.people || []).length} pers.
                          </td>
                          <td className="p-3.5 min-w-[120px]">
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-1">
                              <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <div className="text-[10px] font-mono tabular-nums text-slate-500">
                              {pct}% · {(x.tasks || []).length} actions
                            </div>
                          </td>
                          <td className="p-3.5 whitespace-nowrap">
                            <span
                              className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getStatusBadgeClasses(
                                x.status
                              )}`}
                            >
                              {x.status}
                            </span>
                          </td>
                          <td className="p-3.5 text-right whitespace-nowrap space-x-1">
                            <button
                              onClick={() => openMepForm(x.id)}
                              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 cursor-pointer"
                              title="Modifier"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteMep(x)}
                              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 hover:text-rose-700 text-slate-600 cursor-pointer"
                              title="Supprimer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          3. KANBAN DE PRODUCTION
         ===================================================================== */}
      {page === 'kanban' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-black text-slate-900">Kanban de production</h3>
              <p className="text-xs text-slate-500">
                Faites avancer les tâches et jalons par glisser-déposer ou changement rapide.
              </p>
            </div>
            <button
              onClick={() => {
                if (!db.mep.length) {
                  showToast('Créez une MEP avant ses tâches');
                  return;
                }
                openMepForm(db.mep[0].id, true);
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Nouvelle tâche</span>
            </button>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <label className="text-xs font-bold text-slate-700">Projet :</label>
              <select
                value={kanbanProjectFilter}
                onChange={(e) => setKanbanProjectFilter(e.target.value)}
                className="text-xs px-3 py-1.5 rounded-xl border border-slate-300 bg-white font-semibold text-slate-800 cursor-pointer"
              >
                <option value="">Tous les projets</option>
                {projectNames.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <span className="text-xs text-slate-500 hidden sm:inline">
                {kanbanProjectFilter ? `Vue du projet : ${kanbanProjectFilter}` : 'Vue consolidée de tous les projets'}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {KANBAN_COLUMNS.map((col) => {
                const count = allTasks
                  .filter((t) => !kanbanProjectFilter || t.mep.project === kanbanProjectFilter)
                  .filter((t) => t.status === col).length;
                return (
                  <span
                    key={col}
                    className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600"
                  >
                    {col} <strong className="text-slate-900 font-mono tabular-nums ml-1">{count}</strong>
                  </span>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {KANBAN_COLUMNS.map((col) => {
              const cards = allTasks
                .filter((t) => !kanbanProjectFilter || t.mep.project === kanbanProjectFilter)
                .filter((t) => t.status === col);
              return (
                <div
                  key={col}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const taskId = e.dataTransfer.getData('text/plain');
                    if (taskId) handleMoveKanbanTask(taskId, col);
                  }}
                  className="bg-slate-100/80 border border-slate-200 rounded-2xl p-3 min-h-[380px] flex flex-col"
                >
                  <div className="flex items-center justify-between px-1 pb-3">
                    <span className="text-xs font-black text-slate-800">{col}</span>
                    <span className="px-2 py-0.5 rounded-full bg-white text-slate-700 font-mono tabular-nums text-[11px] font-bold border border-slate-200">
                      {cards.length}
                    </span>
                  </div>

                  <div className="space-y-2.5 flex-1">
                    {cards.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-300 rounded-xl bg-white/40">
                        Aucune tâche dans cette colonne
                      </div>
                    ) : (
                      cards.map((t) => (
                        <div
                          key={t.id}
                          draggable
                          onDragStart={(e) => e.dataTransfer.setData('text/plain', t.id)}
                          className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs hover:border-indigo-300 transition-all cursor-grab active:cursor-grabbing space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2 text-[10px]">
                            <span
                              className={`font-bold px-2 py-0.5 rounded-md ${
                                t.kind === 'Jalon' ? 'bg-sky-50 text-sky-700' : 'bg-amber-50 text-amber-800'
                              }`}
                            >
                              {t.kind}
                            </span>
                            <span className="text-indigo-700 font-semibold truncate max-w-[140px]">
                              {t.mep.project}
                            </span>
                          </div>
                          <div className="text-xs font-bold text-slate-900 leading-snug">{t.title}</div>
                          <div className="text-[11px] text-slate-500">
                            {t.mep.title} · {t.assignee || t.mep.owner || 'Non affecté'}
                          </div>
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-[10px] text-slate-500 font-mono tabular-nums">
                            <span>{fmtDate(t.start)}</span>
                            <select
                              value={t.status}
                              onChange={(e) => handleMoveKanbanTask(t.id, e.target.value as MepTaskStatus)}
                              className="font-sans bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-[10px] text-slate-700 font-semibold cursor-pointer"
                            >
                              {KANBAN_COLUMNS.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =====================================================================
          4. PLANNING & CALENDRIER
         ===================================================================== */}
      {page === 'planning' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-black text-slate-900">Planning opérationnel</h3>
              <p className="text-xs text-slate-500">
                Calendrier des MEP, jalons et tâches calculés automatiquement à partir de la date MEP.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setCalendarDate(new Date());
                  setSelectedDate(isoToday());
                }}
                className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold cursor-pointer"
              >
                Aujourd'hui
              </button>
              <button
                onClick={() => openMepForm(null)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Ajouter une MEP</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))
                  }
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-700" />
                </button>
                <h4 className="text-sm font-black text-slate-900 capitalize min-w-[150px] text-center">
                  {calendarDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                </h4>
                <button
                  onClick={() =>
                    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))
                  }
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4 text-slate-700" />
                </button>
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-600 font-medium">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" /> MEP
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-500" /> Jalon
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Tâche
                </span>
              </div>
            </div>

            <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200 text-center text-[11px] font-bold text-slate-500 py-2">
              {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {calendarDays.map((cell) => {
                const isToday = cell.key === isoToday();
                const isSelected = cell.key === selectedDate;
                return (
                  <div
                    key={cell.key}
                    onClick={() => setSelectedDate(cell.key)}
                    className={`min-h-[96px] p-1.5 border-r border-b border-slate-100 cursor-pointer transition-colors ${
                      !cell.isCurrentMonth ? 'bg-slate-50/70 text-slate-400' : 'bg-white'
                    } ${isSelected ? 'ring-2 ring-inset ring-indigo-500 bg-indigo-50/30' : 'hover:bg-slate-50'}`}
                  >
                    <div
                      className={`text-[11px] font-mono font-bold mb-1 w-6 h-6 rounded-full flex items-center justify-center ${
                        isToday ? 'bg-indigo-600 text-white' : ''
                      }`}
                    >
                      {cell.dayNum}
                    </div>
                    <div className="space-y-1">
                      {cell.items.slice(0, 3).map((ev, idx) => (
                        <div
                          key={idx}
                          className={`text-[10px] px-1.5 py-0.5 rounded truncate font-medium ${
                            ev.type === 'mep'
                              ? 'bg-indigo-100 text-indigo-800'
                              : ev.type === 'milestone'
                              ? 'bg-sky-100 text-sky-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {ev.title}
                        </div>
                      ))}
                      {cell.items.length > 3 && (
                        <div className="text-[10px] text-slate-500 font-semibold px-1">
                          +{cell.items.length - 3} autres
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Day Details */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div>
              <h4 className="text-sm font-bold text-slate-900 capitalize">
                Échéances du {new Date(`${selectedDate}T12:00`).toLocaleDateString('fr-FR', { dateStyle: 'full' })}
              </h4>
              <p className="text-xs text-slate-500">MEP, jalons et tâches programmés à cette date</p>
            </div>
            <div className="divide-y divide-slate-100">
              {calendarEvents.filter((x) => x.date === selectedDate).length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  Aucune opération programmée à cette date.
                </div>
              ) : (
                calendarEvents
                  .filter((x) => x.date === selectedDate)
                  .map((ev, idx) => (
                    <div key={idx} className="py-2.5 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-slate-900">{ev.title}</div>
                        <div className="text-[11px] text-slate-500">
                          {ev.type === 'mep' ? 'MEP' : ev.type === 'milestone' ? 'Jalon' : 'Tâche'} · {getMepRef(ev.mep)} ·{' '}
                          {ev.owner || 'Non affecté'}
                        </div>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getStatusBadgeClasses(
                          ev.status
                        )}`}
                      >
                        {ev.status}
                      </span>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          5. REPORTING MEP
         ===================================================================== */}
      {page === 'reports' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-black text-slate-900">Reporting MEP</h3>
              <p className="text-xs text-slate-500">
                Indicateurs de réalisation, avancement et respect du planning.
              </p>
            </div>
            <button
              onClick={handleExportCsv}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <Download className="w-4 h-4" />
              <span>Exporter le rapport CSV</span>
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              ['Total MEP', reportStats.totalMep],
              ['Taux de succès', reportStats.doneCount ? `${reportStats.successPct}%` : '—'],
              ['Tâches terminées', `${reportStats.completeTasks}/${reportStats.totalTasks}`],
              ['Tâches en retard', reportStats.lateTasks],
              ['Projets suivis', reportStats.projectsCount],
              ['Comptes rendus', reportStats.minutesCount],
              ['MEP en cours', reportStats.inProgressCount],
              ['MEP à risque', reportStats.atRiskCount],
            ].map(([label, val]) => (
              <div key={String(label)} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
                <div className="text-[11px] font-semibold text-slate-500">{label}</div>
                <div className="text-2xl font-black text-slate-900 font-mono tabular-nums mt-1.5">{val}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Qualité des déploiements</h4>
                <p className="text-xs text-slate-500">MEP réussies vs échecs</p>
              </div>
              <div className="flex items-center gap-6">
                <div
                  className="w-28 h-28 rounded-full grid place-items-center relative shrink-0"
                  style={{
                    background: `conic-gradient(#10b981 ${reportStats.successPct}%, #fda4af 0)`,
                  }}
                >
                  <div className="w-20 h-20 rounded-full bg-white grid place-items-center font-black text-lg font-mono tabular-nums text-slate-900">
                    {reportStats.successPct}%
                  </div>
                </div>
                <div className="space-y-1.5 text-xs text-slate-600">
                  <div>
                    Réussies : <strong className="text-slate-900 font-mono">{reportStats.successCount}</strong>
                  </div>
                  <div>
                    Échecs :{' '}
                    <strong className="text-slate-900 font-mono">
                      {reportStats.doneCount - reportStats.successCount}
                    </strong>
                  </div>
                  <div>
                    Non clôturées :{' '}
                    <strong className="text-slate-900 font-mono">
                      {reportStats.totalMep - reportStats.doneCount}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Avancement du plan</h4>
                <p className="text-xs text-slate-500">Tâches et jalons terminés</p>
              </div>
              <div className="flex items-center gap-6">
                <div
                  className="w-28 h-28 rounded-full grid place-items-center relative shrink-0"
                  style={{
                    background: `conic-gradient(#4f46e5 ${reportStats.tasksPct}%, #e2e8f0 0)`,
                  }}
                >
                  <div className="w-20 h-20 rounded-full bg-white grid place-items-center font-black text-lg font-mono tabular-nums text-slate-900">
                    {reportStats.tasksPct}%
                  </div>
                </div>
                <div className="space-y-1.5 text-xs text-slate-600">
                  <div>
                    Terminées : <strong className="text-slate-900 font-mono">{reportStats.completeTasks}</strong>
                  </div>
                  <div>
                    À faire / en cours :{' '}
                    <strong className="text-slate-900 font-mono">
                      {reportStats.totalTasks - reportStats.completeTasks}
                    </strong>
                  </div>
                  <div>
                    En retard : <strong className="text-rose-700 font-mono">{reportStats.lateTasks}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <h4 className="text-sm font-bold text-slate-900">Synthèse par statut</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {reportStats.statusEntries.length === 0 ? (
                <div className="col-span-4 text-xs text-slate-400">Aucune donnée disponible.</div>
              ) : (
                reportStats.statusEntries.map(([k, v]) => (
                  <div
                    key={k}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                  >
                    <span className="font-medium text-slate-700">{k}</span>
                    <strong className="font-mono tabular-nums text-slate-900">{v}</strong>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Analyse détaillée par projet */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-200">
              <h4 className="text-sm font-bold text-slate-900">Analyse détaillée par projet</h4>
              <p className="text-xs text-slate-500">Charge, avancement, retards, succès et comptes rendus</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase">
                  <tr>
                    <th className="p-3.5">Projet</th>
                    <th className="p-3.5">MEP</th>
                    <th className="p-3.5">Réussite</th>
                    <th className="p-3.5">Tâches</th>
                    <th className="p-3.5">Terminées</th>
                    <th className="p-3.5">En retard</th>
                    <th className="p-3.5">Comptes rendus</th>
                    <th className="p-3.5">Avancement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {projectNames.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        Aucun projet à analyser.
                      </td>
                    </tr>
                  ) : (
                    projectNames.map((name) => {
                      const pm = db.mep.filter((x) => (x.project || 'Projet non classé') === name);
                      const pt = allTasks.filter((t) => (t.mep.project || 'Projet non classé') === name);
                      const pd = pt.filter((t) => t.status === 'Terminé').length;
                      const pl = pt.filter((t) => t.end < isoToday() && t.status !== 'Terminé').length;
                      const ps = pm.filter((x) => x.status === 'Réussie').length;
                      const pc = pm.reduce((n, x) => n + (x.minutes || []).length, 0);
                      const pr = pt.length ? Math.round((pd / pt.length) * 100) : 0;
                      return (
                        <tr key={name} className="hover:bg-slate-50">
                          <td className="p-3.5 font-bold text-slate-900">{name}</td>
                          <td className="p-3.5 font-mono tabular-nums">{pm.length}</td>
                          <td className="p-3.5 font-mono tabular-nums">
                            {ps}/{pm.length}
                          </td>
                          <td className="p-3.5 font-mono tabular-nums">{pt.length}</td>
                          <td className="p-3.5 font-mono tabular-nums">{pd}</td>
                          <td className="p-3.5 font-mono tabular-nums">
                            {pl ? (
                              <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold border border-rose-200">
                                {pl}
                              </span>
                            ) : (
                              '0'
                            )}
                          </td>
                          <td className="p-3.5 font-mono tabular-nums">{pc}</td>
                          <td className="p-3.5 min-w-[110px]">
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-1">
                              <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${pr}%` }} />
                            </div>
                            <span className="text-[10px] font-mono tabular-nums text-slate-500">{pr}%</span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Registre détaillé des MEP */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-200">
              <h4 className="text-sm font-bold text-slate-900">Registre détaillé des MEP</h4>
              <p className="text-xs text-slate-500">État, références ServiceNow, responsables et points de vigilance</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase">
                  <tr>
                    <th className="p-3.5">MEP / Projet</th>
                    <th className="p-3.5">Date</th>
                    <th className="p-3.5">Change(s)</th>
                    <th className="p-3.5">Responsable</th>
                    <th className="p-3.5">Statut</th>
                    <th className="p-3.5">Tâches en retard</th>
                    <th className="p-3.5">CR</th>
                    <th className="p-3.5">Avancement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {db.mep
                    .slice()
                    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
                    .map((x) => {
                      const overdue = (x.tasks || []).filter(
                        (t) => getTaskDates(x, t).end < isoToday() && t.status !== 'Terminé'
                      ).length;
                      const pct = getMepProgress(x);
                      return (
                        <tr key={x.id} className="hover:bg-slate-50">
                          <td className="p-3.5">
                            <div className="font-mono font-bold text-indigo-700">{getMepRef(x)}</div>
                            <div className="text-[11px] text-slate-500">
                              {x.project} · {x.title}
                            </div>
                          </td>
                          <td className="p-3.5 font-mono tabular-nums whitespace-nowrap">{fmtDate(x.date)}</td>
                          <td className="p-3.5 font-mono text-sky-700">{x.changeNumbers || '—'}</td>
                          <td className="p-3.5">{x.owner || '—'}</td>
                          <td className="p-3.5">
                            <span
                              className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getStatusBadgeClasses(
                                x.status
                              )}`}
                            >
                              {x.status}
                            </span>
                          </td>
                          <td className="p-3.5 font-mono tabular-nums">
                            {overdue ? (
                              <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold border border-rose-200">
                                {overdue}
                              </span>
                            ) : (
                              '0'
                            )}
                          </td>
                          <td className="p-3.5 font-mono tabular-nums">{(x.minutes || []).length}</td>
                          <td className="p-3.5 min-w-[110px]">
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-1">
                              <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-[10px] font-mono tabular-nums text-slate-500">{pct}%</span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          6. COMPTES RENDUS
         ===================================================================== */}
      {page === 'minutes' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-black text-slate-900">Comptes rendus de réunion</h3>
              <p className="text-xs text-slate-500">
                Historique des réunions, décisions, actions et risques associés à chaque MEP.
              </p>
            </div>
            <button
              onClick={() => openMinuteModal(null)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Nouveau compte rendu</span>
            </button>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={minuteSearch}
                onChange={(e) => setMinuteSearch(e.target.value)}
                placeholder="Rechercher projet, MEP, réunion, décision…"
                className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <select
              value={minuteProjectFilter}
              onChange={(e) => setMinuteProjectFilter(e.target.value)}
              className="text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 font-semibold cursor-pointer"
            >
              <option value="">Tous les projets</option>
              {projectNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          {(() => {
            const q = minuteSearch.toLowerCase().trim();
            const items = db.mep
              .flatMap((m) => (m.minutes || []).map((r) => ({ ...r, mep: m })))
              .filter((r) => {
                const matchProj = !minuteProjectFilter || r.mep.project === minuteProjectFilter;
                const matchQ =
                  !q ||
                  [r.subject, r.summary, r.decisions, r.actions, r.risks, r.mep.title, r.mep.project, getMepRef(r.mep)]
                    .join(' ')
                    .toLowerCase()
                    .includes(q);
                return matchProj && matchQ;
              })
              .sort((a, b) => String(b.date).localeCompare(String(a.date)));

            if (!items.length) {
              return (
                <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-xs text-slate-400">
                  Aucun compte rendu enregistré. Ajoutez un CR depuis une réunion ou une MEP.
                </div>
              );
            }

            return (
              <div className="space-y-4">
                {items.map((r) => (
                  <article key={r.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                    <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-100">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="font-bold text-indigo-700">{r.mep.project}</span>
                          <span className="text-slate-300">·</span>
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold">
                            {r.type || 'Point projet'}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900">
                          {r.subject || 'Compte rendu sans objet'}
                        </h4>
                        <div className="text-xs text-slate-500">
                          {fmtDate(r.date)} · {getMepRef(r.mep)} · {r.mep.title}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => openMinuteModal(r.id)}
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 cursor-pointer"
                          title="Modifier"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteMinute(r.id)}
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 hover:text-rose-700 text-slate-600 cursor-pointer"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      {[
                        ['Synthèse', r.summary],
                        ['Participants', r.attendees],
                        ['Décisions', r.decisions],
                        ['Actions', r.actions],
                        ['Risques', r.risks],
                      ]
                        .filter(([, val]) => Boolean(val))
                        .map(([lbl, val]) => (
                          <div key={lbl} className="space-y-1">
                            <div className="font-bold text-indigo-700">{lbl}</div>
                            <p className="text-slate-600 whitespace-pre-line leading-relaxed">{val}</p>
                          </div>
                        ))}
                    </div>
                  </article>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* =====================================================================
          7. ASSISTANT COPILOT & IMPORT EXCEL/TEXTE
         ===================================================================== */}
      {page === 'assistant' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-black text-slate-900">Assistant Copilot & Import Contrôlé</h3>
              <p className="text-xs text-slate-500">
                Préparez des projets et des MEP depuis un texte ou un classeur Excel, puis validez les données avant import.
              </p>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold border ${
                copilotConnected
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              {copilotConnected ? 'Agent Copilot connecté' : 'IA Clarity intégrée prête'}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Step 1: Source */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div>
                <h4 className="text-sm font-bold text-slate-900">1. Source à analyser</h4>
                <p className="text-xs text-slate-500">Collez un texte ou importez un fichier Excel, CSV, TXT ou JSON.</p>
              </div>

              <label className="border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/40 rounded-2xl p-6 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors">
                <FileSpreadsheet className="w-7 h-7 text-indigo-600" />
                <span className="text-xs font-bold text-slate-800">Importer un fichier</span>
                <span className="text-[11px] text-slate-500">.xlsx · .xls · .csv · .txt · .json</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,.txt,.json"
                  className="hidden"
                  onChange={handleAssistantFileUpload}
                />
              </label>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Texte / contenu à analyser
                </label>
                <textarea
                  rows={7}
                  value={assistantSource}
                  onChange={(e) => setAssistantSource(e.target.value)}
                  placeholder="Collez ici un mail, un compte rendu, un descriptif projet ou des lignes de planning…"
                  className="w-full p-3 text-xs font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    setAssistantSource('');
                    setAssistantJson('');
                    setAssistantFileInfo('Aucun fichier chargé.');
                    setAssistantPromptText('');
                    setAssistantParsed([]);
                    setAssistantPreviewMsg(null);
                  }}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Effacer
                </button>
                <button
                  onClick={buildCopilotPrompt}
                  className="px-3.5 py-2 bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Préparer le prompt Copilot
                </button>
                <button
                  onClick={handleAnalyzeWithClarityAI}
                  disabled={isAiParsing}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ml-auto"
                >
                  {isAiParsing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>Analyser automatiquement</span>
                </button>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
                {assistantFileInfo}
              </div>
            </div>

            {/* Step 2: Microsoft Copilot Studio */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">2. Microsoft Copilot Studio</h4>
                  <p className="text-xs text-slate-500">Connexion optionnelle à votre agent Direct Line.</p>
                </div>
                <Sparkles className="w-4 h-4 text-indigo-600" />
              </div>

              {!copilotConnected ? (
                <div className="space-y-3">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Renseignez le <strong>Token Endpoint</strong> de votre agent Copilot Studio (canal Application mobile). Les réponses JSON seront automatiquement envoyées vers la zone de validation ci-dessous.
                  </p>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">Token Endpoint Copilot Studio</label>
                    <input
                      type="url"
                      value={copilotUrl}
                      onChange={(e) => setCopilotUrl(e.target.value)}
                      placeholder="https://…environment.api.powerplatform.com/powervirtualagents/botsbyschema/…/directline/token?api-version=2022-03-01-preview"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <button
                    onClick={handleConnectCopilot}
                    disabled={copilotBusy}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    {copilotBusy ? 'Connexion…' : 'Connecter mon agent'}
                  </button>
                  <p className="text-[11px] text-slate-500">
                    Astuce : vous pouvez aussi cliquer sur <strong>Analyser automatiquement</strong> à gauche pour extraire les fiches MEP directement via le moteur IA de Clarity.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-700">Agent connecté</span>
                    <button
                      onClick={async () => {
                        await fetch('/api/copilot/directline/disconnect', { method: 'POST' });
                        setCopilotConnected(false);
                      }}
                      className="text-xs font-bold text-rose-600 hover:underline cursor-pointer"
                    >
                      Déconnecter
                    </button>
                  </div>
                  <div className="h-64 overflow-y-auto p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    {copilotMessages.map((m, idx) => (
                      <div
                        key={idx}
                        className={`p-2.5 rounded-xl text-xs whitespace-pre-wrap max-w-[92%] ${
                          m.role === 'user'
                            ? 'ml-auto bg-indigo-600 text-white'
                            : m.role === 'system'
                            ? 'mx-auto bg-amber-50 text-amber-800 border border-amber-200 text-[11px]'
                            : 'bg-white border border-slate-200 text-slate-800'
                        }`}
                      >
                        {m.text}
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <textarea
                      rows={2}
                      value={copilotInput}
                      onChange={(e) => setCopilotInput(e.target.value)}
                      placeholder="Demandez à Copilot d’analyser la source, préparer les MEP, relever les risques…"
                      className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button
                        onClick={() => {
                          const p = buildCopilotPrompt();
                          if (p) handleSendCopilotMessage(p);
                        }}
                        disabled={copilotBusy}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                      >
                        Analyser la source chargée
                      </button>
                      <button
                        onClick={() => handleSendCopilotMessage()}
                        disabled={copilotBusy}
                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Envoyer à Copilot</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Step 3: Validation & Import */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900">3. Résultat JSON et validation</h4>
                <p className="text-xs text-slate-500">
                  Vérifiez la réponse JSON avant création. Aucune donnée n’est créée sans votre validation.
                </p>
              </div>
              <button
                onClick={handleCopyPrompt}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copier le prompt</span>
              </button>
            </div>

            <textarea
              rows={6}
              value={assistantJson}
              onChange={(e) => setAssistantJson(e.target.value)}
              placeholder='{"mep":[{"project":"Projet A","title":"Mise en production ...","date":"2026-12-15T22:00","owner":"Nom","changeNumbers":"CHG...","tasks":[]}]}'
              className="w-full p-3 text-xs font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => previewAssistantJson()}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold cursor-pointer"
              >
                Vérifier et prévisualiser
              </button>
              <button
                onClick={handleImportAssistantMeps}
                disabled={assistantParsed.filter((x) => !x.missing?.length).length === 0}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer disabled:opacity-40"
              >
                Créer les MEP validées
              </button>
            </div>

            {assistantPreviewMsg && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold border ${
                  assistantPreviewMsg.type === 'ok'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {assistantPreviewMsg.text}
              </div>
            )}

            {assistantParsed.length > 0 && (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">Projet / MEP</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Responsable</th>
                      <th className="p-3">Change</th>
                      <th className="p-3">Contrôle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {assistantParsed.map((x) => (
                      <tr key={x._index}>
                        <td className="p-3 font-mono">{x._index}</td>
                        <td className="p-3">
                          <div className="font-bold text-slate-900">{x.project || 'À compléter'}</div>
                          <div className="text-[11px] text-slate-500">{x.title || 'Intitulé manquant'}</div>
                        </td>
                        <td className="p-3 font-mono">{x.date || '—'}</td>
                        <td className="p-3">{x.owner || '—'}</td>
                        <td className="p-3 font-mono text-sky-700">{x.changeNumbers || '—'}</td>
                        <td className="p-3">
                          {x.duplicate ? (
                            <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-bold">
                              Doublon potentiel
                            </span>
                          ) : x.missing?.length ? (
                            <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold">
                              À compléter : {x.missing.join(', ')}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                              Prête
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          8. PARAMÈTRES & SAUVEGARDE
         ===================================================================== */}
      {page === 'settings' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-base font-black text-slate-900">Paramètres & sauvegarde</h3>
            <p className="text-xs text-slate-500">Gérez les données MEP partagées et sauvegardées sur PostgreSQL.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Download className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">Sauvegarde complète</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Exporter les MEP, équipes, jalons, tâches et comptes rendus au format JSON.
              </p>
              <button
                onClick={handleBackupJson}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Télécharger JSON
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                <Upload className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">Restaurer une sauvegarde</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Importer une sauvegarde ProdPilot JSON. Les données existantes seront remplacées.
              </p>
              <label className="inline-flex px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold cursor-pointer">
                Choisir un fichier
                <input type="file" accept=".json" className="hidden" onChange={handleRestoreBackup} />
              </label>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">Export MEP CSV</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Exporter les MEP avec les numéros de Change ServiceNow et le détail des tâches.
              </p>
              <button
                onClick={handleExportCsv}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold cursor-pointer"
              >
                Exporter les MEP CSV
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-rose-200 p-6 shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">Réinitialiser les données</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Supprimer définitivement toutes les MEP et tous les comptes-rendus du serveur PostgreSQL.
              </p>
              <button
                onClick={() =>
                  setConfirmAction({
                    title: 'Réinitialiser toutes les MEP ?',
                    message: 'Cette action supprimera définitivement toutes les fiches MEP et tous les comptes-rendus partagés sur le serveur.',
                    confirmLabel: 'Tout supprimer',
                    danger: true,
                    onConfirm: () => {
                      persistDb({ mep: [], kanban: [] });
                      setConfirmAction(null);
                      showToast('Données réinitialisées');
                    },
                  })
                }
                className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold cursor-pointer"
              >
                Réinitialiser
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: CREATE / EDIT MEP (+ INTERVENANTS + JALONS & TÂCHES)
         ===================================================================== */}
      {isMepModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
            <div className="sticky top-0 z-10 bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">
                  {editMepId ? 'Modification MEP' : 'Nouvelle MEP'}
                </div>
                <h3 className="text-base font-black text-slate-900">
                  {editMepId ? 'Modifier la MEP' : 'Programmer une MEP'}
                </h3>
              </div>
              <button
                onClick={() => setIsMepModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMep} className="p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Projet *</label>
                  <select
                    required
                    value={mepForm.projectId || ''}
                    onChange={(e) => { const selected = clarityProjects.find((p) => p.id === e.target.value); setMepForm({ ...mepForm, projectId: e.target.value, project: selected?.name || '' }); }}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Sélectionner un projet Clarity</option>
                    {clarityProjects.map((project) => <option key={project.id} value={project.id}>{project.code} — {project.name}</option>)}
                  </select>
                  {!clarityProjects.length && <p className="text-xs text-rose-600 mt-1">Créez d’abord un projet dans Clarity pour pouvoir planifier une MEP.</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Application / intitulé *</label>
                  <input
                    type="text"
                    required
                    value={mepForm.title || ''}
                    onChange={(e) => setMepForm({ ...mepForm, title: e.target.value })}
                    placeholder="ex: Déploiement Portail Client v4.2"
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Version</label>
                  <input
                    type="text"
                    value={mepForm.version || ''}
                    onChange={(e) => setMepForm({ ...mepForm, version: e.target.value })}
                    placeholder="ex: v4.2.0"
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Date et heure de MEP *</label>
                  <input
                    type="datetime-local"
                    required
                    value={mepForm.date || ''}
                    onChange={(e) => setMepForm({ ...mepForm, date: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Responsable MEP *</label>
                  <input
                    type="text"
                    required
                    value={mepForm.owner || ''}
                    onChange={(e) => setMepForm({ ...mepForm, owner: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Environnement *</label>
                  <select
                    value={mepForm.environment || 'Production'}
                    onChange={(e) => setMepForm({ ...mepForm, environment: e.target.value as any })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="Production">Production</option>
                    <option value="Préproduction">Préproduction</option>
                    <option value="Recette">Recette</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Statut *</label>
                  <select
                    value={mepForm.status || 'Brouillon'}
                    onChange={(e) => setMepForm({ ...mepForm, status: e.target.value as MepStatus })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white"
                  >
                    {MEP_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Priorité *</label>
                  <select
                    value={mepForm.priority || 'Normale'}
                    onChange={(e) => setMepForm({ ...mepForm, priority: e.target.value as any })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="Critique">Critique</option>
                    <option value="Haute">Haute</option>
                    <option value="Normale">Normale</option>
                    <option value="Basse">Basse</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Décision Go / No-Go</label>
                  <select
                    value={mepForm.goNoGo || 'En attente'}
                    onChange={(e) => setMepForm({ ...mepForm, goNoGo: e.target.value as any })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="En attente">En attente</option>
                    <option value="GO">GO</option>
                    <option value="NO-GO">NO-GO</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Numéro(s) de Change ServiceNow</label>
                  <input
                    type="text"
                    value={mepForm.changeNumbers || ''}
                    onChange={(e) => setMepForm({ ...mepForm, changeNumbers: e.target.value })}
                    placeholder="ex: CHG0048921"
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Référence(s) RITM (facultatif)</label>
                  <input
                    type="text"
                    value={mepForm.ritmNumbers || ''}
                    onChange={(e) => setMepForm({ ...mepForm, ritmNumbers: e.target.value })}
                    placeholder="ex: RITM0112450"
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Plan de retour arrière</label>
                  <textarea
                    rows={2}
                    value={mepForm.rollback || ''}
                    onChange={(e) => setMepForm({ ...mepForm, rollback: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Périmètre / procédure</label>
                  <textarea
                    rows={2}
                    value={mepForm.description || ''}
                    onChange={(e) => setMepForm({ ...mepForm, description: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              {/* Intervenants Section */}
              <div className="pt-4 border-t border-slate-200 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Intervenants de la MEP</h4>
                    <p className="text-xs text-slate-500">Ajoutez les personnes mobilisées et leur rôle.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPersonDraft([...personDraft, { name: '', role: '' }])}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    + Ajouter une personne
                  </button>
                </div>

                {personDraft.length === 0 ? (
                  <div className="p-3 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    Aucun intervenant ajouté.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {personDraft.map((p, i) => (
                      <div key={i} className="grid grid-cols-[1fr_1fr_36px] gap-2">
                        <input
                          type="text"
                          placeholder="Nom et prénom"
                          value={p.name}
                          onChange={(e) => {
                            const next = [...personDraft];
                            next[i].name = e.target.value;
                            setPersonDraft(next);
                          }}
                          className="text-xs p-2 rounded-xl border border-slate-300"
                        />
                        <input
                          type="text"
                          placeholder="Rôle / équipe"
                          value={p.role}
                          onChange={(e) => {
                            const next = [...personDraft];
                            next[i].role = e.target.value;
                            setPersonDraft(next);
                          }}
                          className="text-xs p-2 rounded-xl border border-slate-300"
                        />
                        <button
                          type="button"
                          onClick={() => setPersonDraft(personDraft.filter((_, idx) => idx !== i))}
                          className="rounded-xl border border-slate-200 text-rose-600 hover:bg-rose-50 cursor-pointer flex items-center justify-center"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Jalons & Tâches Section */}
              <div className="pt-4 border-t border-slate-200 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Jalons & tâches</h4>
                    <p className="text-xs text-slate-500">
                      Les dates sont calculées à partir de la date de MEP (décalage négatif = avant la MEP).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setTaskDraft([
                        ...taskDraft,
                        normalizeTask({ title: '', kind: 'Tâche', offset: 0, duration: 1, status: 'À faire' }),
                      ])
                    }
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    + Ajouter un jalon / tâche
                  </button>
                </div>

                {taskDraft.length === 0 ? (
                  <div className="p-3 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    Aucune tâche définie.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {taskDraft.map((t, i) => (
                      <div
                        key={t.id}
                        className="grid grid-cols-1 md:grid-cols-[2fr_90px_1fr_80px_70px_115px_34px] gap-2 items-center p-2 rounded-xl bg-slate-50 border border-slate-200"
                      >
                        <input
                          type="text"
                          value={t.title}
                          placeholder="Nom du jalon ou de la tâche"
                          onChange={(e) => {
                            const next = [...taskDraft];
                            next[i].title = e.target.value;
                            setTaskDraft(next);
                          }}
                          className="text-xs p-2 rounded-lg border border-slate-300 bg-white"
                        />
                        <select
                          value={t.kind}
                          onChange={(e) => {
                            const next = [...taskDraft];
                            next[i].kind = e.target.value as 'Jalon' | 'Tâche';
                            setTaskDraft(next);
                          }}
                          className="text-xs p-2 rounded-lg border border-slate-300 bg-white"
                        >
                          <option value="Jalon">Jalon</option>
                          <option value="Tâche">Tâche</option>
                        </select>
                        <input
                          type="text"
                          value={t.assignee}
                          placeholder="Responsable"
                          onChange={(e) => {
                            const next = [...taskDraft];
                            next[i].assignee = e.target.value;
                            setTaskDraft(next);
                          }}
                          className="text-xs p-2 rounded-lg border border-slate-300 bg-white"
                        />
                        <input
                          type="number"
                          value={t.offset}
                          title="Jours vs MEP (négatif = avant)"
                          onChange={(e) => {
                            const next = [...taskDraft];
                            next[i].offset = Number(e.target.value);
                            setTaskDraft(next);
                          }}
                          className="text-xs p-2 rounded-lg border border-slate-300 bg-white font-mono"
                        />
                        <input
                          type="number"
                          min={1}
                          value={t.duration}
                          title="Durée (j)"
                          onChange={(e) => {
                            const next = [...taskDraft];
                            next[i].duration = Math.max(1, Number(e.target.value));
                            setTaskDraft(next);
                          }}
                          className="text-xs p-2 rounded-lg border border-slate-300 bg-white font-mono"
                        />
                        <select
                          value={t.status}
                          onChange={(e) => {
                            const next = [...taskDraft];
                            next[i].status = e.target.value as MepTaskStatus;
                            setTaskDraft(next);
                          }}
                          className="text-xs p-2 rounded-lg border border-slate-300 bg-white"
                        >
                          {KANBAN_COLUMNS.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setTaskDraft(taskDraft.filter((_, idx) => idx !== i))}
                          className="h-8 rounded-lg border border-slate-200 bg-white text-rose-600 hover:bg-rose-50 cursor-pointer flex items-center justify-center"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100 text-xs text-indigo-800 font-medium">
                  {schedulePreviewText}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2 sticky bottom-0 bg-white pb-1">
                <button
                  type="button"
                  onClick={() => setIsMepModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  Enregistrer la MEP
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: CREATE / EDIT MINUTE (COMPTE RENDU)
         ===================================================================== */}
      {isMinuteModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">
                  Compte rendu de réunion
                </div>
                <h3 className="text-base font-black text-slate-900">
                  {editMinuteId ? 'Modifier le compte rendu' : 'Nouveau compte rendu'}
                </h3>
              </div>
              <button
                onClick={() => setIsMinuteModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMinute} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">MEP concernée *</label>
                <select
                  required
                  value={minuteForm.mepId || ''}
                  onChange={(e) => setMinuteForm({ ...minuteForm, mepId: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white"
                >
                  {db.mep.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.project} · {getMepRef(m)} · {m.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Date et heure *</label>
                  <input
                    type="datetime-local"
                    required
                    value={minuteForm.date || ''}
                    onChange={(e) => setMinuteForm({ ...minuteForm, date: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Type de réunion</label>
                  <select
                    value={minuteForm.type || 'Point projet'}
                    onChange={(e) => setMinuteForm({ ...minuteForm, type: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white"
                  >
                    <option>Point projet</option>
                    <option>Comité de pilotage</option>
                    <option>Préparation MEP</option>
                    <option>Go / No-Go</option>
                    <option>Retour d'expérience</option>
                    <option>Autre</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Objet de la réunion</label>
                <input
                  type="text"
                  value={minuteForm.subject || ''}
                  onChange={(e) => setMinuteForm({ ...minuteForm, subject: e.target.value })}
                  placeholder="Objet de la réunion"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Participants</label>
                <textarea
                  rows={2}
                  value={minuteForm.attendees || ''}
                  onChange={(e) => setMinuteForm({ ...minuteForm, attendees: e.target.value })}
                  placeholder="Participants, équipes présentes…"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Compte rendu / synthèse</label>
                <textarea
                  rows={2}
                  value={minuteForm.summary || ''}
                  onChange={(e) => setMinuteForm({ ...minuteForm, summary: e.target.value })}
                  placeholder="Points abordés, état d'avancement, faits marquants…"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Décisions prises</label>
                <textarea
                  rows={2}
                  value={minuteForm.decisions || ''}
                  onChange={(e) => setMinuteForm({ ...minuteForm, decisions: e.target.value })}
                  placeholder="Décisions validées, arbitrages, Go / No-Go…"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Actions à suivre</label>
                <textarea
                  rows={2}
                  value={minuteForm.actions || ''}
                  onChange={(e) => setMinuteForm({ ...minuteForm, actions: e.target.value })}
                  placeholder="Action — responsable — échéance…"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Risques / points de vigilance</label>
                <textarea
                  rows={2}
                  value={minuteForm.risks || ''}
                  onChange={(e) => setMinuteForm({ ...minuteForm, risks: e.target.value })}
                  placeholder="Risques, blocages, dépendances…"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsMinuteModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  Enregistrer le compte rendu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          CONFIRMATION MODAL (No window.confirm)
         ===================================================================== */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-xl ${
                  confirmAction.danger ? 'bg-rose-100 text-rose-700' : 'bg-indigo-100 text-indigo-700'
                }`}
              >
                <ShieldAlert className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">{confirmAction.title}</h4>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">{confirmAction.message}</p>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={confirmAction.onConfirm}
                className={`px-4 py-2 text-white rounded-xl text-xs font-bold cursor-pointer ${
                  confirmAction.danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {confirmAction.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toastMsg && (
        <div className="fixed right-5 bottom-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
};
