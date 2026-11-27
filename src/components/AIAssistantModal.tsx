import React from 'react';
import { Project } from '../types';
import { CloudflareAIChat } from './CloudflareAIChat';
import { Bot, X } from 'lucide-react';

interface AIAssistantModalProps { project: Project; metrics?: unknown; onClose: () => void; onApplyProject: (project: Project) => void; }

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({ project, onClose, onApplyProject }) => (
  <aside
    aria-label="Assistant Clarity AI"
    className="fixed inset-y-0 right-0 z-50 flex h-dvh w-full max-w-[440px] flex-col border-l border-slate-200 bg-white shadow-2xl"
  >
    <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="rounded-xl bg-indigo-600 p-2 text-white"><Bot className="h-5 w-5" /></span>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-bold text-slate-900">Clarity AI</h2>
          <p className="text-xs text-slate-500">Assistant intelligent · validation avant application</p>
        </div>
      </div>
      <button type="button" onClick={onClose} aria-label="Fermer l’assistant" className="ml-3 rounded-lg p-2 text-slate-500 hover:bg-slate-100">
        <X className="h-5 w-5" />
      </button>
    </div>
    <div className="min-h-0 flex-1 overflow-hidden">
      <CloudflareAIChat project={project} onApplyProject={onApplyProject} />
    </div>
  </aside>
);
