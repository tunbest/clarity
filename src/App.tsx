import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Project, 
  Task, 
  Milestone, 
  Risk, 
  KPIWidget, 
  TaskStatus, 
  RiskStatus,
  AppUser,
  UserRole,
  PortfolioScope
} from './types';
import { INITIAL_PROJECTS } from './data/initialData';
import { calculateProjectMetrics } from './utils/pmCalculations';


// Components
import { Navbar } from './components/Navbar';
import { KPIDashboard } from './components/KPIDashboard';
import { KanbanBoard } from './components/KanbanBoard';
import { GanttTimeline } from './components/GanttTimeline';
import { TaskListView } from './components/TaskListView';
import { RiskMatrix } from './components/RiskMatrix';
import { TeamWorkload } from './components/TeamWorkload';
import { PortfolioOverview } from './components/PortfolioOverview';
import { AdminPage } from './components/AdminPage';
import { ContributorPortal } from './components/ContributorPortal';
import { ProductionReleasePortal } from './components/ProductionReleasePortal';

// Modals
import { AIAssistantModal } from './components/AIAssistantModal';
import { WidgetCustomizerModal } from './components/WidgetCustomizerModal';
import { AddEditTaskModal } from './components/AddEditTaskModal';
import { AddEditMilestoneModal } from './components/AddEditMilestoneModal';
import { AddEditRiskModal } from './components/AddEditRiskModal';
import { AddEditProjectModal } from './components/AddEditProjectModal';
import { LoginPage } from './components/LoginPage';

const upsertById = <T extends { id: string }>(items: T[], item: T): T[] => {
  const exists = items.some((current) => current.id === item.id);
  return exists ? items.map((current) => (current.id === item.id ? item : current)) : [...items, item];
};

export type MainTab = 'DASHBOARD' | 'KANBAN' | 'GANTT' | 'TASKS' | 'RISKS' | 'TEAM' | 'PORTFOLIO' | 'ADMIN' | 'CONTRIBUTOR' | 'PROD_RELEASES';

const PROJECT_MANAGER_TABS: MainTab[] = ['PORTFOLIO', 'DASHBOARD', 'KANBAN', 'GANTT', 'TASKS', 'RISKS', 'TEAM', 'PROD_RELEASES'];

const ROLE_PERMITTED_TABS: Record<UserRole, MainTab[]> = {
  ADMINISTRATEUR: ['ADMIN', 'PROD_RELEASES'],
  DIRECTEUR_PROJETS: ['PORTFOLIO', 'DASHBOARD', 'RISKS', 'TEAM', 'PROD_RELEASES'],
  PMO: ['PORTFOLIO', 'DASHBOARD', 'GANTT', 'TASKS', 'RISKS', 'PROD_RELEASES'],
  CHEF_PROJET: PROJECT_MANAGER_TABS,
  CHEF_PROJET_PROD: PROJECT_MANAGER_TABS,
  CONTRIBUTEUR: ['CONTRIBUTOR'],
};

const getDefaultTabForRole = (role?: UserRole): MainTab => {
  switch (role) {
    case 'ADMINISTRATEUR':
      return 'ADMIN';
    case 'DIRECTEUR_PROJETS':
      return 'PORTFOLIO';
    case 'PMO':
      return 'PORTFOLIO';
    case 'CHEF_PROJET_PROD':
    case 'CHEF_PROJET':
      return 'DASHBOARD';
    case 'CONTRIBUTEUR':
      return 'CONTRIBUTOR';
    default:
      return 'DASHBOARD';
  }
};

export const App: React.FC = () => {
  // Server-side session: the HttpOnly cookie is the only authentication source.
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);

  useEffect(() => { let active = true; fetch('/api/auth/me', { credentials: 'same-origin' }).then(async (r) => { if (!r.ok) throw new Error('Session indisponible'); return r.json(); }).then((data) => { if (active) setCurrentUser(data.isAuthenticated ? data.user : null); }).catch((err) => { console.error('Vérification de session impossible:', err); if (active) setWorkspaceError('Impossible de joindre le serveur Clarity.'); }); return () => { active = false; }; }, []);

  const handleLoginSuccess = (user: AppUser) => {
    setCurrentUser(user);
    if (user.role) {
      setActiveTab(getDefaultTabForRole(user.role));
    }
  };



  const handleLogout = async () => { try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }); } finally { setCurrentUser(null); } };


  // Portefeuille centralisé dans PostgreSQL.
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [scopes, setScopes] = useState<PortfolioScope[]>([]);
  const [scopesRevision, setScopesRevision] = useState(1);
  const [projectManagers, setProjectManagers] = useState<Array<{id:string;displayName:string;email:string;jobTitle?:string;department?:string;disabled:boolean}>>([]);
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const workspaceRevisionRef = useRef(0);
  const workspaceWriteQueue = useRef<Promise<void>>(Promise.resolve());
  const [workspaceImportVersion, setWorkspaceImportVersion] = useState(0);
  useEffect(() => {
    if (!currentUser) { setWorkspaceLoaded(false); return; }
    let active = true;
    fetch('/api/workspace', { credentials: 'same-origin' }).then(async (r) => { const data = await r.json(); if (!r.ok) throw new Error(data.error || 'Chargement du portefeuille impossible'); return data; }).then((snapshot) => { if (!active) return; setProjects(snapshot.projects || []); workspaceRevisionRef.current = snapshot.revision || 1; setWorkspaceLoaded(true); setWorkspaceError(null); }).catch((err) => { console.error(err); if (active) { setWorkspaceError(err.message || 'Impossible de charger le portefeuille serveur.'); setWorkspaceLoaded(false); } });
    return () => { active = false; };
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser) { setScopes([]); setProjectManagers([]); return; }
    let active = true;
    fetch('/api/scopes', { credentials: 'same-origin' }).then(async (r) => { const data = await r.json(); if (!r.ok) throw new Error(data.error || 'Chargement des périmètres impossible'); return data; }).then((data) => { if (!active) return; setScopes(data.scopes || []); setScopesRevision(Number(data.revision) || 1); }).catch((err) => { console.error('Chargement périmètres:', err); if (active) setWorkspaceError(err.message || 'Chargement des périmètres impossible.'); });
    return () => { active = false; };
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser || !['DIRECTEUR_PROJETS','ADMINISTRATEUR'].includes(currentUser.role || '')) { setProjectManagers([]); return; }
    let active=true;fetch('/api/project-managers',{credentials:'same-origin'}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||'Chargement des chefs de projet impossible');return d;}).then(d=>{if(active)setProjectManagers(d.managers||[]);}).catch(err=>{if(active)setWorkspaceError(err.message||'Chargement des chefs de projet impossible');});
    return()=>{active=false;};
  },[currentUser?.id,currentUser?.role]);

  const handleCreateProjectManager = async (payload: {displayName:string;email:string;password:string;department?:string}) => {
    const response=await fetch('/api/project-managers',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(payload)});const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error||'Création du chef de projet impossible.');setProjectManagers(current=>[...current,result.manager]);
  };
  const handleToggleProjectManager = async (id:string,disabled:boolean) => {
    const response=await fetch(`/api/project-managers/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({disabled})});const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error||'Modification du chef de projet impossible.');setProjectManagers(current=>current.map(manager=>manager.id===id?result.manager:manager));
  };

  const handleSaveScopes = async (nextScopes: PortfolioScope[]) => {
    const response = await fetch('/api/scopes', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ scopes: nextScopes, revision: scopesRevision }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Enregistrement des périmètres impossible.');
    setScopes(nextScopes);
    setScopesRevision(Number(result.revision) || scopesRevision + 1);
  };

  const handleImportCatalog = async (payload: any) => {
    if (!payload || payload.format !== 'clarity-catalog' || payload.version !== 1 || !Array.isArray(payload.scopes) || !Array.isArray(payload.projects)) throw new Error('JSON invalide : format clarity-catalog version 1 attendu.');
    const now = new Date().toISOString();
    const mergedScopes = scopes.map(scope => ({ ...scope, trigrams: [...scope.trigrams] }));
    for (const item of payload.scopes) {
      const code = String(item?.code || '').trim().toUpperCase();
      const name = String(item?.name || '').trim();
      if (!code || !name || !Array.isArray(item.trigrams)) throw new Error('Chaque périmètre doit contenir code, name et trigrams[].');
      const normalizedTrigrams = Array.from(new Set(item.trigrams.map((value: unknown) => String(value || '').trim().toUpperCase()).filter(Boolean)));
      const existing = mergedScopes.find((scope) => scope.code.toUpperCase() === code);
      if (existing) {
        existing.trigrams = Array.from(new Set([...existing.trigrams, ...normalizedTrigrams]));
        existing.updatedAt = now;
      } else {
        mergedScopes.push({ id: `SCOPE-${code}-${Date.now().toString(36).toUpperCase()}`, code, name, description: String(item.description || ''), trigrams: normalizedTrigrams, createdAt: now, updatedAt: now });
      }
    }
    const additions: Project[] = [];
    const updates = new Map<string, Project>();
    for (const item of payload.projects) {
      const code = String(item?.code || '').trim().toUpperCase();
      const name = String(item?.name || '').trim();
      const scopeCode = String(item?.scopeCode || '').trim().toUpperCase();
      if (!code || !name || !scopeCode || !Array.isArray(item.trigrams)) throw new Error('Chaque projet doit contenir code, name, scopeCode et trigrams[].');
      const scope = mergedScopes.find((value) => value.code.toUpperCase() === scopeCode);
      if (!scope) throw new Error(`Périmètre introuvable pour le projet ${code} : ${scopeCode}`);
      const trigrams = Array.from(new Set(item.trigrams.map((value: unknown) => String(value || '').trim().toUpperCase()).filter(Boolean)));
      if (trigrams.some((value) => !scope.trigrams.includes(value))) throw new Error(`Les trigrammes du projet ${code} doivent être définis dans le périmètre ${scopeCode}.`);
      const existing = projects.find((project) => project.code.toUpperCase() === code);
      if (existing) updates.set(existing.id, { ...existing, name, description: String(item.description || existing.description || ''), scopeId: scope.id, trigrams, updatedAt: now });
      else additions.push({ id: `proj-${Date.now()}-${additions.length}`, code, name, description: String(item.description || ''), scopeId: scope.id, trigrams, client: '', managerId: currentUser?.role === 'CHEF_PROJET' ? currentUser.id : undefined, managerName: currentUser?.displayName || '', status: 'PLANNING', projectStatus: 'Planning', priority: 'MEDIUM', methodology: 'HYBRID', startDate: now.slice(0,10), endDate: new Date(Date.now()+90*86400000).toISOString().slice(0,10), members: [], tasks: [], milestones: [], risks: [], kpiWidgets: [], createdAt: now, updatedAt: now });
    }
    if (currentUser?.role === 'CHEF_PROJET') {
      const changedReference = mergedScopes.some(scope => { const old=scopes.find(s=>s.id===scope.id); return !old || old.code!==scope.code || old.name!==scope.name || old.trigrams.join('|')!==scope.trigrams.join('|'); });
      if (changedReference) throw new Error('Le référentiel des trigrammes est géré par le Directeur de Projets. Utilisez uniquement les trigrammes existants.');
    } else await handleSaveScopes(mergedScopes);
    setProjects((current) => [...current.map((project) => updates.get(project.id) || project), ...additions]);
  };

  const [activeProjectId, setActiveProjectId] = useState<string>(() => {
    return projects[0]?.id || 'proj-apollo-1';
  });

  const [activeTab, setActiveTab] = useState<MainTab>(() => {
    const savedRole = currentUser?.role;
    return getDefaultTabForRole(savedRole);
  });

  // Automatically enforce strict role view segregation whenever currentUser or their role changes
  useEffect(() => {
    if (!currentUser) return;
    const permitted = ROLE_PERMITTED_TABS[currentUser.role] || ['DASHBOARD'];
    if (!permitted.includes(activeTab)) {
      setActiveTab(getDefaultTabForRole(currentUser.role));
    }
  }, [currentUser?.role]);

  // Persist the complete project aggregate on the server with optimistic concurrency.
  useEffect(() => {
    if (!currentUser || !workspaceLoaded) return;
    const timeout = window.setTimeout(() => { workspaceWriteQueue.current = workspaceWriteQueue.current.then(async () => { const response = await fetch('/api/workspace', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ projects, revision: workspaceRevisionRef.current }) }); const result = await response.json().catch(() => ({})); if (response.status === 409) throw new Error('Le portefeuille a changé sur le serveur. Rechargez la page pour récupérer la dernière version.'); if (!response.ok) throw new Error(result.error || 'Échec de sauvegarde serveur'); workspaceRevisionRef.current = Number(result.revision) || workspaceRevisionRef.current + 1; setWorkspaceError(null); }).catch((err) => { console.error('Sauvegarde serveur:', err); setWorkspaceError(err instanceof Error ? err.message : 'Sauvegarde serveur impossible.'); }); }, 500);
    return () => window.clearTimeout(timeout);
  }, [projects, currentUser?.id, workspaceLoaded]);


  // Active Project & Metrics
  const activeProject = useMemo(() => {
    return projects.find((p) => p.id === activeProjectId) || projects[0];
  }, [projects, activeProjectId]);

  const metrics = useMemo(() => {
    if (!activeProject) return null;
    return calculateProjectMetrics(activeProject);
  }, [activeProject]);

  // Modal States
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
  const [isWidgetCustomizerOpen, setIsWidgetCustomizerOpen] = useState(false);
  const [taskModalState, setTaskModalState] = useState<{ isOpen: boolean; taskId?: string | null }>({
    isOpen: false,
    taskId: null,
  });
  const [milestoneModalState, setMilestoneModalState] = useState<{ isOpen: boolean; milestoneId?: string | null }>({
    isOpen: false,
    milestoneId: null,
  });
  const [riskModalState, setRiskModalState] = useState<{ isOpen: boolean; riskId?: string | null }>({
    isOpen: false,
    riskId: null,
  });
  const [projectModalState, setProjectModalState] = useState<{ isOpen: boolean; project?: Project | null }>({
    isOpen: false,
    project: null,
  });

  // Project Handlers
  const handleUpdateProject = (updated: Project) => {
    setProjects((current) => current.map((project) => (project.id === updated.id ? updated : project)));
  };

  const handleSaveProject = (savedProj: Project) => {
    const exists = projects.some((p) => p.id === savedProj.id);
    if (exists) {
      setProjects(projects.map((p) => (p.id === savedProj.id ? savedProj : p)));
    } else {
      setProjects([...projects, savedProj]);
      setActiveProjectId(savedProj.id);
      setActiveTab('DASHBOARD');
    }
  };

  const handleDeleteProject = async (projId: string) => {
    const previous = projects;
    const remaining = projects.filter((p) => p.id !== projId);
    // Update immediately so any pending debounced save of the previous snapshot is cancelled.
    setProjects(remaining);
    setActiveProjectId(remaining[0]?.id || '');
    try {
      await workspaceWriteQueue.current;
      const response = await fetch('/api/workspace', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ projects: remaining, revision: workspaceRevisionRef.current }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Suppression du projet impossible.');
      workspaceRevisionRef.current = Number(result.revision) || workspaceRevisionRef.current + 1;
      setWorkspaceError(null);
    } catch (error) {
      setProjects(previous);
      setActiveProjectId(previous[0]?.id || '');
      setWorkspaceError(error instanceof Error ? error.message : 'Suppression du projet impossible.');
    }
  };

  // Task Handlers
  const handleSaveTask = (task: Task) => {
    if (!activeProject) return;
    handleUpdateProject({ ...activeProject, tasks: upsertById(activeProject.tasks, task) });
  };

  const handleUpdateTaskStatus = (taskId: string, newStatus: TaskStatus) => {
    if (!activeProject) return;
    const updatedTasks = activeProject.tasks.map((t) => {
      if (t.id === taskId) {
        return {
          ...t,
          status: newStatus,
          completionPercent: newStatus === 'DONE' ? 100 : t.completionPercent,
        };
      }
      return t;
    });
    handleUpdateProject({ ...activeProject, tasks: updatedTasks });
  };

  const handleDeleteTask = (taskId: string) => {
    if (!activeProject) return;
    const updatedTasks = activeProject.tasks.filter((t) => t.id !== taskId);
    handleUpdateProject({ ...activeProject, tasks: updatedTasks });
  };

  const handleQuickAddTask = (status: TaskStatus, title: string) => {
    if (!activeProject) return;
    const newTask: Task = {
      id: `task-${Date.now()}`,
      projectId: activeProject.id,
      title,
      status,
      priority: 'MEDIUM',
      estimatedHours: 8,
      actualHours: 0,
      completionPercent: status === 'DONE' ? 100 : 0,
      startDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0],
      tags: ['Tâche'],
    };
    handleUpdateProject({ ...activeProject, tasks: [...activeProject.tasks, newTask] });
  };

  // Milestone Handlers
  const handleSaveMilestone = (ms: Milestone) => {
    if (!activeProject) return;
    handleUpdateProject({ ...activeProject, milestones: upsertById(activeProject.milestones, ms) });
  };

  const handleToggleMilestone = (milestoneId: string) => {
    if (!activeProject) return;
    const updatedMilestones = activeProject.milestones.map((m) =>
      m.id === milestoneId 
        ? { ...m, completed: !m.completed, actualDate: !m.completed ? new Date().toISOString().split('T')[0] : undefined } 
        : m
    );
    handleUpdateProject({ ...activeProject, milestones: updatedMilestones });
  };

  const handleDeleteMilestone = (msId: string) => {
    if (!activeProject) return;
    const updatedMilestones = activeProject.milestones.filter((m) => m.id !== msId);
    const updatedTasks = activeProject.tasks.map((task) => task.milestoneId === msId ? { ...task, milestoneId: undefined } : task);
    handleUpdateProject({ ...activeProject, milestones: updatedMilestones, tasks: updatedTasks });
  };

  // Export / import of the complete project and production workspace.
  const handleExportData = async () => {
    try {
      const response = await fetch('/api/meps', { credentials: 'same-origin' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Export des MEP impossible.');
      const backup = {
        format: 'clarity-workspace',
        version: 3,
        exportedAt: new Date().toISOString(),
        scopes,
        projects,
        meps: data.meps || [],
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `clarity-workspace-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setWorkspaceError(null);
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : 'Export JSON impossible.');
    }
  };

  const handleImportData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const importedProjects: Project[] = Array.isArray(parsed) ? parsed : parsed?.projects;
      if (!Array.isArray(importedProjects) || importedProjects.some((p: any) => !p || typeof p.id !== 'string' || typeof p.name !== 'string')) {
        throw new Error('JSON invalide : fournissez un tableau de projets ou une sauvegarde Clarity { projects, meps }.');
      }
      const ids = new Set<string>();
      for (const project of importedProjects) {
        if (ids.has(project.id)) throw new Error(`Identifiant projet dupliqué : ${project.id}`);
        ids.add(project.id);
      }
      const hasMepPayload = !Array.isArray(parsed) && (Array.isArray(parsed.meps) || Array.isArray(parsed.mep));
      if (hasMepPayload) {
        const meps = Array.isArray(parsed.meps) ? parsed.meps : parsed.mep;
        const workspaceResponse = await fetch('/api/workspace', { credentials: 'same-origin' });
        const workspace = await workspaceResponse.json();
        const mepResponse = await fetch('/api/meps', { credentials: 'same-origin' });
        const mepState = await mepResponse.json();
        if (!workspaceResponse.ok || !mepResponse.ok) throw new Error('Impossible de lire les versions actuelles avant import.');
        const importResponse = await fetch('/api/workspace/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            projects: importedProjects,
            meps,
            scopes: Array.isArray(parsed.scopes) ? parsed.scopes : undefined,
            workspaceRevision: Number(workspace.revision),
            mepRevision: Number(mepState.revision),
          }),
        });
        const result = await importResponse.json().catch(() => ({}));
        if (!importResponse.ok) throw new Error(result.error || 'Import complet refusé.');
        workspaceRevisionRef.current = Number(result.workspaceRevision) || workspaceRevisionRef.current + 1;
        setProjects(importedProjects);
        if (Array.isArray(parsed.scopes)) { setScopes(parsed.scopes); setScopesRevision((value) => value + 1); }
        setActiveProjectId(importedProjects[0]?.id || '');
        setWorkspaceImportVersion((value) => value + 1);
        setWorkspaceError(null);
      } else {
        await workspaceWriteQueue.current;
        const response = await fetch('/api/workspace', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ projects: importedProjects, revision: workspaceRevisionRef.current }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'Import projets refusé.');
        workspaceRevisionRef.current = Number(result.revision) || workspaceRevisionRef.current + 1;
        setProjects(importedProjects);
        setActiveProjectId(importedProjects[0]?.id || '');
        setWorkspaceError(null);
      }
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : 'Erreur lors de l’import JSON.');
    }
  };

  // Risk Handlers
  const handleSaveRisk = (risk: Risk) => {
    if (!activeProject) return;
    handleUpdateProject({ ...activeProject, risks: upsertById(activeProject.risks, risk) });
  };

  const handleUpdateRiskStatus = (riskId: string, status: RiskStatus) => {
    if (!activeProject) return;
    const updatedRisks = activeProject.risks.map((r) =>
      r.id === riskId ? { ...r, status } : r
    );
    handleUpdateProject({ ...activeProject, risks: updatedRisks });
  };

  const handleDeleteRisk = (riskId: string) => {
    if (!activeProject) return;
    const updatedRisks = activeProject.risks.filter((r) => r.id !== riskId);
    handleUpdateProject({ ...activeProject, risks: updatedRisks });
  };

  // KPI Widget Configuration
  const handleUpdateWidgets = (widgets: KPIWidget[]) => {
    if (!activeProject) return;
    handleUpdateProject({ ...activeProject, kpiWidgets: widgets });
  };

  // AI Assistant Task Injection
  const handleAddTasksFromAI = (tasksToAdd: Partial<Task>[]) => {
    if (!activeProject) return;
    const newTasks: Task[] = tasksToAdd.map((t, idx) => ({
      id: `ai-task-${Date.now()}-${idx}`,
      projectId: activeProject.id,
      title: t.title || 'Nouvelle tâche',
      description: t.description || '',
      status: t.status || 'TODO',
      priority: t.priority || 'MEDIUM',
      estimatedHours: t.estimatedHours || 16,
      actualHours: 0,
      completionPercent: 0,
      startDate: t.startDate || new Date().toISOString().split('T')[0],
      dueDate: t.dueDate || new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().split('T')[0],
      category: t.category || 'Général',
      tags: t.tags || ['IA-WBS'],
    }));

    handleUpdateProject({ ...activeProject, tasks: [...activeProject.tasks, ...newTasks] });
  };

  const handleTabChange = (tab: string) => {
    const raw = tab.trim();
    const upper = raw.toUpperCase();
    let targetTab: MainTab = 'DASHBOARD';
    if (upper === 'WORKLOAD') {
      targetTab = 'TEAM';
    } else if (upper === 'MY_TASKS' || upper === 'CONTRIBUTOR') {
      targetTab = 'CONTRIBUTOR';
    } else if (upper === 'PROD_RELEASES' || upper === 'PRODUCTION_RELEASES') {
      targetTab = 'PROD_RELEASES';
    } else if (upper === 'ADMIN') {
      targetTab = 'ADMIN';
    } else if (['DASHBOARD', 'KANBAN', 'GANTT', 'TASKS', 'RISKS', 'TEAM', 'PORTFOLIO', 'ADMIN', 'CONTRIBUTOR', 'PROD_RELEASES'].includes(upper)) {
      targetTab = upper as MainTab;
    }

    if (currentUser) {
      const permitted = ROLE_PERMITTED_TABS[currentUser.role] || ['DASHBOARD'];
      if (!permitted.includes(targetTab)) {
        console.warn(`Access denied to tab ${targetTab} for role ${currentUser.role}`);
        return;
      }
    }
    setActiveTab(targetTab);
  };

  // Gate access: a valid server-side session is required
  if (!currentUser) {
    return (
      <LoginPage
        onLoginSuccess={(user) => {
          handleLoginSuccess(user);
        }}
        currentUser={currentUser}
      />
    );
  }

  if (!workspaceLoaded) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6"><div className="max-w-md text-center"><h2 className="text-lg font-bold text-slate-900">Chargement du portefeuille</h2><p className="text-sm text-slate-600 mt-2">{workspaceError || 'Connexion au serveur et chargement des données…'}</p>{workspaceError && <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold">Recharger</button>}</div></div>;
  }

  return (
    <div className="min-h-screen bg-slate-900/5 text-slate-900 font-sans antialiased flex flex-col selection:bg-indigo-500 selection:text-white">
      
      {/* Top Navigation Bar */}
      <Navbar
        projects={projects}
        activeProjectId={activeProjectId}
        activeTab={
          activeTab === 'TEAM' 
            ? 'workload' 
            : activeTab === 'CONTRIBUTOR' 
            ? 'my_tasks' 
            : activeTab === 'PROD_RELEASES'
            ? 'prod_releases'
            : activeTab.toLowerCase()
        }
        metrics={metrics || undefined}
        currentUser={currentUser}
        onSelectProject={(id) => setActiveProjectId(id)}
        onChangeTab={handleTabChange}
        onOpenNewProject={() => setProjectModalState({ isOpen: true, project: null })}
        onOpenAI={() => setIsAIAssistantOpen(true)}
        onOpenCustomizer={() => setIsWidgetCustomizerOpen(true)}
        onOpenSettings={() => setProjectModalState({ isOpen: true, project: activeProject })}
        onLogout={handleLogout}
        onExportData={handleExportData}
        onImportData={handleImportData}
        isPortfolioView={activeTab === 'PORTFOLIO'}
        onTogglePortfolioView={(isPortfolio) => setActiveTab(isPortfolio ? 'PORTFOLIO' : 'DASHBOARD')}
      />

      {workspaceError && <div className="mx-auto mt-3 w-full max-w-7xl px-4"><div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{workspaceError}</div></div>}

      {/* Main Container - Strict RBAC View Segregation */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        
        {/* Profile 1: ADMINISTRATEUR - Exclusively Admin & Security Console */}
        {currentUser.role === 'ADMINISTRATEUR' && activeTab !== 'PROD_RELEASES' ? (
          <AdminPage
            currentUser={currentUser}
                onClose={() => {}}
          />
        ) : currentUser.role === 'CONTRIBUTEUR' ? (
          /* Profile: CONTRIBUTEUR - Exclusively Personal Tasks & Timesheet */
          <ContributorPortal
            projects={projects}
            currentUser={currentUser}
            onUpdateTask={handleSaveTask}
          />
        ) : (
          /* Unified project and production workspace for project managers and production leads */
          <>
            {activeTab === 'PROD_RELEASES' && (
              <ProductionReleasePortal key={workspaceImportVersion} currentUser={currentUser} projects={projects} scopes={scopes} activeProjectId={activeProject?.id} onUpdateProject={handleUpdateProject} />
            )}

            {activeTab === 'PORTFOLIO' && (
              <PortfolioOverview
                projects={projects}
                scopes={scopes}
                canManageScopes={currentUser.role === 'DIRECTEUR_PROJETS' || currentUser.role === 'ADMINISTRATEUR'}
                canManageProjectCatalog={currentUser.role === 'DIRECTEUR_PROJETS' || currentUser.role === 'ADMINISTRATEUR' || currentUser.role === 'CHEF_PROJET'}
                onImportCatalog={handleImportCatalog}
                projectManagers={projectManagers}
                canManageManagers={currentUser.role === 'DIRECTEUR_PROJETS' || currentUser.role === 'ADMINISTRATEUR'}
                onCreateProjectManager={handleCreateProjectManager}
                onToggleProjectManager={handleToggleProjectManager}
                onEditProject={(project) => setProjectModalState({ isOpen: true, project })}
                onSaveScopes={handleSaveScopes}
                onUpdateProject={handleUpdateProject}
                onSelectProject={(id) => {
                  setActiveProjectId(id);
                  setActiveTab('DASHBOARD');
                }}
                onOpenNewProject={() => setProjectModalState({ isOpen: true, project: null })}
              />
            )}

            {activeTab === 'DASHBOARD' && activeProject && (
              <ProductionReleasePortal
                currentUser={currentUser}
                projects={projects}
                scopes={scopes}
                activeProjectId={activeProject.id}
                onUpdateProject={handleUpdateProject}
                dashboardOnly
              />
            )}

            {activeTab === 'DASHBOARD' && activeProject && (
              <KPIDashboard
                project={activeProject}
                metrics={metrics || undefined}
                onOpenCustomizeWidgets={() => setIsWidgetCustomizerOpen(true)}
                onOpenAIAssistant={() => setIsAIAssistantOpen(true)}
                onOpenTaskModal={(taskId) => setTaskModalState({ isOpen: true, taskId })}
                onOpenMilestoneModal={(milestoneId) => setMilestoneModalState({ isOpen: true, milestoneId })}
                onOpenRiskModal={(riskId) => setRiskModalState({ isOpen: true, riskId })}
                onOpenProjectSettings={() => setProjectModalState({ isOpen: true, project: activeProject })}
                onChangeTab={handleTabChange}
                onToggleMilestone={handleToggleMilestone}
              />
            )}

            {activeTab === 'KANBAN' && activeProject && (
              <KanbanBoard
                project={activeProject}
                onOpenTaskModal={(taskId) => setTaskModalState({ isOpen: true, taskId })}
                onUpdateTaskStatus={handleUpdateTaskStatus}
                onDeleteTask={handleDeleteTask}
                onQuickAddTask={handleQuickAddTask}
              />
            )}

            {activeTab === 'GANTT' && activeProject && (
              <GanttTimeline
                project={activeProject}
                onOpenTaskModal={(taskId) => setTaskModalState({ isOpen: true, taskId })}
                onOpenMilestoneModal={(milestoneId) => setMilestoneModalState({ isOpen: true, milestoneId })}
              />
            )}

            {activeTab === 'TASKS' && activeProject && (
              <TaskListView
                project={activeProject}
                onOpenTaskModal={(taskId) => setTaskModalState({ isOpen: true, taskId })}
                onDeleteTask={handleDeleteTask}
                onUpdateTask={handleSaveTask}
              />
            )}

            {activeTab === 'RISKS' && activeProject && (
              <RiskMatrix
                project={activeProject}
                onOpenRiskModal={(riskId) => setRiskModalState({ isOpen: true, riskId })}
                onDeleteRisk={handleDeleteRisk}
                onUpdateRiskStatus={handleUpdateRiskStatus}
              />
            )}

            {activeTab === 'TEAM' && activeProject && (
              <TeamWorkload
                project={activeProject}
                currentUser={currentUser}
                onUpdateProject={handleUpdateProject}
                onOpenTaskModal={(taskId) => setTaskModalState({ isOpen: true, taskId })}
              />
            )}

            {activeTab === 'CONTRIBUTOR' && (
              <ContributorPortal
                projects={projects}
                currentUser={currentUser}
                onUpdateTask={handleSaveTask}
              />
            )}
          </>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 px-6 text-center text-xs text-slate-500">
        Clarity PM
      </footer>

      {/* MODALS */}
      {/* 1. AI Assistant Modal */}
      {isAIAssistantOpen && activeProject && metrics && (
        <AIAssistantModal
          project={activeProject}
          metrics={metrics}
          onClose={() => setIsAIAssistantOpen(false)}
          onAddTasksToProject={handleAddTasksFromAI}
        />
      )}

      {/* 2. Widget Customizer Modal */}
      {isWidgetCustomizerOpen && activeProject && (
        <WidgetCustomizerModal
          project={activeProject}
          onClose={() => setIsWidgetCustomizerOpen(false)}
          onUpdateWidgets={handleUpdateWidgets}
        />
      )}

      {/* 3. Add/Edit Task Modal */}
      {taskModalState.isOpen && activeProject && (
        <AddEditTaskModal
          project={activeProject}
          taskId={taskModalState.taskId}
          onClose={() => setTaskModalState({ isOpen: false, taskId: null })}
          onSaveTask={handleSaveTask}
          onDeleteTask={handleDeleteTask}
        />
      )}

      {/* 4. Add/Edit Milestone Modal */}
      {milestoneModalState.isOpen && activeProject && (
        <AddEditMilestoneModal
          project={activeProject}
          milestoneId={milestoneModalState.milestoneId}
          onClose={() => setMilestoneModalState({ isOpen: false, milestoneId: null })}
          onSaveMilestone={handleSaveMilestone}
          onDeleteMilestone={handleDeleteMilestone}
        />
      )}

      {/* 5. Add/Edit Risk Modal */}
      {riskModalState.isOpen && activeProject && (
        <AddEditRiskModal
          project={activeProject}
          riskId={riskModalState.riskId}
          onClose={() => setRiskModalState({ isOpen: false, riskId: null })}
          onSaveRisk={handleSaveRisk}
          onDeleteRisk={handleDeleteRisk}
        />
      )}

      {/* 6. Add/Edit Project Modal */}
      {projectModalState.isOpen && (
        <AddEditProjectModal
          project={projectModalState.project}
          scopes={scopes}
          canManageScopes={currentUser.role === 'DIRECTEUR_PROJETS' || currentUser.role === 'ADMINISTRATEUR' || currentUser.role === 'CHEF_PROJET'}
          onClose={() => setProjectModalState({ isOpen: false, project: null })}
          onSaveProject={handleSaveProject}
          onDeleteProject={currentUser.role === 'DIRECTEUR_PROJETS' || currentUser.role === 'ADMINISTRATEUR' || currentUser.role === 'CHEF_PROJET' ? handleDeleteProject : undefined}
        />
      )}



    </div>
  );
};

export default App;
