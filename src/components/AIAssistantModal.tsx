import React from 'react';
import { Project, ProjectMetrics } from '../types';
import { CloudflareAIChat } from './CloudflareAIChat';
import { Bot, X } from 'lucide-react';

interface AIAssistantModalProps { project: Project; metrics?: ProjectMetrics; onClose: () => void; onApplyProject: (project: Project) => void; }

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({ project, onClose, onApplyProject }) => (
  <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-sm'>
    <div className='flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl'>
      <div className='flex items-center justify-between border-b border-slate-100 px-5 py-3'>
        <div className='flex items-center gap-3'><span className='rounded-xl bg-indigo-600 p-2 text-white'><Bot className='h-5 w-5'/></span><div><h2 className='text-sm font-bold text-slate-900'>Clarity AI — Agent intelligent</h2><p className='text-xs text-slate-500'>Analyse, proposition et validation avant modification</p></div></div>
        <button type='button' onClick={onClose} aria-label='Fermer' className='rounded-lg p-2 text-slate-500 hover:bg-slate-100'><X className='h-5 w-5'/></button>
      </div>
      <div className='overflow-y-auto p-4 sm:p-5'><CloudflareAIChat project={project} onApplyProject={onApplyProject}/></div>
    </div>
  </div>
);
