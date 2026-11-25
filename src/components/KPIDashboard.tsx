import React, { useEffect, useMemo, useState } from 'react';
import { 
  Project, 
  ProjectMetrics, 
  KPIWidget 
} from '../types';
import { formatDateFR } from '../utils/pmCalculations';
import { 
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from 'recharts';
import { 
  Activity, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ShieldAlert, 
  Calendar, 
  Target, 
  ArrowUpRight, 
  ArrowDownRight, 
  Sparkles, 
  Plus, 
  Layers, 
  Sliders,
  ChevronRight,
  Rocket
} from 'lucide-react';

interface DashboardMep {
  id: string;
  date?: string;
  status?: string;
  priority?: string;
  goNoGo?: string;
  tasks?: Array<{ offset?: number; duration?: number; status?: string }>;
}

interface KPIDashboardProps {
  project: Project;
  metrics?: ProjectMetrics;
  onOpenTaskModal?: (taskId?: string) => void;
  onOpenMilestoneModal?: (milestoneId?: string) => void;
  onOpenRiskModal?: (riskId?: string) => void;
  onOpenAI?: () => void;
  onOpenAIAssistant?: () => void;
  onOpenCustomizer?: () => void;
  onOpenCustomizeWidgets?: () => void;
  onOpenProjectSettings?: () => void;
  onChangeTab?: (tab: string) => void;
  onToggleMilestone?: (milestoneId: string) => void;
}

export const KPIDashboard: React.FC<KPIDashboardProps> = ({
  project,
  metrics: incomingMetrics,
  onOpenTaskModal = (_taskId?: string) => {},
  onOpenMilestoneModal = (_milestoneId?: string) => {},
  onOpenRiskModal = (_riskId?: string) => {},
  onOpenAI,
  onOpenAIAssistant,
  onOpenCustomizer,
  onOpenCustomizeWidgets,
  onOpenProjectSettings = () => {},
  onChangeTab = (_tab: string) => {},
  onToggleMilestone = (_milestoneId: string) => {},
}) => {
  const handleOpenAI = onOpenAI || onOpenAIAssistant || (() => {});
  const handleOpenCustomizer = onOpenCustomizer || onOpenCustomizeWidgets || (() => {});
  
  const metrics = incomingMetrics || {
    SPI: 1,
    SV: 0,
    progressPercent: 0,
    totalTasks: project?.tasks?.length || 0,
    completedTasks: project?.tasks?.filter(t => t.status === 'DONE')?.length || 0,
    inProgressTasks: 0,
    blockedTasks: 0,
    overdueTasks: 0,
    totalEstimatedHours: 0,
    totalActualHours: 0,
    healthScore: 100,
    healthStatus: 'HEALTHY' as const,
    criticalRisksCount: project?.risks?.filter(r => r.status === 'ACTIVE' && (r.probability * r.impact >= 15))?.length || 0,
    totalRisksCount: project?.risks?.length || 0,
    completedMilestones: project?.milestones?.filter(m => m.completed)?.length || 0,
    totalMilestones: project?.milestones?.length || 0,
  };


  const [mepEntries, setMepEntries] = useState<DashboardMep[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/meps', { credentials: 'include' })
      .then((response) => {
        if (!response.ok) throw new Error('Chargement des indicateurs MEP impossible');
        return response.json();
      })
      .then((payload) => {
        if (!cancelled) setMepEntries(Array.isArray(payload?.meps) ? payload.meps : []);
      })
      .catch((error) => console.error('Dashboard MEP:', error));
    return () => { cancelled = true; };
  }, []);

  const mepStats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateOnly = (value?: string) => String(value || '').slice(0, 10);
    const active = mepEntries.filter((m) => !['Réussie', 'Échec', 'Annulée'].includes(String(m.status || '')));
    const upcoming = active.filter((m) => dateOnly(m.date) >= today.toISOString().slice(0, 10));
    const lateTasks = mepEntries.flatMap((m) => (m.tasks || []).map((task) => {
      const start = new Date(dateOnly(m.date) + 'T00:00:00');
      start.setDate(start.getDate() + (Number(task.offset) || 0) + Math.max(0, (Number(task.duration) || 1) - 1));
      return { task, end: start };
    })).filter(({ task, end }) => task.status !== 'Terminé' && !Number.isNaN(end.getTime()) && end < today);
    const atRisk = active.filter((m) => ['Critique', 'Haute'].includes(String(m.priority || ''))
      || String(m.goNoGo || '') === 'NO-GO'
      || (dateOnly(m.date) !== '' && dateOnly(m.date) < today.toISOString().slice(0, 10)));
    return { open: active.length, upcoming: upcoming.length, lateTasks: lateTasks.length, atRisk: atRisk.length };
  }, [mepEntries]);

  // Status donut data
  const tasks = project?.tasks || [];
  const statusCounts = {
    TODO: tasks.filter((t) => t.status === 'TODO').length,
    IN_PROGRESS: tasks.filter((t) => t.status === 'IN_PROGRESS').length,
    REVIEW: tasks.filter((t) => t.status === 'REVIEW' || t.status === 'BLOCKED').length,
    DONE: tasks.filter((t) => t.status === 'DONE').length,
  };

  const pieData = [
    { name: 'À faire', value: statusCounts.TODO, color: '#94A3B8' },
    { name: 'En cours', value: statusCounts.IN_PROGRESS, color: '#3B82F6' },
    { name: 'Revue / Bloqué', value: statusCounts.REVIEW, color: '#F59E0B' },
    { name: 'Terminé', value: statusCounts.DONE, color: '#10B981' },
  ].filter((d) => d.value > 0);

  // Team workload data
  const workloadData = project.members.map((member) => {
    const assignedTasks = project.tasks.filter((t) => t.assigneeId === member.id);
    const estimatedHours = assignedTasks.reduce((sum, t) => sum + (Number(t.estimatedHours) || 0), 0);
    const actualHours = assignedTasks.reduce((sum, t) => sum + (Number(t.actualHours) || 0), 0);
    return {
      name: member.name.split(' ')[0],
      estimé: estimatedHours,
      réel: actualHours,
      max: member.maxWeeklyHours * 4, // Monthly capacity
    };
  });

  // Calculate Health color scheme
  const getHealthBadge = (score: number) => {
    if (score >= 80) {
      return {
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dot: 'bg-emerald-500',
        text: '🟢 Excellent / En bonne voie',
      };
    } else if (score >= 60) {
      return {
        bg: 'bg-amber-50 text-amber-700 border-amber-200',
        dot: 'bg-amber-500',
        text: '🟡 Vigilance / Dérive mineure',
      };
    } else {
      return {
        bg: 'bg-rose-50 text-rose-700 border-rose-200',
        dot: 'bg-rose-500',
        text: '🔴 Alerte Critique / Actions requises',
      };
    }
  };

  const healthBadge = getHealthBadge(metrics.healthScore);

  // Helper for EVM index indicators
  const getIndexColor = (val: number, threshold = 1.0) => {
    if (val >= threshold) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (val >= threshold - 0.1) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-rose-600 bg-rose-50 border-rose-200';
  };

  // Sort visible widgets
  const visibleWidgets = (project.kpiWidgets || [])
    .filter((w) => w.isVisible)
    .sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-6">
      
      {/* Project Banner & Quick Control Header */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-slate-100 text-slate-700 border border-slate-300 uppercase tracking-wider">
                {project.code}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Client : <strong className="text-slate-700">{project.client || 'Interne'}</strong>
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-xs text-slate-500">
                Chef de Projet : <strong className="text-slate-700">{project.managerName}</strong>
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {project.name}
            </h1>
            <p className="text-sm text-slate-600 mt-1 line-clamp-1">
              {project.description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => onOpenTaskModal()}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Ajouter une Tâche</span>
            </button>

            <button
              onClick={() => onOpenMilestoneModal()}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Target className="w-4 h-4 text-indigo-600" />
              <span>Nouveau Jalon</span>
            </button>

            <button
              onClick={() => onOpenRiskModal()}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <ShieldAlert className="w-4 h-4 text-rose-500" />
              <span>Identifier Risque</span>
            </button>

            <button
              onClick={handleOpenAI}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:opacity-95 shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 animate-spin" style={{ animationDuration: '6s' }} />
              <span>Audit 360° IA</span>
            </button>
          </div>
        </div>

        {/* Project Health Score Ribbon */}
        <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          
          {/* Health Score */}
          <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/60">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Santé Globale</span>
              <Activity className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-2xl font-black text-slate-900">{metrics.healthScore}</span>
              <span className="text-xs font-semibold text-slate-400">/100</span>
            </div>
            <div className={`mt-1.5 px-2 py-0.5 rounded text-[10px] font-bold border inline-block ${healthBadge.bg}`}>
              {metrics.healthStatus === 'HEALTHY' ? 'En bonne voie' : metrics.healthStatus === 'WARNING' ? 'Sous surveillance' : 'Alerte critique'}
            </div>
          </div>

          {/* Avancement */}
          <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/60">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Avancement</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="flex items-baseline gap-1 mt-1.5">
              <span className="text-2xl font-black text-slate-900">{metrics.progressPercent}%</span>
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
              <div 
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${metrics.progressPercent}%` }}
              />
            </div>
          </div>

          {/* SPI (Schedule Performance Index) */}
          <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/60">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">SPI (Délais)</span>
              {metrics.SPI >= 1.0 ? (
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5 text-rose-600" />
              )}
            </div>
            <div className="flex items-baseline gap-1 mt-1.5">
              <span className="text-2xl font-black text-slate-900">{metrics.SPI}</span>
            </div>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border inline-block mt-1 ${getIndexColor(metrics.SPI, 1.0)}`}>
              {metrics.SPI >= 1.0 ? 'En avance / À l’heure' : metrics.SPI >= 0.9 ? 'Léger retard' : 'Retard critique'}
            </span>
          </div>

          {/* Risques & Alertes */}
          <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/60 cursor-pointer hover:bg-slate-100/80 transition-colors" onClick={() => onChangeTab('risks')}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Risques Majeurs</span>
              <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
            </div>
            <div className="flex items-baseline gap-1 mt-1.5">
              <span className={`text-2xl font-black ${metrics.criticalRisksCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                {metrics.criticalRisksCount}
              </span>
              <span className="text-xs text-slate-400">/ {metrics.totalRisksCount}</span>
            </div>
            <span className="text-[10px] text-indigo-600 font-semibold flex items-center gap-0.5 mt-1">
              Voir matrice <ChevronRight className="w-3 h-3" />
            </span>
          </div>

          <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/60">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Écart d'avancement vs planning</span>
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            <div className={`text-2xl font-black mt-1.5 ${metrics.SV >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {metrics.SV > 0 ? '+' : ''}{metrics.SV} pts
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              Début : {formatDateFR(project.startDate)} · Fin prévue : {formatDateFR(project.endDate)}
            </div>
          </div>

        </div>
      </div>

      {/* Production indicators — displayed immediately after the project KPI ribbon */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { label: 'MEP ouvertes', value: mepStats.open, detail: 'Déploiements à piloter', tone: 'indigo' },
          { label: 'MEP à venir', value: mepStats.upcoming, detail: 'Fenêtres planifiées', tone: 'sky' },
          { label: 'Tâches en retard', value: mepStats.lateTasks, detail: 'Jalons ou tâches à traiter', tone: 'amber' },
          { label: 'MEP à risque', value: mepStats.atRisk, detail: 'Critiques, hautes ou en retard', tone: 'rose' },
        ].map((item) => (
          <div key={item.label} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
            <div className="text-xs font-bold text-slate-600">{item.label}</div>
            <div className="mt-2 text-3xl font-black text-slate-900 tabular-nums">{item.value}</div>
            <div className="mt-1 text-[11px] text-slate-500">{item.detail}</div>
          </div>
        ))}
      </section>

      {/* MEP and task distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <div><h2 className="text-base font-bold text-slate-900">Répartition des MEP</h2><p className="text-xs text-slate-500 mt-1">Vue des mises en production par statut</p></div>
            <Rocket className="w-5 h-5 text-indigo-600" />
          </div>
          {(() => {
            const palette = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#94A3B8'];
            const counts = mepEntries.reduce<Record<string, number>>((acc, mep) => { const status = String(mep.status || 'Non renseigné'); acc[status] = (acc[status] || 0) + 1; return acc; }, {});
            const data = Object.entries(counts).map(([name, value], index) => ({ name, value, color: palette[index % palette.length] }));
            return data.length ? <><div className="h-44 w-full"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={3} dataKey="value">{data.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div><div className="space-y-2 mt-2 pt-3 border-t border-slate-100">{data.map((item) => <div key={item.name} className="flex items-center justify-between text-xs"><span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</span><strong>{item.value}</strong></div>)}</div></> : <div className="h-52 flex items-center justify-center text-sm text-slate-400">Aucune MEP enregistrée</div>;
          })()}
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div><div className="flex items-center justify-between mb-2"><h2 className="text-base font-bold text-slate-900">Répartition des Tâches</h2><span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{metrics.totalTasks} tâches</span></div>
          <p className="text-xs text-slate-500 mb-4">{metrics.completedTasks} terminées • {metrics.inProgressTasks} actives • {metrics.overdueTasks} en retard</p>
          <div className="h-44 w-full relative"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">{pieData.map((entry, index) => <Cell key={"cell-" + index} fill={entry.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer><div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"><span className="text-xl font-black text-slate-800">{metrics.progressPercent}%</span><span className="text-[10px] text-slate-400 font-medium uppercase">Complété</span></div></div></div>
          <div className="space-y-2 mt-2 pt-3 border-t border-slate-100">{pieData.map((item) => <div key={item.name} className="flex items-center justify-between text-xs"><span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</span><strong>{item.value} ({Math.round((item.value / (metrics.totalTasks || 1)) * 100)}%)</strong></div>)}</div>
        </div>
      </div>

      {/* Second Row: Milestones Roadmap & Team Workload */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Milestones Roadmaps (7-col) */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Target className="w-4 h-4 text-indigo-600" />
                <span>Jalons & Livrables Stratégiques</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {metrics.completedMilestones} sur {metrics.totalMilestones} jalons validés
              </p>
            </div>
            <button
              onClick={() => onOpenMilestoneModal()}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Nouveau jalon
            </button>
          </div>

          <div className="space-y-3">
            {project.milestones.map((ms) => {
              const isOverdue = !ms.completed && ms.targetDate < new Date().toISOString().split('T')[0];
              return (
                <div 
                  key={ms.id} 
                  className={`p-3 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                    ms.completed 
                      ? 'bg-emerald-50/40 border-emerald-200/70' 
                      : isOverdue 
                      ? 'bg-rose-50/50 border-rose-200' 
                      : 'bg-slate-50/60 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => onToggleMilestone(ms.id)}
                      className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                        ms.completed 
                          ? 'bg-emerald-600 text-white' 
                          : 'border-2 border-slate-400 hover:border-emerald-600 text-transparent'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                    <div>
                      <h4 className={`text-xs font-bold ${ms.completed ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                        {ms.title}
                      </h4>
                      {ms.deliverable && (
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          📦 Livrable : <span className="font-medium text-slate-700">{ms.deliverable}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md inline-flex items-center gap-1 ${
                      ms.completed 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : isOverdue 
                        ? 'bg-rose-100 text-rose-800' 
                        : 'bg-slate-200 text-slate-700'
                    }`}>
                      <Calendar className="w-3 h-3" />
                      {formatDateFR(ms.targetDate)}
                    </span>
                    {isOverdue && !ms.completed && (
                      <span className="text-[10px] font-bold text-rose-600 block mt-0.5">
                        En retard
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Workload & Resource Allocation (5-col) */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Charge de l'Équipe</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Heures estimées vs réalisées par membre
              </p>
            </div>
            <button
              onClick={() => onChangeTab('workload')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
            >
              Détails <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workloadData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} />
                <Tooltip 
                  formatter={(val: any) => `${val} heures`}
                  contentStyle={{ backgroundColor: '#1E293B', borderRadius: '8px', border: 'none', color: '#F8FAFC', fontSize: '11px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="estimé" fill="#6366F1" radius={[4, 4, 0, 0]} name="Heures Estimées" />
                <Bar dataKey="réel" fill="#10B981" radius={[4, 4, 0, 0]} name="Heures Réalisées" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>Total heures estimées : <strong>{metrics.totalEstimatedHours}h</strong></span>
            <span>Total heures réelles : <strong>{metrics.totalActualHours}h</strong></span>
          </div>
        </div>

      </div>

    </div>
  );
};
