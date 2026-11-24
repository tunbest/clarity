import React from 'react';
import { AppUser, Project } from '../types';
import { ProdPilotWorkspace } from './ProdPilotWorkspace';

interface ProductionReleasePortalProps {
  currentUser: AppUser;
  projects?: Project[];
  activeProjectId?: string;
}

export const ProductionReleasePortal: React.FC<ProductionReleasePortalProps> = ({
  currentUser,
  projects = [],
  activeProjectId,
}) => {
  return <ProdPilotWorkspace currentUser={currentUser} projects={projects} activeProjectId={activeProjectId} />;
};
