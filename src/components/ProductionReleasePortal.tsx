import React from 'react';
import { AppUser, Project, PortfolioScope } from '../types';
import { ProdPilotWorkspace } from './ProdPilotWorkspace';

interface ProductionReleasePortalProps {
  currentUser: AppUser;
  projects?: Project[];
  scopes?: PortfolioScope[];
  activeProjectId?: string;
  onUpdateProject?: (project: Project) => void;
}

class ProductionReleaseErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  state = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error?.message || 'Erreur inattendue dans le module MEP.' };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Clarity MEP render failure:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="m-6 rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-rose-700">Le module MEP a rencontré une erreur</h2>
          <p className="mt-2 text-sm text-slate-600">{this.state.message}</p>
          <p className="mt-1 text-xs text-slate-500">L’erreur a été enregistrée dans la console du navigateur. Les données PostgreSQL ne sont pas supprimées.</p>
          <button onClick={() => window.location.reload()} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Recharger Clarity</button>
        </main>
      );
    }
    return this.props.children;
  }
}

export const ProductionReleasePortal: React.FC<ProductionReleasePortalProps> = ({
  currentUser,
  projects = [],
  scopes = [],
  activeProjectId,
  onUpdateProject,
}) => {
  return (
    <ProductionReleaseErrorBoundary>
      <ProdPilotWorkspace currentUser={currentUser} projects={projects} scopes={scopes} activeProjectId={activeProjectId} onUpdateProject={onUpdateProject} />
    </ProductionReleaseErrorBoundary>
  );
};
