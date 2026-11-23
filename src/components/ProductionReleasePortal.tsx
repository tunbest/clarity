import React from 'react';
import { AppUser, Project } from '../types';
import { ProdPilotWorkspace } from './ProdPilotWorkspace';

interface ProductionReleasePortalProps {
  currentUser: AppUser;
  projects?: Project[];
}

export const ProductionReleasePortal: React.FC<ProductionReleasePortalProps> = ({
  currentUser,
  projects = [],
}) => {
  return <ProdPilotWorkspace currentUser={currentUser} projects={projects} />;
};
