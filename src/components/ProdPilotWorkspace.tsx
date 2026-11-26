import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  Rocket,
  Calendar as CalendarIcon,
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
import { AppUser, Project, PortfolioScope } from '../types';
import { CommunicationAssistant } from './CommunicationAssistant';
import { calculateProjectMetrics } from '../utils/pmCalculations';

export type ProdPilotPage =
  | 'dashboard'
  | 'mep'
  | 'planning'
  | 'coproj'
  | 'minutes'
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

export type MepTaskStatus = 'À faire' | 'En cours' | 'En validation' | 'Bloqué' | 'Terminé';

export interface MepPerson {
  name: string;
  role: string;
  email?: string;
}

export interface MepItsmReference {
  id: string;
  type: 'CHANGE' | 'RITM';
  number: string;
  status: string;
  serviceNowUrl?: string;
  source: 'MANUAL';
  updatedAt: string;
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
  projectTaskId?: string;
  projectMilestoneId?: string;
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

export type MepRunbookStatus = 'À faire' | 'En cours' | 'Reçu' | 'Approuvé' | 'Approuvé sous réserve' | 'OK' | 'KO' | 'Reporté';
export interface MepRunbookItem {
  id: string;
  title: string;
  reference: string;
  owner: string;
  startAt: string;
  endAt: string;
  status: MepRunbookStatus;
}
export interface MepExecutionStep {
  id: string;
  title: string;
  reference: string;
  actor: string;
  startTime: string;
  endTime: string;
  status: MepRunbookStatus;
}
export interface MepRunbookRecipient {
  id: string;
  name: string;
  email: string;
  information: boolean;
  sondes: boolean;
  start: boolean;
  end: boolean;
  teams: boolean;
  pss: boolean;
  coproj: boolean;
  to: boolean;
  cc: boolean;
}
export interface MepRunbookEvent {
  id: string;
  type: 'GO' | 'FIN' | 'ROLLBACK' | 'NOTE';
  stepId?: string;
  stepTitle?: string;
  actor: string;
  at: string;
  comment?: string;
}
export interface MepRunbook {
  type: 'Majeure' | 'Mineure';
  pilotPhone: string;
  trigram: string;
  applicationCode: string;
  plannedStart: string;
  plannedEnd: string;
  timelineScale: 'Auto' | 5 | 10 | 15 | 20 | 30 | 60 | 120;
  prerequisites: MepRunbookItem[];
  executionSteps: MepExecutionStep[];
  dag: MepExecutionStep;
  rollbackEnabled: boolean;
  rollbackTriggered: boolean;
  rollbackSteps: MepExecutionStep[];
  recipients: MepRunbookRecipient[];
  events: MepRunbookEvent[];
}

export interface MepEntry {
  id: string;
  ref?: string;
  /** Legacy project linkage retained only for backward compatibility. */
  projectId?: string;
  project?: string;
  applicationCode?: string;
  scopeIds?: string[];
  title: string;
  version: string;
  date: string;
  teamsMeetingStart?: string;
  teamsMeetingEnd?: string;
  owner: string;
  environment: 'Production' | 'Préproduction' | 'Recette';
  status: MepStatus;
  priority: 'Critique' | 'Haute' | 'Normale' | 'Basse';
  goNoGo: 'En attente' | 'GO' | 'NO-GO';
  changeNumbers: string;
  ritmNumbers: string;
  changeUrl?: string;
  ritmUrl?: string;
  itsmReferences?: MepItsmReference[];
  trigrams?: string[];
  rollback: string;
  description: string;
  people: MepPerson[];
  tasks: MepTask[];
  minutes: MepMinute[];
  runbook?: MepRunbook;
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
  scopes?: PortfolioScope[];
  activeProjectId?: string;
  onUpdateProject?: (project: Project) => void;
  dashboardOnly?: boolean;
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
  'Bloqué',
  'Terminé',
];

const isoToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const uid = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 9).toUpperCase()}`;

const dayStr = (s?: string) => String(s || '').slice(0, 10);

const shiftLocalDateTime = (value: string, minutes: number): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  date.setMinutes(date.getMinutes() + minutes);
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

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
  projectTaskId: t.projectTaskId || undefined,
  projectMilestoneId: t.projectMilestoneId || undefined,
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

const RUNBOOK_STATUSES: MepRunbookStatus[] = ['À faire', 'En cours', 'Reçu', 'Approuvé', 'Approuvé sous réserve', 'OK', 'KO', 'Reporté'];
const RUNBOOK_PROGRESS: Record<MepRunbookStatus, number> = {
  'À faire': 0, 'En cours': 0.5, 'Reçu': 1, 'Approuvé': 1,
  'Approuvé sous réserve': 0.75, 'OK': 1, 'KO': 0, 'Reporté': 0,
};
const createRunbookItem = (title: string): MepRunbookItem => ({
  id: uid('PRE'), title, reference: '', owner: '', startAt: '', endAt: '', status: 'À faire',
});
const createExecutionStep = (title: string): MepExecutionStep => ({
  id: uid('STEP'), title, reference: '', actor: '', startTime: '', endTime: '', status: 'À faire',
});
const createDefaultRunbook = (owner = ''): MepRunbook => ({
  type: 'Mineure', pilotPhone: '', trigram: '', applicationCode: '', plannedStart: '13:00', plannedEnd: '16:00',
  timelineScale: 'Auto',
  prerequisites: [
    createRunbookItem('Validation CAB'),
    createRunbookItem('PC de recette'),
    createRunbookItem('Tests préproduction'),
    createRunbookItem('Prérequis techniques'),
  ],
  executionSteps: [
    createExecutionStep('Préparation : ouverture Teams / mail / appel de pilotage'),
    createExecutionStep('Exécution technique — étape 1'),
    createExecutionStep('Exécution technique — étape 2'),
    createExecutionStep('Contrôle / vérification'),
    createExecutionStep('Contrôles post-MEP / supervision'),
    createExecutionStep('Mail de fin / vérification des sondes'),
  ],
  dag: { ...createExecutionStep('Mise à jour du DAG'), actor: owner },
  rollbackEnabled: false, rollbackTriggered: false,
  rollbackSteps: [
    createExecutionStep('Décision de rollback (GO / NO-GO)'),
    createExecutionStep('Restauration de la version précédente'),
    createExecutionStep('Contrôle / vérification post-rollback'),
  ],
  recipients: [], events: [],
});
const normalizeRunbook = (value: any, owner = ''): MepRunbook => {
  const base = createDefaultRunbook(owner);
  if (!value || typeof value !== 'object') return base;
  const validStatus = (s: any): MepRunbookStatus => RUNBOOK_STATUSES.includes(s) ? s : 'À faire';
  const item = (x: any): MepRunbookItem => ({ ...createRunbookItem(x?.title || 'Prérequis'), ...x, id: x?.id || uid('PRE'), title: String(x?.title || ''), reference: String(x?.reference || ''), owner: String(x?.owner || ''), startAt: String(x?.startAt || ''), endAt: String(x?.endAt || ''), status: validStatus(x?.status) });
  const step = (x: any, fallback: string): MepExecutionStep => ({ ...createExecutionStep(x?.title || fallback), ...x, id: x?.id || uid('STEP'), title: String(x?.title || fallback), reference: String(x?.reference || ''), actor: String(x?.actor || ''), startTime: String(x?.startTime || ''), endTime: String(x?.endTime || ''), status: validStatus(x?.status) });
  return {
    ...base, ...value,
    type: value.type === 'Majeure' ? 'Majeure' : 'Mineure',
    pilotPhone: String(value.pilotPhone || ''), trigram: String(value.trigram || ''), applicationCode: String(value.applicationCode || ''),
    plannedStart: String(value.plannedStart || '13:00'), plannedEnd: String(value.plannedEnd || '16:00'),
    timelineScale: ['Auto',5,10,15,20,30,60,120].includes(value.timelineScale) ? value.timelineScale : 'Auto',
    prerequisites: (() => {
      const saved = Array.isArray(value.prerequisites) ? value.prerequisites : [];
      const selected = [
        saved.find((x: any) => /cab/i.test(String(x?.title || ''))),
        saved.find((x: any) => /pc de recette/i.test(String(x?.title || ''))),
        saved.find((x: any) => /test.*préproduction/i.test(String(x?.title || ''))),
        saved.find((x: any) => /prérequis techniques/i.test(String(x?.title || ''))),
      ];
      return base.prerequisites.map((defaultItem, index) => {
        const previous = selected[index] || {};
        return { ...defaultItem, ...previous, id: previous.id || defaultItem.id, title: defaultItem.title, reference: '', owner: '', status: 'À faire' as MepRunbookStatus };
      });
    })(),
    executionSteps: Array.isArray(value.executionSteps) ? value.executionSteps.map((x: any) => step(x, 'Étape opérationnelle')) : base.executionSteps,
    dag: step(value.dag, 'Mise à jour du DAG'),
    rollbackEnabled: Boolean(value.rollbackEnabled), rollbackTriggered: Boolean(value.rollbackTriggered),
    rollbackSteps: Array.isArray(value.rollbackSteps) ? value.rollbackSteps.map((x: any) => step(x, 'Étape de rollback')) : base.rollbackSteps,
    recipients: Array.isArray(value.recipients) ? value.recipients.map((x: any) => ({ id: x.id || uid('REC'), name: String(x.name || ''), email: String(x.email || ''), information: Boolean(x.information), sondes: Boolean(x.sondes), start: Boolean(x.start), end: Boolean(x.end), teams: Boolean(x.teams), pss: Boolean(x.pss), coproj: Boolean(x.coproj), to: x.to !== false, cc: Boolean(x.cc) })) : [],
    events: Array.isArray(value.events) ? value.events.slice(-100) : [],
  };
};
const clockMinutes = (value: string) => {
  const [hours, minutes] = String(value || '').split(':').map(Number);
  return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : null;
};
const getTimelineBarStyle = (step: MepExecutionStep, runbook: MepRunbook): React.CSSProperties => {
  const windowStart = clockMinutes(runbook.plannedStart) ?? 0;
  let windowEnd = clockMinutes(runbook.plannedEnd) ?? 180;
  if (windowEnd <= windowStart) windowEnd += 1440;
  const start = clockMinutes(step.startTime);
  if (start === null) return { left: '0%', width: '0%' };
  let normalizedStart = start;
  if (normalizedStart < windowStart) normalizedStart += 1440;
  let end = clockMinutes(step.endTime);
  if (end === null) end = normalizedStart + (runbook.timelineScale === 'Auto' ? 10 : Number(runbook.timelineScale));
  else if (end < start) end += 1440;
  const span = Math.max(1, windowEnd - windowStart);
  const left = Math.max(0, Math.min(100, ((normalizedStart - windowStart) / span) * 100));
  const width = Math.max(1.5, Math.min(100 - left, ((end - normalizedStart) / span) * 100));
  return { left: `${left}%`, width: `${width}%` };
};
const getRunbookProgress = (runbook: MepRunbook) => {
  const items: MepRunbookStatus[] = [
    ...runbook.prerequisites.filter(x => x.title.trim()).map(x => x.status),
    ...runbook.executionSteps.filter(x => x.title.trim()).map(x => x.status),
    ...(runbook.type === 'Majeure' && runbook.dag.title.trim() ? [runbook.dag.status] : []),
    ...(runbook.rollbackTriggered ? runbook.rollbackSteps.filter(x => x.title.trim()).map(x => x.status) : []),
  ];
  return items.length ? Math.round(items.reduce((sum, status) => sum + RUNBOOK_PROGRESS[status], 0) / items.length * 100) : 0;
};

const getMepRef = (m: MepEntry) => m.ref || `MEP-${m.id.slice(-5)}`;

const buildTeamsMeetingUrl = (mep: MepEntry): string => {
  const meetingStart = mep.teamsMeetingStart || shiftLocalDateTime(mep.date, -30);
  const meetingEnd = mep.teamsMeetingEnd || mep.date;
  const toIso = (localDateTime: string) => {
    const parsed = new Date(localDateTime);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
  };
  const attendees = (mep.people || []).map((person) => String(person.email || '').trim()).filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  const params = new URLSearchParams({
    subject: `Point MEP ${getMepRef(mep)} — ${mep.title}`,
    startTime: toIso(meetingStart),
    endTime: toIso(meetingEnd),
    content: [
      `MEP : ${getMepRef(mep)} — ${mep.title}`,
      `Application : ${mep.title} (${mep.applicationCode || 'code non renseigné'})`,
      `Trigrammes : ${(mep.trigrams || []).join(', ') || 'À renseigner'}`,
      `Responsable : ${mep.owner}`,
      `Environnement : ${mep.environment}`,
      `Change : ${mep.changeNumbers || 'À renseigner'}`,
      `RITM : ${mep.ritmNumbers || 'À renseigner'}`,
      mep.description || '',
    ].filter(Boolean).join('\n'),
  });
  if (attendees.length) params.set('attendees', attendees.join(';'));
  return `https://teams.microsoft.com/l/meeting/new?${params.toString()}`;
};
const isClosedMep = (m: MepEntry) => ['Réussie', 'Échec', 'Annulée'].includes(m.status);
const isLateMep = (m: MepEntry) => Boolean(m.date && dayStr(m.date) < isoToday() && !isClosedMep(m));

const getTaskDates = (m: MepEntry, t: MepTask) => {
  const base = dayStr(m.date) || isoToday();
  const start = addDays(base, t.offset);
  const end = addDays(start, Math.max(0, t.duration - 1));
  return { start, end };
};

const getMepProgress = (m: MepEntry) => {
  if (m.runbook) return getRunbookProgress(normalizeRunbook(m.runbook, m.owner));
  const ts = m.tasks || [];
  if (!ts.length) return 0;
  return Math.round((ts.filter((t) => t.status === 'Terminé').length / ts.length) * 100);
};

const parseItsmNumbers = (value: unknown): string[] => Array.from(new Set(String(value || '').split(/[\n,;\s]+/).map((item) => item.trim().toUpperCase()).filter(Boolean)));

const normalizeServiceNowUrl = (value: unknown): string => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
};

const getItsmNumberUrl = (mep: MepEntry, type: 'CHANGE' | 'RITM', number: string): string => {
  const ref = (mep.itsmReferences || []).find((item) => item.type === type && item.number === number);
  return normalizeServiceNowUrl(ref?.serviceNowUrl) || normalizeServiceNowUrl(type === 'CHANGE' ? mep.changeUrl : mep.ritmUrl);
};

const normalizeItsmReferences = (value: unknown, changeNumbers: string, ritmNumbers: string, changeUrls = '', ritmUrls = ''): MepItsmReference[] => {
  const existing = Array.isArray(value) ? value : [];
  const byKey = new Map<string, MepItsmReference>();
  existing.forEach((item: any) => {
    const type = item?.type === 'RITM' ? 'RITM' : 'CHANGE';
    const number = String(item?.number || '').trim().toUpperCase();
    if (!number) return;
    byKey.set(`${type}:${number}`, { id: String(item?.id || uid('ITSM')), type, number, status: String(item?.status || 'À vérifier'), serviceNowUrl: String(item?.serviceNowUrl || ''), source: 'MANUAL', updatedAt: String(item?.updatedAt || new Date().toISOString()) });
  });
  const changeUrlList = String(changeUrls || '').split(/\n/).map((url) => normalizeServiceNowUrl(url));
  const ritmUrlList = String(ritmUrls || '').split(/\n/).map((url) => normalizeServiceNowUrl(url));
  [...parseItsmNumbers(changeNumbers).map((number, index) => ({ type: 'CHANGE' as const, number, url: changeUrlList[index] || '' })), ...parseItsmNumbers(ritmNumbers).map((number, index) => ({ type: 'RITM' as const, number, url: ritmUrlList[index] || '' }))].forEach(({ type, number, url }) => {
    const key = `${type}:${number}`;
    const previous = byKey.get(key);
    byKey.set(key, { id: previous?.id || uid('ITSM'), type, number, status: previous?.status || 'À vérifier', serviceNowUrl: url || previous?.serviceNowUrl || '', source: 'MANUAL', updatedAt: new Date().toISOString() });
  });
  return Array.from(byKey.values());
};

const normalizeMep = (x: any, projects: Project[]): MepEntry => {
  const project = projects.find((p) => p.id === x.projectId) || projects.find((p) => p.name === x.project);
  const id = String(x.id || uid('MEP'));
  return {
    ...x,
    id,
    ref: String(x.ref || ''),
    projectId: x.projectId || '',
    project: String(x.applicationCode || x.title || x.project || project?.name || ''),
    applicationCode: String(x.applicationCode || x.runbook?.applicationCode || ''),
    scopeIds: Array.from(new Set((Array.isArray(x.scopeIds) ? x.scopeIds : []).map((id: any) => String(id || '').trim()).filter(Boolean))),
    title: String(x.title || 'Nouvelle mise en production'),
    version: String(x.version || ''),
    date: String(x.date || isoToday()),
    owner: String(x.owner || ''),
    environment: ['Production', 'Préproduction', 'Recette'].includes(x.environment) ? x.environment : 'Production',
    status: MEP_STATUSES.includes(x.status) ? x.status : 'Brouillon',
    priority: ['Critique', 'Haute', 'Normale', 'Basse'].includes(x.priority) ? x.priority : 'Normale',
    goNoGo: ['En attente', 'GO', 'NO-GO'].includes(x.goNoGo) ? x.goNoGo : 'En attente',
    changeNumbers: parseItsmNumbers(x.changeNumbers || x.changeRef || '').join(', '),
    ritmNumbers: parseItsmNumbers(x.ritmNumbers || '').join(', '),
    changeUrl: normalizeServiceNowUrl(x.changeUrl),
    ritmUrl: normalizeServiceNowUrl(x.ritmUrl),
    itsmReferences: normalizeItsmReferences(x.itsmReferences, String(x.changeNumbers || x.changeRef || ''), String(x.ritmNumbers || ''), String(x.changeUrls || x.changeUrl || ''), String(x.ritmUrls || x.ritmUrl || '')),
    trigrams: Array.from(new Set((Array.isArray(x.trigrams) ? x.trigrams : String(x.runbook?.trigram || '').split(/[\n,; ]+/)).map((t: any) => String(t || '').trim().toUpperCase()).filter(Boolean))),
    rollback: String(x.rollback || ''),
    description: String(x.description || ''),
    people: Array.isArray(x.people) ? x.people.map((p: any) => ({ name: String(p?.name || ''), role: String(p?.role || ''), email: String(p?.email || '') })) : [],
    tasks: Array.isArray(x.tasks) ? x.tasks.map(normalizeTask) : [],
    minutes: Array.isArray(x.minutes) ? x.minutes.map((m: any) => ({
      ...m, id: String(m?.id || uid('CR')), mepId: id, date: String(m?.date || isoToday()),
      type: String(m?.type || 'Point projet'), subject: String(m?.subject || ''),
      attendees: String(m?.attendees || ''), summary: String(m?.summary || ''),
      decisions: String(m?.decisions || ''), actions: String(m?.actions || ''), risks: String(m?.risks || ''),
    })) : [],
    runbook: normalizeRunbook(x.runbook, x.owner || ''),
    createdAt: x.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

const getStatusBadgeClasses = (status: string) => {
  if (['Réussie', 'Terminé', 'GO'].includes(status)) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }
  if (['Échec', 'Annulée', 'NO-GO', 'Bloqué'].includes(status)) {
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
  scopes = [],
  activeProjectId,
  onUpdateProject,
  dashboardOnly = false,
}) => {
  const [db, setDb] = useState<ProdPilotDb>({ mep: [], kanban: [] });
  const [mepLoaded, setMepLoaded] = useState(false);
  const [mepLoadError, setMepLoadError] = useState<string | null>(null);
  const mepRevision = useRef(1);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => { let active = true; fetch('/api/meps', { credentials: 'same-origin' }).then(async (r) => { const data = await r.json(); if (!r.ok) throw new Error(data.error || 'Chargement MEP impossible'); return data; }).then((data) => { if (!active) return; const meps = (data.meps || []).map((m: any) => normalizeMep(m, clarityProjects)); setDb({ mep: meps, kanban: [] }); mepRevision.current = Number(data.revision) || 1; setMepLoadError(null); setMepLoaded(true); }).catch((error) => { console.error(error); if (active) { setMepLoadError(error instanceof Error ? error.message : 'Impossible de charger les MEP depuis le serveur'); } }); return () => { active = false; }; }, [currentUser.id]);
  useEffect(() => { setDb((current) => ({ ...current, mep: current.mep.map((m) => ({ ...m, project: clarityProjects.find((p) => p.id === m.projectId)?.name || m.project })) })); }, [clarityProjects]);

  // MEP lifecycle is independent from project task and milestone synchronization.

  const [page, setPage] = useState<ProdPilotPage>('mep');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Filters
  const [mepSearch, setMepSearch] = useState('');
  const [mepStatusFilter, setMepStatusFilter] = useState('');
  const [mepPriorityFilter, setMepPriorityFilter] = useState('');
  const [mepDateFilter, setMepDateFilter] = useState('');
  const [minuteSearch, setMinuteSearch] = useState('');
  const [minuteProjectFilter, setMinuteProjectFilter] = useState('');

  // Calendar State
  const [calendarDate, setCalendarDate] = useState<Date>(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string>(isoToday());

  // MEP Modal State
  const [isMepModalOpen, setIsMepModalOpen] = useState(false);
  const [selectedRunbookId, setSelectedRunbookId] = useState<string | null>(null);
  const [runbookTab, setRunbookTab] = useState<'settings' | 'prerequisites' | 'execution' | 'rollback'>('settings');
  const [editMepId, setEditMepId] = useState<string | null>(null);
  const [mepForm, setMepForm] = useState<Partial<MepEntry>>({});
  const mepImportInputRef = useRef<HTMLInputElement | null>(null);
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
      const p = (m.title || 'Application non renseignée').trim();
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
  
  // Project KPIs are shown in the same production cockpit as MEP KPIs.
  // Prefer the project selected in Clarity; otherwise use the project linked to the MEP portfolio.
  const dashboardProject = useMemo(() => {
    if (!clarityProjects.length) return undefined;
    return clarityProjects.find((project) => project.id === activeProjectId);
  }, [clarityProjects, activeProjectId, db.mep]);

  const projectDashboardMetrics = useMemo(
    () => dashboardProject ? calculateProjectMetrics(dashboardProject) : undefined,
    [dashboardProject]
  );


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
      // MEP view is a production register: do not silently hide entries because
      // the global project selector points to another project. Server-side RBAC
      // already limits the records returned by /api/meps for this user.
      return matchQuery && matchStatus && matchPriority && matchDate;
    });
  }, [db.mep, mepSearch, mepStatusFilter, mepPriorityFilter, mepDateFilter]);

  const selectedRunbookMep = db.mep.find((m) => m.id === selectedRunbookId) || null;
  const selectedRunbook = selectedRunbookMep ? normalizeRunbook(selectedRunbookMep.runbook, selectedRunbookMep.owner) : null;
  const openRunbook = (mep: MepEntry) => {
    setSelectedRunbookId(mep.id);
    setRunbookTab('settings');
    if (!mep.runbook) persistDb({ ...db, mep: db.mep.map((x) => x.id === mep.id ? { ...x, runbook: createDefaultRunbook(mep.owner) } : x) });
  };
  const saveRunbook = (patch: Partial<MepRunbook>) => {
    if (!selectedRunbookId) return;
    const current = db.mep.find((m) => m.id === selectedRunbookId);
    if (!current) return;
    const next = normalizeRunbook({ ...(current.runbook || createDefaultRunbook(current.owner)), ...patch }, current.owner);
    persistDb({ ...db, mep: db.mep.map((m) => m.id === selectedRunbookId ? { ...m, runbook: next, updatedAt: new Date().toISOString() } : m) });
  };
  const updateRunbookCollection = (key: 'prerequisites' | 'executionSteps' | 'rollbackSteps' | 'recipients', id: string, patch: any) => {
    if (!selectedRunbook) return;
    const next = (selectedRunbook[key] as any[]).map((item) => item.id === id ? { ...item, ...patch } : item);
    saveRunbook({ [key]: next } as Partial<MepRunbook>);
  };
  const addRunbookItem = (key: 'prerequisites' | 'executionSteps' | 'rollbackSteps') => {
    if (!selectedRunbook) return;
    if (key === 'prerequisites') saveRunbook({ prerequisites: [...selectedRunbook.prerequisites, createRunbookItem('Nouveau prérequis')] });
    else if (key === 'executionSteps') saveRunbook({ executionSteps: [...selectedRunbook.executionSteps, createExecutionStep('Nouvelle étape')] });
    else saveRunbook({ rollbackSteps: [...selectedRunbook.rollbackSteps, createExecutionStep('Nouvelle étape de rollback')] });
  };
  const removeRunbookItem = (key: 'prerequisites' | 'executionSteps' | 'rollbackSteps', id: string) => {
    if (!selectedRunbook) return;
    saveRunbook({ [key]: (selectedRunbook[key] as any[]).filter((item) => item.id !== id) } as Partial<MepRunbook>);
  };
  const recordRunbookStep = (step: MepExecutionStep, action: 'GO' | 'FIN', collection: 'executionSteps' | 'rollbackSteps' | 'dag' = 'executionSteps') => {
    if (!selectedRunbook) return;
    const now = new Date();
    const clock = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false });
    const changed = { ...step, status: action === 'GO' ? 'En cours' as MepRunbookStatus : 'OK' as MepRunbookStatus,
      startTime: action === 'GO' ? (step.startTime || clock) : step.startTime,
      endTime: action === 'FIN' ? clock : step.endTime };
    const events = [...selectedRunbook.events, { id: uid('EVT'), type: action, stepId: step.id, stepTitle: step.title, actor: '', at: now.toISOString() }].slice(-100);
    if (collection === 'dag') saveRunbook({ dag: changed, events });
    else saveRunbook({ [collection]: (selectedRunbook[collection] as MepExecutionStep[]).map((x) => x.id === step.id ? changed : x), events } as Partial<MepRunbook>);
  };

  const cloneMep = (source: MepEntry) => {
    const now = new Date().toISOString();
    const sourceRunbook = normalizeRunbook(source.runbook, source.owner);
    const clonedRunbook: MepRunbook = {
      ...sourceRunbook,
      prerequisites: sourceRunbook.prerequisites.map((item) => ({ ...item, id: uid('PRE'), status: 'À faire', startAt: '', endAt: '' })),
      executionSteps: sourceRunbook.executionSteps.map((step) => ({ ...step, id: uid('STEP'), status: 'À faire', startTime: '', endTime: '' })),
      dag: { ...sourceRunbook.dag, id: uid('STEP'), status: 'À faire', startTime: '', endTime: '' },
      rollbackTriggered: false,
      rollbackSteps: sourceRunbook.rollbackSteps.map((step) => ({ ...step, id: uid('STEP'), status: 'À faire', startTime: '', endTime: '' })),
      events: [],
      recipients: sourceRunbook.recipients.map((recipient) => ({ ...recipient, id: uid('REC') })),
    };
    const cloned: MepEntry = {
      ...source,
      id: uid('MEP'),
      ref: '',
      title: source.title ? source.title + ' - Copie' : 'Copie de MEP',
      date: `${isoToday()}T22:00`,
      status: 'Brouillon',
      goNoGo: 'En attente',
      changeNumbers: '',
      ritmNumbers: '',
      changeUrl: '',
      ritmUrl: '',
      itsmReferences: [],
      trigrams: [],
      tasks: (source.tasks || []).map((task) => ({ ...task, id: uid('TASK'), status: 'À faire', projectTaskId: undefined, projectMilestoneId: undefined })),
      minutes: [],
      runbook: clonedRunbook,
      createdAt: now,
      updatedAt: now,
    };
    persistDb({ ...db, mep: [cloned, ...db.mep] });
    setPage('mep');
    showToast('MEP clonée : tâches, chronogramme et destinataires conservés. Change, RITM et exécution réinitialisés.');
  };

  // MEP Modal handlers
  const openMepForm = (id: string | null = null, extraTask = false) => {
    setEditMepId(id);
    const existing = id ? db.mep.find((m) => m.id === id) : undefined;
    if (existing) {
      setMepForm({ ...existing, teamsMeetingStart: existing.teamsMeetingStart || shiftLocalDateTime(existing.date, -30), teamsMeetingEnd: existing.teamsMeetingEnd || existing.date });
      setPersonDraft((existing.people || []).map((p) => ({ ...p })));
      const baseTasks = (existing.tasks || []).map(normalizeTask);
      if (extraTask) {
        baseTasks.push(
          normalizeTask({ title: 'Nouvelle tâche', kind: 'Tâche', offset: 0, duration: 1, status: 'À faire' })
        );
      }
      setTaskDraft(baseTasks);
    } else {
      const defaultMepDate = `${isoToday()}T22:00`;
      setMepForm({
        projectId: '', project: '', applicationCode: '', scopeIds: [],
        title: '',
        version: '',
        date: defaultMepDate,
        teamsMeetingStart: shiftLocalDateTime(defaultMepDate, -30),
        teamsMeetingEnd: defaultMepDate,
        owner: currentUser.displayName || '',
        environment: 'Production',
        status: 'Brouillon',
        priority: 'Normale',
        goNoGo: 'En attente',
        changeNumbers: '',
        ritmNumbers: '',
        changeUrl: '',
        ritmUrl: '',
        rollback: '',
        description: '',
        runbook: createDefaultRunbook(currentUser.displayName || ''),
      });
      setPersonDraft([]);
      setTaskDraft(createDefaultTasks());
    }
    setIsMepModalOpen(true);
  };

  const handleSaveMep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!(mepForm.title || '').trim()) { showToast('Renseignez le nom de l’application.'); return; }
    const selectedScopes = Array.from(new Set((mepForm.scopeIds || []).filter((id) => scopes.some((scope) => scope.id === id))));
    if (!selectedScopes.length) { showToast('Sélectionnez au moins un périmètre applicatif.'); return; }
    const allowedTrigrams = new Set(scopes.filter((scope) => selectedScopes.includes(scope.id)).flatMap((scope) => scope.trigrams || []).map((value) => String(value).trim().toUpperCase()));
    const selectedTrigrams = Array.from(new Set((mepForm.trigrams || []).map((value) => String(value).trim().toUpperCase()).filter((value) => value && allowedTrigrams.has(value))));
    if (!selectedTrigrams.length) { showToast('Sélectionnez au moins un trigramme appartenant aux périmètres choisis.'); return; }
    const now = new Date().toISOString();
    const cleanPeople = personDraft
      .filter((p) => p.name.trim())
      .map((p) => ({ name: p.name.trim(), role: (p.role || '').trim(), email: String(p.email || '').trim() }));
    const cleanTasks = taskDraft.map(normalizeTask);
    const cleanChanges = parseItsmNumbers(mepForm.changeNumbers || '');
    const cleanRitms = parseItsmNumbers(mepForm.ritmNumbers || '');
    const itsmReferences = normalizeItsmReferences(mepForm.itsmReferences, cleanChanges.join(', '), cleanRitms.join(', '), mepForm.changeUrls || mepForm.changeUrl || '', mepForm.ritmUrls || mepForm.ritmUrl || '');
    const existingMep = db.mep.find((m) => m.id === editMepId);
    const mepId = existingMep?.id || uid('MEP');
    const mepRef = existingMep?.ref || `MEP-${mepId.slice(-5)}`;
    // MEP is intentionally independent from the Clarity project hierarchy.

    if (editMepId) {
      const updatedMeps = db.mep.map((m) =>
        m.id === editMepId
          ? {
              ...m,
              ...mepForm,
              changeNumbers: cleanChanges.join(', '),
              ritmNumbers: cleanRitms.join(', '),
              changeUrl: normalizeServiceNowUrl(mepForm.changeUrl),
              ritmUrl: normalizeServiceNowUrl(mepForm.ritmUrl),
              changeUrls: String(mepForm.changeUrls || mepForm.changeUrl || ''),
              ritmUrls: String(mepForm.ritmUrls || mepForm.ritmUrl || ''),
              itsmReferences,
              trigrams: selectedTrigrams,
              projectId: '', project: (mepForm.title || '').trim(),
              applicationCode: String(mepForm.applicationCode || '').trim(),
              scopeIds: selectedScopes,
              people: cleanPeople,
              tasks: cleanTasks,
              runbook: normalizeRunbook({ ...(mepForm.runbook || m.runbook || {}), applicationCode: String(mepForm.applicationCode || '').trim(), trigram: selectedTrigrams.join(', ') }, mepForm.owner || m.owner),
              updatedAt: now,
            }
          : m
      ) as MepEntry[];
      persistDb({ ...db, mep: updatedMeps });
    } else {
      const newEntry: MepEntry = {
        id: mepId,
        ref: mepRef,
        projectId: '', project: (mepForm.title || '').trim(),
        applicationCode: String(mepForm.applicationCode || '').trim(),
        scopeIds: selectedScopes,
        title: (mepForm.title || 'Nouvelle MEP').trim(),
        version: (mepForm.version || '').trim(),
        date: mepForm.date || `${isoToday()}T22:00`,
        teamsMeetingStart: mepForm.teamsMeetingStart || shiftLocalDateTime(mepForm.date || `${isoToday()}T22:00`, -30),
        teamsMeetingEnd: mepForm.teamsMeetingEnd || mepForm.date || `${isoToday()}T22:00`,
        owner: (mepForm.owner || currentUser.displayName || 'CPP').trim(),
        environment: (mepForm.environment as any) || 'Production',
        status: (mepForm.status as MepStatus) || 'Brouillon',
        priority: (mepForm.priority as any) || 'Normale',
        goNoGo: (mepForm.goNoGo as any) || 'En attente',
        changeNumbers: cleanChanges.join(', '),
        ritmNumbers: cleanRitms.join(', '),
        changeUrl: normalizeServiceNowUrl(mepForm.changeUrl),
        ritmUrl: normalizeServiceNowUrl(mepForm.ritmUrl),
        changeUrls: String(mepForm.changeUrls || mepForm.changeUrl || ''),
        ritmUrls: String(mepForm.ritmUrls || mepForm.ritmUrl || ''),
        itsmReferences,
        trigrams: selectedTrigrams,
        rollback: (mepForm.rollback || '').trim(),
        description: (mepForm.description || '').trim(),
        people: cleanPeople,
        tasks: cleanTasks,
        minutes: [],
        runbook: normalizeRunbook({ ...(mepForm.runbook || {}), applicationCode: String(mepForm.applicationCode || '').trim(), trigram: selectedTrigrams.join(', ') }, mepForm.owner || currentUser.displayName || ''),
        createdAt: now,
        updatedAt: now,
      };
      persistDb({ ...db, mep: [newEntry, ...db.mep] });
    }
    setIsMepModalOpen(false);
    if (!editMepId) {
      const savedMep: MepEntry = {
        id: mepId, ref: mepRef, projectId: '',
        project: (mepForm.title || '').trim(), applicationCode: String(mepForm.applicationCode || '').trim(), scopeIds: selectedScopes, title: (mepForm.title || 'Nouvelle MEP').trim(),
        version: (mepForm.version || '').trim(), date: mepForm.date || `${isoToday()}T22:00`,
        teamsMeetingStart: mepForm.teamsMeetingStart || shiftLocalDateTime(mepForm.date || `${isoToday()}T22:00`, -30),
        teamsMeetingEnd: mepForm.teamsMeetingEnd || mepForm.date || `${isoToday()}T22:00`,
        owner: (mepForm.owner || currentUser.displayName || 'CPP').trim(),
        environment: (mepForm.environment as any) || 'Production', status: (mepForm.status as MepStatus) || 'Brouillon',
        priority: (mepForm.priority as any) || 'Normale', goNoGo: (mepForm.goNoGo as any) || 'En attente',
        changeNumbers: cleanChanges.join(', '), ritmNumbers: cleanRitms.join(', '),
        changeUrl: normalizeServiceNowUrl(mepForm.changeUrl), ritmUrl: normalizeServiceNowUrl(mepForm.ritmUrl),
        itsmReferences, trigrams: selectedTrigrams,
        rollback: (mepForm.rollback || '').trim(), description: (mepForm.description || '').trim(),
        people: cleanPeople, tasks: cleanTasks, minutes: [], runbook: normalizeRunbook(mepForm.runbook, mepForm.owner || currentUser.displayName || ''),
        createdAt: now, updatedAt: now,
      };
      const teamsUrl = buildTeamsMeetingUrl(savedMep);
      const teamsWindow = window.open(teamsUrl, '_blank');
      if (teamsWindow) teamsWindow.opener = null;
      showToast(teamsWindow ? 'MEP enregistrée — réunion Teams préparée avec les intervenants renseignés. Vérifiez puis envoyez l’invitation dans Teams.' : 'MEP enregistrée. Autorisez les fenêtres contextuelles pour ouvrir la réunion Teams.');
    } else {
      showToast('MEP mise à jour — planning recalculé');
    }
  };

  const handleDeleteMep = (m: MepEntry) => {
    setConfirmAction({
      title: 'Supprimer cette MEP ?',
      message: `La fiche "${m.title}" (${getMepRef(m)}) et toutes ses tâches associées seront supprimées.`,
      confirmLabel: 'Supprimer la MEP',
      danger: true,
      onConfirm: () => {
        const project = clarityProjects.find((item) => item.id === m.projectId);
        if (project && onUpdateProject) {
          const mepTag = `MEP:${m.ref || m.id}`;
          onUpdateProject({ ...project, tasks: project.tasks.map((task) => ({ ...task, tags: (task.tags || []).filter((tag) => tag !== mepTag) })) });
        }
        // A linked project task remains in the project as a normal task; only its MEP link is removed.
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

  const handleImportMepsJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const source = Array.isArray(parsed) ? parsed
        : Array.isArray(parsed?.meps) ? parsed.meps
        : Array.isArray(parsed?.mep) ? parsed.mep : null;
      if (!source) throw new Error('Le JSON doit contenir un tableau MEP, meps ou mep.');
      const existingIds = new Set(db.mep.map((m) => m.id));
      const imported = source.map((raw: any) => {
        const mep = normalizeMep(raw, clarityProjects);
        if (existingIds.has(mep.id)) mep.id = uid('MEP');
        existingIds.add(mep.id);
        mep.minutes = mep.minutes.map((minute) => ({ ...minute, mepId: mep.id }));
        return mep;
      });
      if (!imported.length) throw new Error('Le fichier ne contient aucune MEP.');
      setConfirmAction({
        title: 'Ajouter les MEP du fichier JSON ?',
        message: `Ajouter ${imported.length} MEP au portefeuille actuel sans supprimer les ${db.mep.length} MEP existantes ? Les prérequis, étapes, intervenants, tâches, jalons, Change, RITM, comptes rendus et plans de retour arrière seront importés.`,
        confirmLabel: 'Ajouter les MEP',
        onConfirm: () => {
          persistDb({ ...db, mep: [...db.mep, ...imported] });
          setConfirmAction(null);
          showToast(`${imported.length} MEP importée(s)`);
        },
      });
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Fichier JSON invalide ou incompatible');
    }
  };

  const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const source = Array.isArray(parsed) ? parsed
        : Array.isArray(parsed?.meps) ? parsed.meps
        : Array.isArray(parsed?.mep) ? parsed.mep : null;
      if (!source) throw new Error('Format invalide : tableau MEP, meps ou mep attendu.');
      const restoredMeps = source.map((raw: any) => {
        const mep = normalizeMep(raw, clarityProjects);
        return { ...mep, projectId: '', project: mep.title };
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

  const navItems: { id: ProdPilotPage; label: string; icon: any; badge?: string | number }[] = [
    { id: 'mep', label: 'Registre des MEP', icon: Rocket, badge: db.mep.length },
    { id: 'planning', label: 'Planning & calendrier', icon: CalendarIcon },
    { id: 'coproj', label: 'COPROJ – Synthèse périmètre', icon: FileText },
    { id: 'minutes', label: 'Comptes rendus & mails', icon: Mail },
    { id: 'settings', label: 'Paramètres & sauvegarde', icon: Settings },
  ];

  if (!mepLoaded) return <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-sm text-slate-500"><span>{mepLoadError || 'Chargement des MEP depuis PostgreSQL…'}</span>{mepLoadError && <button onClick={() => window.location.reload()} className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold">Réessayer</button>}</div>;

  return (
    <div className="space-y-5">
      {/* Clarity-Styled ProdPilot Workspace Header & Navigation Strip */}
      {!dashboardOnly && <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-4">
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
              onClick={() => mepImportInputRef.current?.click()}
              className="px-3.5 py-2 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Ajouter depuis JSON</span>
            </button>
            <input ref={mepImportInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleImportMepsJson} />
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
      </div>}

      {/* =====================================================================
          1. DASHBOARD (VUE GÉNÉRALE)
         ===================================================================== */}

      {/* =====================================================================
          2. MISES EN PRODUCTION (TABLE + FILTERS + CRUD)
         ===================================================================== */}
      {page === 'mep' && !dashboardOnly && (
        <div className="space-y-4">
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
                            <div className="flex flex-wrap gap-x-2 gap-y-1 font-mono font-semibold text-sky-700">
                              {parseItsmNumbers(x.changeNumbers || '').length ? parseItsmNumbers(x.changeNumbers || '').map((number) => {
                                const url = getItsmNumberUrl(x, 'CHANGE', number);
                                return url ? <a key={number} href={url} target="_blank" rel="noopener noreferrer" title={`Ouvrir le Change ${number} dans ServiceNow`} className="underline hover:text-indigo-700">{number}</a> : <span key={number}>{number}</span>;
                              }) : '—'}
                            </div>
                            {x.ritmNumbers && (
                              <div className="text-[11px] font-mono text-slate-500 flex flex-wrap gap-x-2 gap-y-1">
                                <span>RITM :</span>
                                {parseItsmNumbers(x.ritmNumbers).map((number) => {
                                  const url = getItsmNumberUrl(x, 'RITM', number);
                                  return url ? <a key={number} href={url} target="_blank" rel="noopener noreferrer" title={`Ouvrir le RITM ${number} dans ServiceNow`} className="underline hover:text-indigo-700">{number}</a> : <span key={number}>{number}</span>;
                                })}
                              </div>
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
                              onClick={() => openRunbook(x)}
                              className="px-2 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 cursor-pointer inline-flex items-center gap-1 text-[10px] font-bold"
                              title="Ouvrir le chronogramme et le pilotage opérationnel"
                            >
                              <Play className="w-3 h-3" /> Pilotage
                            </button>
                            <button
                              onClick={() => cloneMep(x)}
                              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 cursor-pointer"
                              title="Cloner cette MEP (conserver le modèle, réinitialiser l'exécution)"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
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

      {page === 'mep' && selectedRunbookMep && selectedRunbook && (
        <div className="fixed inset-0 z-[60] bg-slate-950/50 backdrop-blur-sm p-2 sm:p-5 flex items-center justify-center">
          <section className="w-full max-w-7xl max-h-[96vh] overflow-hidden rounded-2xl bg-slate-50 border border-slate-200 shadow-2xl flex flex-col">
            <header className="bg-white border-b border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Chronogramme opérationnel · {getMepRef(selectedRunbookMep)}</div>
                <h3 className="text-lg font-black text-slate-900 truncate">{selectedRunbookMep.title}</h3>
                <p className="text-xs text-slate-500">{selectedRunbookMep.changeNumbers || 'Change à renseigner'} · {fmtDate(selectedRunbookMep.date)} · {selectedRunbookMep.owner}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="min-w-28">
                  <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1"><span>Avancement runbook</span><span>{getRunbookProgress(selectedRunbook)}%</span></div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-indigo-600 rounded-full" style={{width:`${getRunbookProgress(selectedRunbook)}%`}} /></div>
                </div>
                <button onClick={() => setSelectedRunbookId(null)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500" aria-label="Fermer le pilotage"><X className="w-5 h-5" /></button>
              </div>
            </header>
            <nav className="bg-white px-3 py-2 border-b border-slate-200 flex gap-1 overflow-x-auto">
              {([{id:'settings',label:'Paramètres & destinataires'},{id:'prerequisites',label:'Prérequis'},{id:'execution',label:'Chronogramme & GO/FIN'},{id:'rollback',label:'DAG, rollback & journal'}] as const).map(tab => (
                <button key={tab.id} onClick={() => setRunbookTab(tab.id)} className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap ${runbookTab===tab.id?'bg-indigo-50 text-indigo-700':'text-slate-500 hover:bg-slate-50'}`}>{tab.label}</button>
              ))}
            </nav>
            <div className="p-4 sm:p-5 overflow-y-auto space-y-5">
              {runbookTab === 'settings' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <label className="text-xs font-bold text-slate-700">Type de MEP
                      <select value={selectedRunbook.type} onChange={e=>saveRunbook({type:e.target.value as 'Majeure'|'Mineure'})} className="mt-1 w-full p-2.5 rounded-lg border border-slate-300 bg-white"><option>Majeure</option><option>Mineure</option></select>
                    </label>
                    <label className="text-xs font-bold text-slate-700">Téléphone du pilotage
                      <input value={selectedRunbook.pilotPhone} onChange={e=>saveRunbook({pilotPhone:e.target.value})} placeholder="Téléphone / pont" className="mt-1 w-full p-2.5 rounded-lg border border-slate-300 bg-white" />
                    </label>
                    <label className="text-xs font-bold text-slate-700">Trigramme
                      <input value={selectedRunbook.trigram} onChange={e=>saveRunbook({trigram:e.target.value})} placeholder="Ex. MDM MDO" className="mt-1 w-full p-2.5 rounded-lg border border-slate-300 bg-white" />
                    </label>
                    <label className="text-xs font-bold text-slate-700">Code application
                      <input value={selectedRunbook.applicationCode} onChange={e=>saveRunbook({applicationCode:e.target.value})} placeholder="Code applicatif" className="mt-1 w-full p-2.5 rounded-lg border border-slate-300 bg-white" />
                    </label>
                    <label className="text-xs font-bold text-slate-700">Début prévu
                      <input type="time" value={selectedRunbook.plannedStart} onChange={e=>saveRunbook({plannedStart:e.target.value})} className="mt-1 w-full p-2.5 rounded-lg border border-slate-300 bg-white" />
                    </label>
                    <label className="text-xs font-bold text-slate-700">Fin prévue
                      <input type="time" value={selectedRunbook.plannedEnd} onChange={e=>saveRunbook({plannedEnd:e.target.value})} className="mt-1 w-full p-2.5 rounded-lg border border-slate-300 bg-white" />
                    </label>
                    <label className="text-xs font-bold text-slate-700">Échelle de la frise
                      <select value={String(selectedRunbook.timelineScale)} onChange={e=>saveRunbook({timelineScale:e.target.value==='Auto'?'Auto':Number(e.target.value) as 5|10|15|20|30|60|120})} className="mt-1 w-full p-2.5 rounded-lg border border-slate-300 bg-white">{['Auto','5','10','15','20','30','60','120'].map(x=><option key={x} value={x}>{x==='Auto'?'Automatique':x+' min'}</option>)}</select>
                    </label>
                    <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3 text-xs text-indigo-800 flex items-center">{selectedRunbook.type==='Majeure'?'MEP majeure : la mise à jour du DAG est requise et entre dans le calcul.':'MEP mineure : l’étape DAG est affichée mais exclue de l’avancement.'}</div>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <label className="block text-xs font-bold text-slate-700">Destinataires principaux (À)
                        <textarea rows={3} value={selectedRunbook.recipients.filter(r=>r.to).map(r=>r.email).filter(Boolean).join(', ')} onChange={e=>saveRunbook({recipients:[...selectedRunbook.recipients.filter(r=>!r.to&&!r.cc),{id:'recipients-to',name:'',email:e.target.value,information:false,sondes:false,start:false,end:false,teams:false,coproj:false,pss:false,to:true,cc:false},...selectedRunbook.recipients.filter(r=>r.cc).map(r=>({...r,to:false}))]})} placeholder="prenom.nom@entreprise.fr, equipe@entreprise.fr" className="mt-1 w-full p-3 border border-slate-300 rounded-lg font-normal" />
                        <span className="mt-1 block text-[11px] font-normal text-slate-500">Adresses séparées par des virgules.</span>
                      </label>
                      <label className="block text-xs font-bold text-slate-700">Destinataires en copie (Cc)
                        <textarea rows={3} value={selectedRunbook.recipients.filter(r=>r.cc).map(r=>r.email).filter(Boolean).join(', ')} onChange={e=>saveRunbook({recipients:[...selectedRunbook.recipients.filter(r=>!r.to&&!r.cc),...selectedRunbook.recipients.filter(r=>r.to).map(r=>({...r,cc:false})),{id:'recipients-cc',name:'',email:e.target.value,information:false,sondes:false,start:false,end:false,teams:false,coproj:false,pss:false,to:false,cc:true}]})} placeholder="manager@entreprise.fr, support@entreprise.fr" className="mt-1 w-full p-3 border border-slate-300 rounded-lg font-normal" />
                        <span className="mt-1 block text-[11px] font-normal text-slate-500">Adresses séparées par des virgules.</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}
              {runbookTab === 'prerequisites' && (
                <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                  <div className="flex items-center justify-between"><div><h4 className="text-sm font-black text-slate-900">1 · Prérequis de l’opération</h4><p className="text-xs text-slate-500">Uniquement les dates de chaque prérequis.</p></div></div>
                  <div className="space-y-2">{selectedRunbook.prerequisites.map((item,i)=><div key={item.id} className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_1fr_1fr] gap-2 p-3 rounded-lg bg-slate-50 border border-slate-100 items-center"><div className="text-xs font-semibold text-slate-800">{item.title || `Prérequis ${i+1}`}</div><label className="text-[10px] font-semibold text-slate-500">Date de début<input type="date" value={item.startAt.slice(0,10)} onChange={e=>updateRunbookCollection('prerequisites',item.id,{startAt:e.target.value})} className="mt-1 w-full p-2 border rounded text-xs bg-white" /></label><label className="text-[10px] font-semibold text-slate-500">Date de fin<input type="date" value={item.endAt.slice(0,10)} onChange={e=>updateRunbookCollection('prerequisites',item.id,{endAt:e.target.value})} className="mt-1 w-full p-2 border rounded text-xs bg-white" /></label></div>)}</div>
                </div>
              )}
              {runbookTab === 'execution' && (
                <div className="space-y-4">
                  <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                    <div className="flex items-center justify-between"><div><h4 className="text-sm font-black text-slate-900">2 · Chronogramme de l’opération</h4><p className="text-xs text-slate-500">Étape, début, fin, statut et actions GO / FIN.</p></div><button onClick={()=>addRunbookItem('executionSteps')} className="px-3 py-2 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold">+ Étape</button></div>
                    <div className="overflow-x-auto"><table className="w-full text-xs min-w-[780px]"><thead><tr className="text-left text-[10px] uppercase text-slate-500 border-b"><th className="p-2">Étape</th><th className="p-2">Début</th><th className="p-2">Fin</th><th className="p-2">Statut</th><th className="p-2">Actions</th></tr></thead><tbody>{selectedRunbook.executionSteps.map(step=><tr key={step.id} className="border-b border-slate-100"><td className="p-1"><input value={step.title} onChange={e=>updateRunbookCollection('executionSteps',step.id,{title:e.target.value})} className="w-full min-w-56 p-2 border rounded" /></td><td className="p-1"><input type="time" value={step.startTime} onChange={e=>updateRunbookCollection('executionSteps',step.id,{startTime:e.target.value})} className="p-2 border rounded" /></td><td className="p-1"><input type="time" value={step.endTime} onChange={e=>updateRunbookCollection('executionSteps',step.id,{endTime:e.target.value})} className="p-2 border rounded" /></td><td className="p-1"><select value={step.status} onChange={e=>updateRunbookCollection('executionSteps',step.id,{status:e.target.value as MepRunbookStatus})} className="p-2 border rounded">{RUNBOOK_STATUSES.map(status=><option key={status}>{status}</option>)}</select></td><td className="p-1 whitespace-nowrap"><button onClick={()=>recordRunbookStep(step,'GO')} className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 font-bold mr-1">GO</button><button onClick={()=>recordRunbookStep(step,'FIN')} className="px-2 py-1 rounded bg-sky-50 text-sky-700 font-bold mr-1">FIN</button><button onClick={()=>removeRunbookItem('executionSteps',step.id)} className="p-1 text-rose-600"><X className="w-4 h-4"/></button></td></tr>)}</tbody></table></div>
                    <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs font-bold text-slate-700 mb-2">Frise horaire — fenêtre {selectedRunbook.plannedStart} à {selectedRunbook.plannedEnd} · pas {selectedRunbook.timelineScale==='Auto'?'automatique':selectedRunbook.timelineScale+' min'}</div><div className="space-y-2">{selectedRunbook.executionSteps.map((s,i)=><div key={s.id} className="grid grid-cols-[28px_1fr_120px] gap-2 items-center text-[11px]"><span className="font-mono text-slate-400">{i+1}</span><div className="min-w-0"><div className="font-semibold text-slate-700 truncate">{s.title}</div><div className="h-2 bg-slate-200 rounded-full relative overflow-hidden mt-1"><div className={`absolute top-0 bottom-0 rounded-full ${s.status==='KO'?'bg-rose-500':s.status==='OK'?'bg-emerald-500':s.status==='En cours'?'bg-sky-500':'bg-indigo-300'}`} style={getTimelineBarStyle(s,selectedRunbook)} /></div></div><span className="font-mono text-right text-slate-500">{s.startTime||'--:--'} → {s.endTime||'--:--'}</span></div>)}</div></div>
                  </div>
                </div>
              )}
              {runbookTab === 'rollback' && (
                <div className="space-y-4">
                  <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3"><div><h4 className="text-sm font-black text-slate-900">3 · Fin d’opération — mise à jour du DAG</h4><p className="text-xs text-slate-500">{selectedRunbook.type==='Majeure'?'Étape obligatoire et incluse dans l’avancement global.':'Non requise pour une MEP mineure, exclue du calcul.'}</p></div><span className="text-xs font-bold text-slate-600">{selectedRunbook.type}</span></div>
                    <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 items-center"><input aria-label="Étape DAG" value={selectedRunbook.dag.title} onChange={e=>saveRunbook({dag:{...selectedRunbook.dag,title:e.target.value}})} className="p-2 border rounded text-xs" /><input aria-label="Début DAG" type="time" value={selectedRunbook.dag.startTime} onChange={e=>saveRunbook({dag:{...selectedRunbook.dag,startTime:e.target.value}})} className="p-2 border rounded text-xs" /><input aria-label="Fin DAG" type="time" value={selectedRunbook.dag.endTime} onChange={e=>saveRunbook({dag:{...selectedRunbook.dag,endTime:e.target.value}})} className="p-2 border rounded text-xs" /><select aria-label="Statut DAG" value={selectedRunbook.dag.status} onChange={e=>saveRunbook({dag:{...selectedRunbook.dag,status:e.target.value as MepRunbookStatus}})} className="p-2 border rounded text-xs">{RUNBOOK_STATUSES.map(status=><option key={status}>{status}</option>)}</select><div className="flex gap-1"><button onClick={()=>recordRunbookStep(selectedRunbook.dag,'GO','dag')} className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded text-xs font-bold">GO</button><button onClick={()=>recordRunbookStep(selectedRunbook.dag,'FIN','dag')} className="px-2 py-1 bg-sky-50 text-sky-700 rounded text-xs font-bold">FIN</button></div></div>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                    <div className="flex items-center justify-between"><div><h4 className="text-sm font-black text-slate-900">4 · Plan de rollback</h4><p className="text-xs text-slate-500">Le plan est préparé mais exclu de l’avancement tant qu’il n’est pas déclenché.</p></div><label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={selectedRunbook.rollbackEnabled} onChange={e=>saveRunbook({rollbackEnabled:e.target.checked,rollbackTriggered:e.target.checked?selectedRunbook.rollbackTriggered:false})}/> Plan activé</label></div>
                    <div className="flex items-center justify-between flex-wrap gap-2"><span className={`px-3 py-1 rounded-full text-xs font-bold ${selectedRunbook.rollbackTriggered?'bg-rose-100 text-rose-700':'bg-amber-50 text-amber-800'}`}>{selectedRunbook.rollbackTriggered?'ROLLBACK DÉCLENCHÉ':'PLAN DE REPLI NON DÉCLENCHÉ'}</span><button disabled={!selectedRunbook.rollbackEnabled||selectedRunbook.rollbackTriggered} onClick={()=>saveRunbook({rollbackTriggered:true,events:[...selectedRunbook.events,{id:uid('EVT'),type:'ROLLBACK',actor:'',at:new Date().toISOString(),comment:'Déclenchement du plan de repli'}].slice(-100)})} className="px-3 py-2 rounded-lg bg-rose-600 text-white text-xs font-bold disabled:opacity-40">Déclencher le rollback</button></div>
                    {selectedRunbook.rollbackSteps.map((step,i)=><div key={step.id} className="grid grid-cols-1 md:grid-cols-[30px_2fr_1fr_1fr_110px_auto] gap-2 items-center p-2 bg-slate-50 rounded-lg"><span className="text-xs font-bold text-rose-600">R{i+1}</span><input aria-label="Étape rollback" value={step.title} onChange={e=>updateRunbookCollection('rollbackSteps',step.id,{title:e.target.value})} className="p-2 border rounded text-xs" /><input aria-label="Début rollback" type="time" value={step.startTime} onChange={e=>updateRunbookCollection('rollbackSteps',step.id,{startTime:e.target.value})} className="p-2 border rounded text-xs" /><input aria-label="Fin rollback" type="time" value={step.endTime} onChange={e=>updateRunbookCollection('rollbackSteps',step.id,{endTime:e.target.value})} className="p-2 border rounded text-xs" /><select aria-label="Statut rollback" value={step.status} onChange={e=>updateRunbookCollection('rollbackSteps',step.id,{status:e.target.value as MepRunbookStatus})} className="p-2 border rounded text-xs">{RUNBOOK_STATUSES.map(status=><option key={status}>{status}</option>)}</select><div className="flex items-center gap-1"><button onClick={()=>recordRunbookStep(step,'GO','rollbackSteps')} className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded text-xs font-bold">GO</button><button onClick={()=>recordRunbookStep(step,'FIN','rollbackSteps')} className="px-2 py-1 bg-sky-50 text-sky-700 rounded text-xs font-bold">FIN</button><button onClick={()=>removeRunbookItem('rollbackSteps',step.id)} className="text-rose-600"><X className="w-4 h-4"/></button></div></div>)}
                    <button onClick={()=>addRunbookItem('rollbackSteps')} className="px-3 py-2 rounded-lg bg-rose-50 text-rose-700 text-xs font-bold">+ Étape de rollback</button>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2"><h4 className="text-sm font-black text-slate-900">Journal GO / FIN / Rollback</h4>{selectedRunbook.events.length===0?<p className="text-xs text-slate-400">Aucun événement enregistré.</p>:<div className="space-y-2">{[...selectedRunbook.events].reverse().map(ev=><div key={ev.id} className="flex flex-wrap justify-between gap-2 text-xs border-b border-slate-100 pb-2"><span className="font-bold text-slate-700">{ev.type} · {ev.stepTitle||ev.comment||'Événement de pilotage'}</span><time className="font-mono text-slate-500">{new Date(ev.at).toLocaleString('fr-FR')}</time></div>)}</div>}</div>
                </div>
              )}
            </div>
            <footer className="bg-white border-t border-slate-200 p-3 flex items-center justify-between gap-3"><span className="text-[11px] text-slate-500">Enregistrement automatique dans PostgreSQL · données rattachées à cette MEP</span><button onClick={()=>setSelectedRunbookId(null)} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold">Fermer</button></footer>
          </section>
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
          5. COMPTES RENDUS
         ===================================================================== */}
      {page === 'coproj' && (
        <div className="space-y-4">
          <CommunicationAssistant projects={clarityProjects} meps={db.mep} scopes={scopes} allowedModes={['coproj']} initialMode="coproj" />
        </div>
      )}

      {page === 'minutes' && (
        <div className="space-y-4">
          <CommunicationAssistant projects={clarityProjects} meps={db.mep} scopes={scopes} allowedModes={['mep-start', 'mep-end']} initialMode="mep-start" />
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
              <option value="">Toutes les applications</option>
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">Code application</label>
                  <input type="text" value={mepForm.applicationCode || ''} onChange={(e) => setMepForm({ ...mepForm, applicationCode: e.target.value.toUpperCase() })} placeholder="Ex. : APP-CRM" className="w-full text-xs p-2.5 rounded-xl border border-slate-300 font-mono" />
                  <p className="text-[10px] text-slate-500 mt-1">La MEP est rattachée à une application, indépendamment des projets Clarity.</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Périmètre(s) applicatif(s) *</label>
                  <select multiple required value={mepForm.scopeIds || []} onChange={(e) => {
                    const scopeIds = Array.from(e.target.selectedOptions).map((option) => option.value);
                    const allowed = new Set(scopes.filter((scope) => scopeIds.includes(scope.id)).flatMap((scope) => scope.trigrams || []).map((value) => String(value).toUpperCase()));
                    setMepForm({ ...mepForm, scopeIds, trigrams: (mepForm.trigrams || []).filter((value) => allowed.has(String(value).toUpperCase())) });
                  }} className="w-full min-h-24 text-xs p-2.5 rounded-xl border border-slate-300 bg-white">
                    {scopes.map((scope) => <option key={scope.id} value={scope.id}>{scope.code} — {scope.name}</option>)}
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">Sélection multiple possible. Les trigrammes sont limités aux périmètres choisis.</p>
                  {!scopes.length && <p className="text-xs text-rose-600 mt-1">Aucun périmètre n’est configuré dans le référentiel Clarity.</p>}
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">Trigrammes concernés *</label>
                  <select multiple required value={mepForm.trigrams || []} onChange={(e) => setMepForm({ ...mepForm, trigrams: Array.from(e.target.selectedOptions).map((option) => option.value) })} className="w-full min-h-24 text-xs p-2.5 rounded-xl border border-slate-300 bg-white">
                    {Array.from(new Set(scopes.filter((scope) => (mepForm.scopeIds || []).includes(scope.id)).flatMap((scope) => scope.trigrams || []).map((value) => String(value).trim().toUpperCase()))).sort().map((trigram) => <option key={trigram} value={trigram}>{trigram}</option>)}
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">Seuls les trigrammes des périmètres sélectionnés sont disponibles.</p>
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
                    onChange={(e) => setMepForm({ ...mepForm, date: e.target.value, teamsMeetingStart: shiftLocalDateTime(e.target.value, -30), teamsMeetingEnd: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Début du point Teams</label>
                  <input type="datetime-local" value={mepForm.teamsMeetingStart || ''} onChange={(e) => setMepForm({ ...mepForm, teamsMeetingStart: e.target.value })} className="w-full text-xs p-2.5 rounded-xl border border-slate-300 font-mono" />
                  <p className="text-[10px] text-slate-500 mt-1">Par défaut : 30 minutes avant la MEP.</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Fin du point Teams</label>
                  <input type="datetime-local" value={mepForm.teamsMeetingEnd || ''} onChange={(e) => setMepForm({ ...mepForm, teamsMeetingEnd: e.target.value })} className="w-full text-xs p-2.5 rounded-xl border border-slate-300 font-mono" />
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
                  <textarea
                    rows={2}
                    value={mepForm.changeNumbers || ''}
                    onChange={(e) => setMepForm({ ...mepForm, changeNumbers: e.target.value })}
                    placeholder="Un numéro par ligne : CHG0048921, CHG0048922"
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Lien(s) Change — un lien par numéro, dans le même ordre</label>
                  <textarea
                    rows={2}
                    value={mepForm.changeUrls || mepForm.changeUrl || ''}
                    onChange={(e) => setMepForm({ ...mepForm, changeUrls: e.target.value, changeUrl: e.target.value.split(/\r?\n/)[0] || '' })}
                    placeholder="https://instance.service-now.com/change_request.do?sys_id=... (une URL par ligne)"
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 font-mono"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Le premier lien correspond au premier Change, le deuxième au deuxième, etc.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Référence(s) RITM (facultatif)</label>
                  <textarea
                    rows={2}
                    value={mepForm.ritmNumbers || ''}
                    onChange={(e) => setMepForm({ ...mepForm, ritmNumbers: e.target.value })}
                    placeholder="Une référence par ligne : RITM0112450, RITM0112451"
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Lien(s) RITM — un lien par numéro, dans le même ordre</label>
                  <textarea
                    rows={2}
                    value={mepForm.ritmUrls || mepForm.ritmUrl || ''}
                    onChange={(e) => setMepForm({ ...mepForm, ritmUrls: e.target.value, ritmUrl: e.target.value.split(/\r?\n/)[0] || '' })}
                    placeholder="https://instance.service-now.com/sc_req_item.do?sys_id=... (une URL par ligne)"
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 font-mono"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Le premier lien correspond au premier RITM, le deuxième au deuxième, etc.</p>
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
                    <p className="text-xs text-slate-500">Ajoutez les personnes mobilisées, leur rôle et leur e-mail professionnel : elles seront proposées comme participants au point Teams.</p>
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
                      <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_36px] gap-2">
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
                        <input
                          type="email"
                          placeholder="E-mail professionnel (invitation Teams)"
                          value={p.email || ''}
                          onChange={(e) => {
                            const next = [...personDraft];
                            next[i].email = e.target.value;
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
                        className="grid grid-cols-1 md:grid-cols-[2fr_90px_1fr_80px_70px_1fr_34px] gap-2 items-center p-2 rounded-xl bg-slate-50 border border-slate-200"
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
