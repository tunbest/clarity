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
  UserRole
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

const PROJECT_MANAGER_TABS: MainTab[] = ['DASHBOARD', 'KANBAN', 'GANTT', 'TASKS', 'RISKS', 'TEAM', 'PROD_RELEASES'];

const ROLE_PERMITTED_TABS: Record<UserRole, MainTab[]> = {
  ADMINISTRATEUR: ['ADMIN'],
  DIRECTEUR_PROJETS: ['PORTFOLIO', 'DASHBOARD', 'RISKS', 'TEAM'],
  PMO: ['PORTFOLIO', 'DASHBOARD', 'GANTT', 'TASKS', 'RISKS'],
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
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const workspaceRevisionRef = useRef(0);
  const workspaceWriteQueue = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    if (!currentUser) { setWorkspaceLoaded(false); return; }
    let active = true;
    fetch('/api/workspace', { credentials: 'same-origin' }).then(async (r) => { const data = await r.json(); if (!r.ok) throw new Error(data.error || 'Chargement du portefeuille impossible'); return data; }).then((snapshot) => { if (!active) return; setProjects(snapshot.projects || []); workspaceRevisionRef.current = snapshot.revision || 1; setWorkspaceLoaded(true); setWorkspaceError(null); }).catch((err) => { console.error(err); if (active) { setWorkspaceError(err.message || 'Impossible de charger le portefeuille serveur.'); setWorkspaceLoaded(false); } });
    return () => { active = false; };
  }, [currentUser?.id]);

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

  const handleDeleteProject = (projId: string) => {
    const remaining = projects.filter((p) => p.id !== projId);
    if (remaining.length === 0) {
      setProjects(INITIAL_PROJECTS);
      setActiveProjectId(INITIAL_PROJECTS[0].id);
    } else {
      setProjects(remaining);
      setActiveProjectId(remaining[0].id);
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
    handleUpdateProject({ ...activeProject, milestones: updatedMilestones });
  };

  // Data Export & Import Handlers
  const handleExportData = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(projects, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `cockpit_pm_export_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported) && imported.length > 0) {
          setProjects(imported);
          setActiveProjectId(imported[0].id);
        }
      } catch (err) {
        console.error("Erreur lors de l'import JSON", err);
      }
    };
    reader.readAsText(file);
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
        {currentUser.role === 'ADMINISTRATEUR' ? (
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
            {activeTab === 'PROD_RELEASES' && activeProject && (
              <ProductionReleasePortal currentUser={currentUser} projects={projects} activeProjectId={activeProject.id} onUpdateProject={handleUpdateProject} />
            )}

            {activeTab === 'PORTFOLIO' && (
              <PortfolioOverview
                projects={projects}
                onSelectProject={(id) => {
                  setActiveProjectId(id);
                  setActiveTab('DASHBOARD');
                }}
                onOpenNewProject={() => setProjectModalState({ isOpen: true, project: null })}
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
          onClose={() => setProjectModalState({ isOpen: false, project: null })}
          onSaveProject={handleSaveProject}
          onDeleteProject={handleDeleteProject}
        />
      )}



    </div>
  );
};

export default App;
