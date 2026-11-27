import React, { useState } from 'react';
import { Project, ProjectMetrics, Task } from '../types';
import { CloudflareAIChat } from './CloudflareAIChat';
import { 
  Sparkles, 
  X, 
  Activity, 
  FileText, 
  ListPlus, 
  CheckCircle2, 
  AlertTriangle, 
  Copy, 
  Check, 
  Download, 
  Loader2,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

interface AIAssistantModalProps {
  project: Project;
  metrics: ProjectMetrics;
  onClose: () => void;
  onAddTasksToProject: (tasks: Partial<Task>[]) => void;
}

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({
  project,
  metrics,
  onClose,
  onAddTasksToProject,
}) => {
  const [activeTab, setActiveTab] = useState<'AUDIT' | 'REPORT' | 'WBS'>('AUDIT');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Audit state
  const [auditResult, setAuditResult] = useState<any>(null);

  // Report state
  const [reportMarkdown, setReportMarkdown] = useState<string>('');
  const [reportAudience, setReportAudience] = useState<string>('Comité de Pilotage (COPIL)');

  // WBS Breakdown state
  const [wbsPrompt, setWbsPrompt] = useState<string>('');
  const [generatedTasks, setGeneratedTasks] = useState<any[]>([]);
  const [selectedTasksToAdd, setSelectedTasksToAdd] = useState<number[]>([]);
  const [tasksAddedSuccess, setTasksAddedSuccess] = useState(false);

  // Trigger Audit
  const handleRunAudit = async () => {
    setLoading(true);
    setAuditResult(null);
    try {
      const payload = {
        name: project.name,
        code: project.code,
        status: project.status,
        progress: metrics.progressPercent,
        spi: metrics.SPI,
        totalTasksCount: metrics.totalTasks,
        completedTasksCount: metrics.completedTasks,
        overdueTasksCount: metrics.overdueTasks,
        activeRisksCount: metrics.criticalRisksCount,
        blockedTasksCount: metrics.blockedTasks,
        risks: project.risks.map((r) => ({ title: r.title, p: r.probability, i: r.impact, plan: r.mitigationPlan })),
        milestones: project.milestones.map((m) => ({ title: m.title, targetDate: m.targetDate, completed: m.completed })),
      };

      const res = await fetch('/api/pm-ai/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectData: payload }),
      });

      const data = await res.json();
      if (!res.ok || data.error || !data.summary) {
        throw new Error(data.error || 'Erreur API');
      }
      setAuditResult(data);
    } catch (err) {
      console.warn('Utilisation du moteur d’audit de secours:', err);
      // Fallback
      setAuditResult({
        summary: `Audit opérationnel : le projet "${project.name}" présente ${metrics.progressPercent}% d'avancement. Le SPI (${metrics.SPI}) et les risques actifs déterminent les priorités de suivi du chemin critique.`,
        strengths: [
          metrics.SPI >= 1 ? `Calendrier maîtrisé avec un SPI de ${metrics.SPI}` : "Mobilisation soutenue de l'équipe",
          `${metrics.completedMilestones}/${metrics.totalMilestones} jalons terminés`,
          `${metrics.completedTasks}/${metrics.totalTasks} tâches déjà livrées avec succès`
        ],
        alerts: [
          metrics.criticalRisksCount > 0 ? `${metrics.criticalRisksCount} risque(s) critique(s) nécessitant une atténuation immédiate` : "Maintenir la vigilance sur les dépendances techniques",
          metrics.overdueTasks > 0 ? `${metrics.overdueTasks} tâche(s) en retard sur le planning cible` : "Surveiller la charge de travail de l'équipe pour éviter le surmenage"
        ],
        recommendations: [
          "Organiser un point de synchronisation hebdomadaire avec les porteurs de lots",
          "Prioriser les tâches sur le chemin critique identifié dans le diagramme de Gantt",
          "Revalider l'alignement des livrables du prochain jalon avec le commanditaire"
        ],
        healthScoreEstimate: metrics.healthScore,
      });
    } finally {
      setLoading(false);
    }
  };

  // Trigger Report
  const handleGenerateReport = async () => {
    setLoading(true);
    setReportMarkdown('');
    try {
      const payload = {
        name: project.name,
        description: project.description,
        status: project.status,
        progress: metrics.progressPercent,
        spi: metrics.SPI,
        totalTasksCount: metrics.totalTasks,
        completedTasksCount: metrics.completedTasks,
        activeRisksCount: metrics.criticalRisksCount,
        overdueTasksCount: metrics.overdueTasks,
      };

      const res = await fetch('/api/pm-ai/copil-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectData: payload, audience: reportAudience }),
      });

      const data = await res.json();
      setReportMarkdown(data.reportMarkdown || '');
    } catch (err) {
      console.error(err);
      setReportMarkdown(`## Flash Report - ${project.name}\nAvancement : ${metrics.progressPercent}% | Santé : ${metrics.healthScore}/100\nSPI planning : ${metrics.SPI}\nTâches en retard : ${metrics.overdueTasks}\nRisques critiques : ${metrics.criticalRisksCount}`);
    } finally {
      setLoading(false);
    }
  };

  // Trigger WBS Decomposition
  const handleGenerateWBS = async () => {
    if (!wbsPrompt.trim()) return;
    setLoading(true);
    setGeneratedTasks([]);
    setTasksAddedSuccess(false);

    try {
      const res = await fetch('/api/pm-ai/wbs-breakdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objective: wbsPrompt.trim(),
          projectContext: project.name,
        }),
      });

      const data = await res.json();
      const tasks = data.tasks || [];
      setGeneratedTasks(tasks);
      setSelectedTasksToAdd(tasks.map((_: any, idx: number) => idx));
    } catch (err) {
      console.error(err);
      setGeneratedTasks([
        { title: `Cadrage et spécifications détaillées`, category: 'Cadrage', estimatedHours: 20, priority: 'HIGH' },
        { title: `Développement et implémentation`, category: 'Développement', estimatedHours: 35, priority: 'HIGH' },
        { title: `Tests et recette utilisateur`, category: 'Recette', estimatedHours: 15, priority: 'MEDIUM' },
      ]);
      setSelectedTasksToAdd([0, 1, 2]);
    } finally {
      setLoading(false);
    }
  };

  // Inject selected tasks into the project
  const handleApplyTasks = () => {
    const tasksToInject: Partial<Task>[] = selectedTasksToAdd.map((idx) => {
      const t = generatedTasks[idx];
      return {
        title: t.title,
        category: t.category || 'Général',
        estimatedHours: Number(t.estimatedHours) || 16,
        actualHours: 0,
        completionPercent: 0,
        status: 'TODO',
        priority: t.priority || 'MEDIUM',
        tags: ['IA-WBS', t.category || 'Tâche'],
        startDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().split('T')[0],
      };
    });

    onAddTasksToProject(tasksToInject);
    setTasksAddedSuccess(true);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  const handleCopyReport = () => {
    navigator.clipboard.writeText(reportMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">
                Chef de Projet AI Copilot
              </h2>
              <p className="text-xs text-slate-300">
                Audits prédictifs, rapports COPIL et décomposition WBS intelligente
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-5 gap-2 pt-2">
          <button
            onClick={() => setActiveTab('AUDIT')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 ${
              activeTab === 'AUDIT'
                ? 'bg-white text-indigo-600 border-t border-x border-slate-200 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Audit 360° & Diagnostic</span>
          </button>

          <button
            onClick={() => setActiveTab('REPORT')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 ${
              activeTab === 'REPORT'
                ? 'bg-white text-indigo-600 border-t border-x border-slate-200 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Générateur Flash Report COPIL</span>
          </button>

          <button
            onClick={() => setActiveTab('WBS')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 ${
              activeTab === 'WBS'
                ? 'bg-white text-indigo-600 border-t border-x border-slate-200 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ListPlus className="w-3.5 h-3.5" />
            <span>Découpeur WBS Automatique</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">\n          <CloudflareAIChat projectName={project.name} projectCode={project.code} />
          
          {/* TAB 1: AUDIT 360 */}
          {activeTab === 'AUDIT' && (
            <div className="space-y-4">
              <div className="bg-indigo-50/70 p-4 rounded-2xl border border-indigo-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-indigo-900 uppercase tracking-wider">
                    Diagnostic Approfondi du Projet
                  </h3>
                  <p className="text-xs text-indigo-700 mt-0.5">
                    Analyse en temps réel du planning, des risques techniques, de la charge et de l'alignement des jalons.
                  </p>
                </div>
                <button
                  onClick={handleRunAudit}
                  disabled={loading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  <span>{auditResult ? 'Ré-auditer' : 'Lancer l’Audit'}</span>
                </button>
              </div>

              {loading && (
                <div className="py-12 text-center text-slate-500 space-y-2">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600" />
                  <p className="text-xs font-semibold">Analyse des indicateurs EVM et matrice des risques en cours...</p>
                </div>
              )}

              {auditResult && !loading && (
                <div className="space-y-4">
                  {/* Synthesis Box */}
                  <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">
                        Synthèse Exécutive
                      </span>
                      <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-300 border border-indigo-500/40">
                        Score santé estimé : {auditResult.healthScoreEstimate || metrics.healthScore}/100
                      </span>
                    </div>
                    <p className="text-sm font-medium leading-relaxed text-slate-100">
                      {auditResult.summary}
                    </p>
                  </div>

                  {/* Strengths & Alerts Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Strengths */}
                    <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200">
                      <h4 className="text-xs font-bold text-emerald-900 uppercase flex items-center gap-1.5 mb-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Points Forts & Solidité
                      </h4>
                      <ul className="space-y-1.5 text-xs text-emerald-800">
                        {(auditResult.strengths || []).map((s: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="text-emerald-500 font-bold">•</span>
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Alerts */}
                    <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200">
                      <h4 className="text-xs font-bold text-rose-900 uppercase flex items-center gap-1.5 mb-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600" />
                        Points de Vigilance & Alertes
                      </h4>
                      <ul className="space-y-1.5 text-xs text-rose-800">
                        {(auditResult.alerts || []).map((a: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="text-rose-500 font-bold">•</span>
                            <span>{a}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Recommendations */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                    <h4 className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5 mb-2">
                      <ShieldCheck className="w-4 h-4 text-indigo-600" />
                      Plan d'Action Recommandé par le Copilot
                    </h4>
                    <div className="space-y-2">
                      {(auditResult.recommendations || []).map((r: string, idx: number) => (
                        <div key={idx} className="p-2.5 bg-white rounded-xl border border-slate-200 text-xs font-medium text-slate-800 flex items-start gap-2">
                          <span className="px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700 font-bold text-[10px]">
                            Action {idx + 1}
                          </span>
                          <span>{r}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: COPIL REPORT */}
          {activeTab === 'REPORT' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">Destinataire :</span>
                  <input
                    type="text"
                    value={reportAudience}
                    onChange={(e) => setReportAudience(e.target.value)}
                    className="text-xs p-1.5 bg-white border border-slate-300 rounded-lg w-56 font-semibold"
                  />
                </div>

                <button
                  onClick={handleGenerateReport}
                  disabled={loading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  <span>Générer le Flash Report</span>
                </button>
              </div>

              {loading && (
                <div className="py-12 text-center text-slate-500 space-y-2">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600" />
                  <p className="text-xs font-semibold">Rédaction du compte-rendu exécutif en cours...</p>
                </div>
              )}

              {reportMarkdown && !loading && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Compte-Rendu Formaté (Markdown / Prêt à copier)
                    </span>
                    <button
                      onClick={handleCopyReport}
                      className="px-3 py-1 text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copié !' : 'Copier le Rapport'}</span>
                    </button>
                  </div>

                  <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl text-xs leading-relaxed text-slate-800 font-mono whitespace-pre-wrap max-h-80 overflow-y-auto">
                    {reportMarkdown}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: WBS BREAKDOWN */}
          {activeTab === 'WBS' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Décrivez un livrable, module ou fonctionnalité à découper :
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Ex: Mise en place de l'authentification multi-facteurs (MFA) avec SMS et App"
                      value={wbsPrompt}
                      onChange={(e) => setWbsPrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleGenerateWBS();
                      }}
                      className="flex-1 text-xs p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <button
                      onClick={handleGenerateWBS}
                      disabled={loading || !wbsPrompt.trim()}
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      <span>Découper</span>
                    </button>
                  </div>
                </div>
              </div>

              {loading && (
                <div className="py-12 text-center text-slate-500 space-y-2">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600" />
                  <p className="text-xs font-semibold">Décomposition en sous-tâches WBS et estimation de charge...</p>
                </div>
              )}

              {generatedTasks.length > 0 && !loading && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">
                      Tâches générées ({selectedTasksToAdd.length}/{generatedTasks.length} sélectionnées) :
                    </span>
                    <button
                      onClick={handleApplyTasks}
                      disabled={selectedTasksToAdd.length === 0}
                      className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Injecter dans le projet</span>
                    </button>
                  </div>

                  {tasksAddedSuccess && (
                    <div className="p-3 bg-emerald-100 text-emerald-800 font-bold rounded-xl text-xs text-center animate-bounce">
                      ✓ Les tâches ont été ajoutées au projet avec succès !
                    </div>
                  )}

                  <div className="space-y-2">
                    {generatedTasks.map((t, idx) => {
                      const isSelected = selectedTasksToAdd.includes(idx);
                      return (
                        <div
                          key={idx}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedTasksToAdd(selectedTasksToAdd.filter((i) => i !== idx));
                            } else {
                              setSelectedTasksToAdd([...selectedTasksToAdd, idx]);
                            }
                          }}
                          className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                            isSelected
                              ? 'bg-indigo-50/70 border-indigo-300 shadow-2xs'
                              : 'bg-slate-50 border-slate-200 opacity-60'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                            />
                            <div>
                              <h5 className="text-xs font-bold text-slate-900">{t.title}</h5>
                              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500">
                                <span className="bg-slate-200 px-1.5 py-0.2 rounded font-semibold text-slate-700">
                                  {t.category || 'Général'}
                                </span>
                                <span>Estimation : <strong>{t.estimatedHours}h</strong></span>
                                <span className="text-indigo-600 font-semibold">Priorité : {t.priority}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
