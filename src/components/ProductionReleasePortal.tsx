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

export const ProductionReleasePortal: React.FC<ProductionReleasePortalProps> = ({
  currentUser,
  projects = [],
  scopes = [],
  activeProjectId,
  onUpdateProject,
}) => {
  return <ProdPilotWorkspace currentUser={currentUser} projects={projects} scopes={scopes} activeProjectId={activeProjectId} onUpdateProject={onUpdateProject} />;
};
