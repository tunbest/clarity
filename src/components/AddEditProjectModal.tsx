import React, { useState, useRef, useEffect } from 'react';
import { Project, ProjectStatus, PriorityLevel, ProjectLifecycleStatus, PortfolioScope } from '../types';
import { 
  X, 
  FolderPlus, 
  Mic, 
  MicOff, 
  Loader2, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  Layers,
  Check
} from 'lucide-react';
import { DEFAULT_KPI_WIDGETS } from '../data/initialData';

interface AddEditProjectModalProps {
  project?: Project | null;
  onClose: () => void;
  onSaveProject: (project: Project) => void;
  onDeleteProject?: (projectId: string) => void;
  scopes?: PortfolioScope[];
  canManageScopes?: boolean;
}

const LIFECYCLE_PHASES: {
  key: ProjectLifecycleStatus;
  label: string;
  subLabel: string;
  color: string;
  badge: string;
}[] = [
  {
    key: 'Planning',
    label: 'Planning (Cadrage & Planification)',
    subLabel: 'Avant-projet & Définition DSND — Étude préalable & spécifications',
    color: 'border-blue-400 bg-blue-50 text-blue-900',
    badge: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  {
    key: 'Execution',
    label: 'Execution (Exécution & Construction)',
    subLabel: 'Mise en œuvre des configurations & développements études',
    color: 'border-indigo-400 bg-indigo-50 text-indigo-900',
    badge: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  },
  {
    key: 'Monitoring',
    label: 'Monitoring (Pilotage & Validation)',
    subLabel: 'Recette technique YN & UAT utilisateur — Faisabilité exploitabilité',
    color: 'border-amber-400 bg-amber-50 text-amber-900',
    badge: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  {
    key: 'Closing',
    label: 'Closing (Clôture & Déploiement)',
    subLabel: 'Mise en production, passage en PSC/PSS & bilan Rex',
    color: 'border-emerald-400 bg-emerald-50 text-emerald-900',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
];

export const AddEditProjectModal: React.FC<AddEditProjectModalProps> = ({
  project,
  onClose,
  onSaveProject,
  onDeleteProject,
  scopes = [],
  canManageScopes = false,
}) => {
  const [name, setName] = useState(project?.name || '');
  const [code, setCode] = useState(project?.code || `PRJ-${new Date().getFullYear()}-${Math.floor(Math.random() * 899 + 100)}`);
  const [description, setDescription] = useState(project?.description || '');
  const [client, setClient] = useState(project?.client || 'Direction Générale');
  const [managerName, setManagerName] = useState(project?.managerName || 'Alexandre Dupont');
  const [status, setStatus] = useState<ProjectStatus>(project?.status || 'PLANNING');
  const [projectStatus, setProjectStatus] = useState<ProjectLifecycleStatus>(
    (project?.projectStatus as ProjectLifecycleStatus) || 'Planning'
  );
  const [priority, setPriority] = useState<PriorityLevel>(project?.priority || 'HIGH');
  const [methodology, setMethodology] = useState<'AGILE' | 'WATERFALL' | 'HYBRID'>(project?.methodology || 'HYBRID');
  const [startDate, setStartDate] = useState(
    project?.startDate || new Date().toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(
    project?.endDate || new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString().split('T')[0]
  );
  const [scopeId, setScopeId] = useState(project?.scopeId || '');
  const [trigrams, setTrigrams] = useState<string[]>(project?.trigrams || []);
  const selectedScope = scopes.find((scope) => scope.id === scopeId);
  const availableTrigrams = selectedScope?.trigrams || [];
  const toggleProjectTrigram = (trigram: string) => setTrigrams((current) => current.includes(trigram) ? current.filter((item) => item !== trigram) : [...current, trigram]);

  // Audio Recording & Transcription State via gemini-3.5-transcribe
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionStatus, setTranscriptionStatus] = useState<string | null>(null);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const startVoiceRecording = async () => {
    try {
      setTranscriptionStatus(null);
      setTranscriptionError(null);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      let mimeType = 'audio/webm';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        }
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const finalBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        await handleTranscribeAudio(finalBlob);
      };

      recorder.start(250);
      setIsRecording(true);
      setRecordingDuration(0);

      timerIntervalRef.current = window.setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Erreur accès micro:', err);
      setTranscriptionError("Accès au microphone refusé ou non supporté par le navigateur.");
      setIsRecording(false);
    }
  };

  const stopVoiceRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleTranscribeAudio = async (blob: Blob) => {
    setIsTranscribing(true);
    setTranscriptionStatus('Transcription audio avec gemini-3.5-transcribe...');
    setTranscriptionError(null);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      reader.readAsDataURL(blob);
      const dataUrl = await base64Promise;

      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: dataUrl,
          mimeType: blob.type,
        }),
      });

      const json = await res.json();
      if (json.success && json.text) {
        setDescription((prev) => {
          const trimmed = json.text.trim();
          return prev.trim() ? `${prev.trim()}\n\n${trimmed}` : trimmed;
        });
        setTranscriptionStatus('Texte transcrit et inséré dans la description !');
        setTimeout(() => setTranscriptionStatus(null), 4000);
      } else {
        setTranscriptionError(json.error || 'Aucun texte détecté dans l’enregistrement.');
      }
    } catch (err: any) {
      console.error('Erreur transcription:', err);
      setTranscriptionError('Échec de la transcription via gemini-3.5-transcribe.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const updatedProject: Project = {
      id: project?.id || `proj-${Date.now()}`,
      ...(canManageScopes ? { scopeId: scopeId || undefined, trigrams: trigrams.filter((item) => availableTrigrams.includes(item)) } : { scopeId: project?.scopeId, trigrams: project?.trigrams }),
      name: name.trim(),
      code: code.trim().toUpperCase(),
      description: description.trim(),
      client: client.trim(),
      managerName: managerName.trim(),
      status,
      projectStatus,
      priority,
      methodology,
      startDate,
      endDate,
      kpiWidgets: project?.kpiWidgets || DEFAULT_KPI_WIDGETS,
      tasks: project?.tasks || [],
      milestones: project?.milestones || [],
      risks: project?.risks || [],
      members: project?.members || [
        { id: `mem-${Date.now()}`, name: managerName.trim(), role: 'Chef de Projet', email: 'cp@entreprise.fr', maxWeeklyHours: 35, color: '#4F46E5' },
      ],
      createdAt: project?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSaveProject(updatedProject);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-100 text-indigo-700 shadow-xs">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {project ? 'Modifier les Paramètres du Projet' : 'Créer un Nouveau Projet'}
              </h2>
              <p className="text-xs text-slate-500">
                Gouvernance, cycle de vie (Project Status) & suivi opérationnel
              </p>
            </div>
          </div>

          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-5">
          
          {/* Project Name & Code */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nom du Projet *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Refonte Plateforme E-Commerce Omnicanale"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Code Projet
              </label>
              <input
                type="text"
                required
                placeholder="PRJ-2026-01"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono uppercase font-bold focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition-all"
              />
            </div>
          </div>

          {/* Dedicated Section: Project Status (Lifecycle Phase for Chef de Projet Production & CPE) */}
          <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                <label className="text-xs font-bold text-slate-800">
                  Statut du Cycle de Vie Projet (Project Status) *
                </label>
              </div>
              <span className="text-[10px] font-semibold text-slate-500">
                Suivi par le Chef de Projet Production (CPP)
              </span>
            </div>

            <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
              Définit la phase active du cycle de vie DSND/SCT pour aligner le pilotage études et l’exploitabilité production.
            </p>

            <div className="grid grid-cols-2 gap-2.5">
              {LIFECYCLE_PHASES.map((phase) => {
                const isSelected = projectStatus === phase.key;
                return (
                  <button
                    key={phase.key}
                    type="button"
                    onClick={() => setProjectStatus(phase.key)}
                    className={`text-left p-3 rounded-xl border text-xs transition-all relative flex flex-col justify-between ${
                      isSelected 
                        ? `${phase.color} ring-2 ring-indigo-500/30 shadow-xs font-medium` 
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold flex items-center gap-1.5">
                        {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 stroke-[3]" />}
                        {phase.key}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${phase.badge}`}>
                        {phase.key === 'Planning' ? 'Phase 1-2' : phase.key === 'Execution' ? 'Phase 3' : phase.key === 'Monitoring' ? 'Phase 4' : 'Phase 5'}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 line-clamp-2 leading-tight">
                      {phase.subLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description & Speech-to-Text with Microphone using gemini-3.5-transcribe */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700">
                Description & Enjeux Opérationnels
              </label>

              {/* Dictation Controls */}
              <div className="flex items-center gap-2">
                {!isRecording ? (
                  <button
                    type="button"
                    onClick={startVoiceRecording}
                    disabled={isTranscribing}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold border border-indigo-200 transition-colors cursor-pointer"
                    title="Dictée vocale transcrite avec gemini-3.5-transcribe"
                  >
                    <Mic className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Dicter au micro (IA)</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopVoiceRecording}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold shadow-xs animate-pulse cursor-pointer"
                  >
                    <MicOff className="w-3.5 h-3.5" />
                    <span>Arrêter ({formatTimer(recordingDuration)})</span>
                  </button>
                )}
              </div>
            </div>

            {/* Transcription Status Banner */}
            {isTranscribing && (
              <div className="mb-2 p-2 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center gap-2 text-indigo-900 text-xs">
                <Loader2 className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
                <span className="font-medium">Transcription audio en cours avec le modèle <code className="font-mono font-bold bg-indigo-100 px-1 py-0.5 rounded-sm">gemini-3.5-transcribe</code>...</span>
              </div>
            )}

            {transcriptionStatus && !isTranscribing && (
              <div className="mb-2 p-2 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-emerald-900 text-xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>{transcriptionStatus}</span>
              </div>
            )}

            {transcriptionError && (
              <div className="mb-2 p-2 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-rose-900 text-xs">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                <span>{transcriptionError}</span>
              </div>
            )}

            <div className="relative">
              <textarea
                rows={3}
                placeholder="Objectifs opérationnels, contexte technique, livrables attendus..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full text-xs p-3 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition-all"
              />
              {isRecording && (
                <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-rose-50 border border-rose-200 text-rose-700 text-[10px] px-2 py-0.5 rounded-full font-bold animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                  Enregistrement en cours ({formatTimer(recordingDuration)})
                </div>
              )}
            </div>
          </div>

          {canManageScopes && <section className="p-4 rounded-2xl border border-indigo-200 bg-indigo-50/50 space-y-3">
            <div>
              <h3 className="text-xs font-bold text-slate-900">Rattachement du projet</h3>
              <p className="text-[11px] text-slate-600 mt-1">Un projet appartient à un seul périmètre et peut être associé à plusieurs trigrammes de ce périmètre.</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Périmètre *</label>
              <select required value={scopeId} onChange={(e) => { setScopeId(e.target.value); setTrigrams([]); }} className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-xl">
                <option value="">Sélectionner un périmètre</option>
                {scopes.map((scope) => <option key={scope.id} value={scope.id}>{scope.code} — {scope.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">Trigrammes rattachés au projet</label>
              {!scopeId ? <p className="text-[11px] text-slate-500">Sélectionnez d'abord un périmètre.</p> : availableTrigrams.length === 0 ? <p className="text-[11px] text-amber-700">Aucun trigramme défini dans ce périmètre. Ajoutez-les dans la gestion des périmètres.</p> : <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{availableTrigrams.map((trigram) => <label key={trigram} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs cursor-pointer"><input type="checkbox" checked={trigrams.includes(trigram)} onChange={() => toggleProjectTrigram(trigram)} className="accent-indigo-600" /> <span className="font-semibold">{trigram}</span></label>)}</div>}
              <p className="text-[10px] text-slate-500 mt-2">{trigrams.length} trigramme(s) sélectionné(s). Cette sélection définit ceux proposés dans les MEP de ce projet.</p>
            </div>
          </section>}

          {/* Client & Responsable */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Commanditaire / Client
              </label>
              <input
                type="text"
                placeholder="Ex: Direction Marketing & Ventes"
                value={client}
                onChange={(e) => setClient(e.target.value)}
                className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-xl font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Chef de Projet Responsable (CPE)
              </label>
              <input
                type="text"
                placeholder="Ex: Alexandre Dupont (DSND)"
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
                className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-xl font-medium"
              />
            </div>
          </div>

          {/* Priority & Methodology */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Statut Exécution</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold"
              >
                <option value="PLANNING">Cadrage / Planification</option>
                <option value="IN_PROGRESS">En cours d'exécution</option>
                <option value="AT_RISK">En dérive / Risque</option>
                <option value="COMPLETED">Livré / Clôturé</option>
                <option value="ON_HOLD">En pause</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Priorité</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as PriorityLevel)}
                className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold"
              >
                <option value="LOW">Basse</option>
                <option value="MEDIUM">Moyenne</option>
                <option value="HIGH">Haute</option>
                <option value="CRITICAL">Stratégique / Critique</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Méthodologie</label>
              <select
                value={methodology}
                onChange={(e: any) => setMethodology(e.target.value)}
                className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold"
              >
                <option value="AGILE">Agile (Scrum/Kanban)</option>
                <option value="HYBRID">Hybride (Agile + Jalons)</option>
                <option value="WATERFALL">Cycle en V / Waterfall</option>
              </select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Date de début</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Date de fin prévue</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold"
              />
            </div>
          </div>

          {/* Footer Submit */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            {project && onDeleteProject ? (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Confirmez-vous la suppression du projet "${project.name}" ?`)) {
                    onDeleteProject(project.id);
                    onClose();
                  }
                }}
                className="text-xs font-bold text-rose-600 hover:text-rose-800"
              >
                Supprimer le projet
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <FolderPlus className="w-4 h-4" />
                <span>{project ? 'Enregistrer les modifications' : 'Créer le projet'}</span>
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
};
