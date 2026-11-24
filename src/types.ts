export type ProjectStatus = 'PLANNING' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'AT_RISK';
export type ProjectLifecycleStatus = 'Planning' | 'Execution' | 'Monitoring' | 'Closing';
export type PriorityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE' | 'BLOCKED';
export type Methodology = 'AGILE' | 'WATERFALL' | 'HYBRID';
export type RiskCategory = 'TECHNIQUE' | 'DELAIS' | 'RESSOURCES' | 'JURIDIQUE' | 'EXTERNE';
export type RiskStatus = 'ACTIVE' | 'MITIGATED' | 'CLOSED' | 'OCCURRED';

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: PriorityLevel;
  assigneeId?: string;
  milestoneId?: string;
  startDate: string; // ISO format YYYY-MM-DD
  dueDate: string;   // ISO format YYYY-MM-DD
  estimatedHours: number;
  actualHours: number;
  completionPercent: number; // 0 - 100
  category?: string;
  tags: string[];
  subtasks?: Subtask[];
  predecessorIds?: string[]; // IDs of tasks that must finish before this starts
}

export interface Milestone {
  id: string;
  projectId: string;
  title: string;
  targetDate: string;
  actualDate?: string;
  completed: boolean;
  description?: string;
  deliverable?: string;
  deliverables?: string[];
}

export interface Risk {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  category: RiskCategory;
  probability: number; // 1 to 5
  impact: number;      // 1 to 5
  mitigationPlan: string;
  contingencyPlan?: string;
  ownerId?: string;
  status: RiskStatus;
  identifiedDate?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  email: string;
  avatarUrl?: string;
  maxWeeklyHours: number;
  color: string;
}

export type WidgetType = 
  | 'STAT_CARD' 
  | 'BURNDOWN_CHART' 
  | 'WORKLOAD_BAR' 
  | 'TASK_STATUS_PIE' 
  | 'RISK_HEATMAP' 
  | 'MILESTONE_TIMELINE' 
;

export interface KPIWidget {
  id: string;
  type: WidgetType;
  title: string;
  description?: string;
  metricKey?: string;
  size: 'SMALL' | 'MEDIUM' | 'LARGE' | 'FULL';
  isVisible: boolean;
  order: number;
  thresholds?: {
    greenMin?: number;
    amberMin?: number;
    target?: number;
  };
}

export interface PortfolioScope {
  id: string;
  code: string;
  name: string;
  description?: string;
  trigrams: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  scopeId?: string;
  trigrams?: string[];
  code: string;
  name: string;
  description: string;
  client?: string;
  managerName: string;
  managerId?: string;
  status: ProjectStatus;
  projectStatus?: ProjectLifecycleStatus;
  priority: PriorityLevel;
  methodology: Methodology;
  startDate: string;
  endDate: string;
  members: TeamMember[];
  tasks: Task[];
  milestones: Milestone[];
  risks: Risk[];
  kpiWidgets: KPIWidget[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMetrics {
  // Indicateurs de planning uniquement, sans valorisation financière
  SPI: number; // Avancement réel / avancement théorique
  SV: number; // Écart d'avancement en points de pourcentage
  
  // Progress & Counts
  progressPercent: number;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  blockedTasks: number;
  overdueTasks: number;
  
  // Hours
  totalEstimatedHours: number;
  totalActualHours: number;
  
  // Health & Risks
  healthScore: number; // 0 to 100
  healthStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  criticalRisksCount: number;
  totalRisksCount: number;
  
  // Milestones
  completedMilestones: number;
  totalMilestones: number;
}

export type UserRole = 'DIRECTEUR_PROJETS' | 'CHEF_PROJET' | 'CHEF_PROJET_PROD' | 'PMO' | 'CONTRIBUTEUR' | 'ADMINISTRATEUR';

export type ReleaseStatus = 'DELIVERED_BY_ETUDE' | 'QUALIFIED' | 'CAB_APPROVED' | 'IN_DEPLOYMENT' | 'DEPLOYED_PROD' | 'ROLLBACK';
export type ReleaseEnvironment = 'PROD' | 'PREPROD' | 'RECETTE' | 'DISASTER_RECOVERY';

export interface RunbookStep {
  id: string;
  stepNumber: number;
  title: string;
  responsible: string;
  estimatedMinutes: number;
  completed: boolean;
}

export interface RollbackStep {
  id: string;
  title: string;
  commandOrAction: string;
}

export type DsndProjectPhase = 
  | 'AVANT_PROJET' 
  | 'DEFINITION' 
  | 'CONSTRUCTION' 
  | 'VALIDATION' 
  | 'DEPLOYMENT' 
  | 'PSC_PSS' 
  | 'CLOTURE';

export interface SctDomainSollicitation {
  id: string;
  domain: 'Cloud AWS/Azure' | 'Système Linux/Windows' | 'Réseau & F5/DNS' | 'Base de Données PostgreSQL' | 'Middleware & Kafka' | 'Sécurité & IAM';
  leadName: string;
  allocatedResource: string;
  status: 'NON_REQUIS' | 'SOLLICITE' | 'AFFECTE' | 'LIVRE';
  taskDescription: string;
  workloadDays: number;
}

export interface RfcChangeDetails {
  objectif: string;
  perimetre: string;
  importance: 'CRITIQUE' | 'MAJEURE' | 'MINEURE';
  justification: string;
  dateMiseEnOeuvreSouhaitee: string;
  dailyCnpStatus: 'BROUILLON' | 'SOUMIS_CAB' | 'APPROUVE' | 'PLANIFIE' | 'EN_COURS' | 'CLOS';
}

export interface ExploitabilityRequirement {
  id: string;
  category: 'Supervision & Métriques' | 'Résilience & PRA' | 'Sauvegarde & Restauration' | 'Sécurité & Durcissement' | 'Performance & Sizing';
  title: string;
  satisfied: boolean;
  verificationMethod: string;
}

export interface BdiDocument {
  id: string;
  reference: string;
  date: string;
  status: 'SIGNE' | 'EN_ATTENTE' | 'A_EMETTRE';
  description: string;
}

export interface BdcDocument {
  id: string;
  reference: string;
  date?: string;
  status: 'CLOS_SANS_RESERVE' | 'RESERVE_MINEURE' | 'EN_ATTENTE';
  pvObservation?: string;
}

export interface RapportFlash {
  id: string;
  date: string;
  meteo: 'VERT' | 'ORANGE' | 'ROUGE';
  highlights: string;
  nextMilestone: string;
  author: string;
}

export interface CompteRendu {
  id: string;
  date: string;
  title: string;
  participants: string[];
  decisions: string[];
}

export interface TransitionPostMep {
  mode: 'PSC' | 'PSS' | 'TRANSFERE_MCO';
  startDate: string;
  endDate: string;
  incidentsCount: number;
  rexClotureDone: boolean;
  observationsMco: string;
}

export interface ProductionRelease {
  id: string;
  projectId: string;
  projectName: string;
  rfcCode: string;
  title: string;
  studyTeamName: string;
  versionTag: string;
  deliveryDateByEtude: string;
  scheduledWindowDate: string;
  maintenanceWindowDurationMinutes: number;
  environment: ReleaseEnvironment;
  status: ReleaseStatus;
  cabApproved: boolean;
  cabMeetingDate?: string;
  rollbackPlanTested: boolean;
  sqlMigrationScriptsIncluded: boolean;
  dockerImageTag?: string;
  runbookSteps: RunbookStep[];
  rollbackSteps: RollbackStep[];
  releaseNotes: string;
  impactedUsersCount?: number;

  // SCT (Services Cloud et Technologies - YN) / DSND Methodology Fields
  gireJiraId?: string;
  dailyCnpChgId?: string;
  cpeName?: string;
  cppName?: string;
  demandeur?: string;
  currentPhase?: DsndProjectPhase;
  rfcDetails?: RfcChangeDetails;
  sctDomains?: SctDomainSollicitation[];
  exploitabilityRequirements?: ExploitabilityRequirement[];
  bdi?: BdiDocument;
  bdc?: BdcDocument;
  rapportsFlash?: RapportFlash[];
  comptesRendus?: CompteRendu[];
  transitionPostMep?: TransitionPostMep;
}

export interface AppUser {
  id: string;
  displayName: string;
  email: string;
  role?: UserRole;
  jobTitle?: string;
  department?: string;
  officeLocation?: string;
  avatarUrl?: string;
  authProvider: 'LOCAL';
  connectedAt: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: AppUser | null;
  isLoading: boolean;
  isConfigured: boolean;
}

export interface PostgresConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  passwordConfigured: boolean;
  sslMode: 'require' | 'prefer' | 'disable';
  maxPoolSize: number;
  idleTimeoutMillis: number;
  connectionStatus: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'ERROR';
  lastTestedAt?: string;
  lastSyncAt?: string;
  latencyMs?: number;
  tableStats?: {
    projects: number;
    tasks: number;
    resources: number;
    risks: number;
    milestones: number;
  };
}

export interface IACopilotConfig {
  provider: 'GEMINI_PRO' | 'OPENAI' | 'AZURE_OPENAI';
  model: string;
  apiKeyConfigured: boolean;
  temperature: number;
  maxOutputTokens: number;
  contextWindow: number;
  features: {
    wbsGeneration: boolean;
    copilReporting: boolean;
    riskPrediction: boolean;
    resourceBalancing: boolean;
  };
  totalCallsMonth: number;
  avgLatencyMs: number;
  successRate: number;
  lastUsedAt?: string;
}

export interface SystemAdminSettings {
  postgres: PostgresConfig;
  copilot: IACopilotConfig;
  governance: {
    directorCanManageProjects: boolean;
    directorCanAllocateResources: boolean;
    maxProjectsPerDirector: number;
    auditLogRetentionDays: number;
  };
}
