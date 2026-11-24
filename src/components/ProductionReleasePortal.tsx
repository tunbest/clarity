import React from 'react';
import { AppUser, Project } from '../types';
import { ProdPilotWorkspace } from './ProdPilotWorkspace';

interface ProductionReleasePortalProps {
  currentUser: AppUser;
  projects?: Project[];
  activeProjectId?: string;
  onUpdateProject?: (project: Project) => void;
}

export const ProductionReleasePortal: React.FC<ProductionReleasePortalProps> = ({
  currentUser,
  projects = [],
  activeProjectId,
  onUpdateProject,
}) => {
  return <ProdPilotWorkspace currentUser={currentUser} projects={projects} activeProjectId={activeProjectId} onUpdateProject={onUpdateProject} />;
};
