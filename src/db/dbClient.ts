import pg from 'pg';
import { Project, Task, TeamMember, Risk, Milestone, AppUser } from '../types';
import { INITIAL_PROJECTS } from '../data/initialData';
import { calculateProjectMetrics } from '../utils/pmCalculations';

const { Pool } = pg;

// PostgreSQL Connection Pool (Lazy initialization to prevent crashes when unconfigured)
let poolInstance: pg.Pool | null = null;
let isPostgresConnected = false;

export function getPgPool(): pg.Pool | null {
  if (poolInstance) return poolInstance;

  const connectionString = process.env.DATABASE_URL;
  const host = process.env.POSTGRES_HOST;

  if (!connectionString && !host) {
    return null; // Development only; production startup separately requires PostgreSQL
  }

  try {
    const sslMode = (process.env.POSTGRES_SSL || 'disable').toLowerCase();
    const ssl = sslMode === 'disable' || sslMode === 'false'
      ? false
      : sslMode === 'insecure'
        ? { rejectUnauthorized: false }
        : { rejectUnauthorized: true };
    const common = {
      max: Number(process.env.PG_POOL_MAX || 10),
      min: 0,
      idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 30000),
      connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS || 10000),
      keepAlive: true,
      allowExitOnIdle: false,
      application_name: 'clarity-pm',
      ssl,
    };

    poolInstance = new Pool(
      connectionString
        ? { connectionString, ...common }
        : {
            host: process.env.POSTGRES_HOST,
            port: Number(process.env.POSTGRES_PORT) || 5432,
            database: process.env.POSTGRES_DB || 'clarity_pm',
            user: process.env.POSTGRES_USER || 'clarity_app',
            password: process.env.POSTGRES_PASSWORD || '',
            ...common,
          }
    );

    poolInstance.on('error', (err) => {
      console.error('[postgres-pool] Background connection error:', err.message);
      isPostgresConnected = false;
    });

    isPostgresConnected = true;
    return poolInstance;
  } catch (error) {
    console.warn('Failed to initialize PostgreSQL pool, falling back to resilient state:', error);
    return null;
  }
}

// In-Memory Synchronized Store (Acts as resilient cache & fallback)
class ResilientProjectStore {
  private projects: Map<string, Project> = new Map();
  private auditLogs: Array<{
    id: string;
    userId?: string;
    userEmail?: string;
    userRole?: string;
    action: string;
    entityType: string;
    entityId?: string;
    details?: any;
    createdAt: string;
  }> = [];

  constructor() {
    // Populate with Initial Projects
    INITIAL_PROJECTS.forEach((p) => {
      this.projects.set(p.id, { ...p });
    });
  }

  public getAllProjects(): Project[] {
    return Array.from(this.projects.values());
  }

  public getProjectById(id: string): Project | undefined {
    return this.projects.get(id);
  }

  public createProject(project: Project, createdBy?: AppUser): Project {
    const newProject: Project = {
      ...project,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.projects.set(newProject.id, newProject);

    this.addAuditLog({
      userId: createdBy?.id,
      userEmail: createdBy?.email,
      userRole: createdBy?.role || 'DIRECTEUR_PROJETS',
      action: 'CREATE_PROJECT',
      entityType: 'PROJECT',
      entityId: newProject.id,
      details: { name: newProject.name, code: newProject.code, budget: newProject.totalBudget },
    });

    return newProject;
  }

  public updateProject(id: string, updates: Partial<Project>, updatedBy?: AppUser): Project | null {
    const existing = this.projects.get(id);
    if (!existing) return null;

    const updated: Project = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.projects.set(id, updated);

    this.addAuditLog({
      userId: updatedBy?.id,
      userEmail: updatedBy?.email,
      userRole: updatedBy?.role,
      action: 'UPDATE_PROJECT',
      entityType: 'PROJECT',
      entityId: id,
      details: updates,
    });

    return updated;
  }

  public deleteProject(id: string, deletedBy?: AppUser): boolean {
    const existing = this.projects.get(id);
    if (!existing) return false;

    this.projects.delete(id);
    this.addAuditLog({
      userId: deletedBy?.id,
      userEmail: deletedBy?.email,
      userRole: deletedBy?.role || 'DIRECTEUR_PROJETS',
      action: 'DELETE_PROJECT',
      entityType: 'PROJECT',
      entityId: id,
      details: { name: existing.name, code: existing.code },
    });

    return true;
  }

  // Tasks Management
  public addTask(projectId: string, task: Task, addedBy?: AppUser): Task | null {
    const project = this.projects.get(projectId);
    if (!project) return null;

    const newTask: Task = { ...task };
    project.tasks.push(newTask);
    project.updatedAt = new Date().toISOString();

    this.addAuditLog({
      userId: addedBy?.id,
      userEmail: addedBy?.email,
      userRole: addedBy?.role,
      action: 'ADD_TASK',
      entityType: 'TASK',
      entityId: task.id,
      details: { projectId, title: task.title },
    });

    return newTask;
  }

  public updateTask(projectId: string, taskId: string, taskUpdates: Partial<Task>, updatedBy?: AppUser): Task | null {
    const project = this.projects.get(projectId);
    if (!project) return null;

    const idx = project.tasks.findIndex((t) => t.id === taskId);
    if (idx === -1) return null;

    project.tasks[idx] = { ...project.tasks[idx], ...taskUpdates };
    project.updatedAt = new Date().toISOString();

    this.addAuditLog({
      userId: updatedBy?.id,
      userEmail: updatedBy?.email,
      userRole: updatedBy?.role,
      action: 'UPDATE_TASK',
      entityType: 'TASK',
      entityId: taskId,
      details: { projectId, updates: taskUpdates },
    });

    return project.tasks[idx];
  }

  public deleteTask(projectId: string, taskId: string, deletedBy?: AppUser): boolean {
    const project = this.projects.get(projectId);
    if (!project) return false;

    project.tasks = project.tasks.filter((t) => t.id !== taskId);
    project.updatedAt = new Date().toISOString();

    this.addAuditLog({
      userId: deletedBy?.id,
      userEmail: deletedBy?.email,
      userRole: deletedBy?.role,
      action: 'DELETE_TASK',
      entityType: 'TASK',
      entityId: taskId,
      details: { projectId },
    });

    return true;
  }

  // Team Resources Management (Directeur de Projets Privilege)
  public addTeamMember(projectId: string, member: TeamMember, addedBy?: AppUser): TeamMember | null {
    const project = this.projects.get(projectId);
    if (!project) return null;

    project.members.push(member);
    project.updatedAt = new Date().toISOString();

    this.addAuditLog({
      userId: addedBy?.id,
      userEmail: addedBy?.email,
      userRole: addedBy?.role || 'DIRECTEUR_PROJETS',
      action: 'ADD_RESOURCE',
      entityType: 'TEAM_MEMBER',
      entityId: member.id,
      details: { projectId, name: member.name, role: member.role, hourlyRate: member.hourlyRate },
    });

    return member;
  }

  public updateTeamMember(projectId: string, memberId: string, memberUpdates: Partial<TeamMember>, updatedBy?: AppUser): TeamMember | null {
    const project = this.projects.get(projectId);
    if (!project) return null;

    const idx = project.members.findIndex((m) => m.id === memberId);
    if (idx === -1) return null;

    project.members[idx] = { ...project.members[idx], ...memberUpdates };
    project.updatedAt = new Date().toISOString();

    this.addAuditLog({
      userId: updatedBy?.id,
      userEmail: updatedBy?.email,
      userRole: updatedBy?.role,
      action: 'UPDATE_RESOURCE',
      entityType: 'TEAM_MEMBER',
      entityId: memberId,
      details: { projectId, updates: memberUpdates },
    });

    return project.members[idx];
  }

  public deleteTeamMember(projectId: string, memberId: string, deletedBy?: AppUser): boolean {
    const project = this.projects.get(projectId);
    if (!project) return false;

    project.members = project.members.filter((m) => m.id !== memberId);
    project.updatedAt = new Date().toISOString();

    this.addAuditLog({
      userId: deletedBy?.id,
      userEmail: deletedBy?.email,
      userRole: deletedBy?.role,
      action: 'REMOVE_RESOURCE',
      entityType: 'TEAM_MEMBER',
      entityId: memberId,
      details: { projectId },
    });

    return true;
  }

  // Risks Management
  public addRisk(projectId: string, risk: Risk, addedBy?: AppUser): Risk | null {
    const project = this.projects.get(projectId);
    if (!project) return null;

    project.risks.push(risk);
    project.updatedAt = new Date().toISOString();

    this.addAuditLog({
      userId: addedBy?.id,
      userEmail: addedBy?.email,
      userRole: addedBy?.role,
      action: 'ADD_RISK',
      entityType: 'RISK',
      entityId: risk.id,
      details: { projectId, title: risk.title, probability: risk.probability, impact: risk.impact },
    });

    return risk;
  }

  public updateRisk(projectId: string, riskId: string, riskUpdates: Partial<Risk>, updatedBy?: AppUser): Risk | null {
    const project = this.projects.get(projectId);
    if (!project) return null;

    const idx = project.risks.findIndex((r) => r.id === riskId);
    if (idx === -1) return null;

    project.risks[idx] = { ...project.risks[idx], ...riskUpdates };
    project.updatedAt = new Date().toISOString();

    this.addAuditLog({
      userId: updatedBy?.id,
      userEmail: updatedBy?.email,
      userRole: updatedBy?.role,
      action: 'UPDATE_RISK',
      entityType: 'RISK',
      entityId: riskId,
      details: { projectId, updates: riskUpdates },
    });

    return project.risks[idx];
  }

  public deleteRisk(projectId: string, riskId: string, deletedBy?: AppUser): boolean {
    const project = this.projects.get(projectId);
    if (!project) return false;

    project.risks = project.risks.filter((r) => r.id !== riskId);
    project.updatedAt = new Date().toISOString();

    this.addAuditLog({
      userId: deletedBy?.id,
      userEmail: deletedBy?.email,
      userRole: deletedBy?.role,
      action: 'DELETE_RISK',
      entityType: 'RISK',
      entityId: riskId,
      details: { projectId },
    });

    return true;
  }

  // Milestones Management
  public addMilestone(projectId: string, milestone: Milestone, addedBy?: AppUser): Milestone | null {
    const project = this.projects.get(projectId);
    if (!project) return null;

    project.milestones.push(milestone);
    project.updatedAt = new Date().toISOString();

    this.addAuditLog({
      userId: addedBy?.id,
      userEmail: addedBy?.email,
      userRole: addedBy?.role,
      action: 'ADD_MILESTONE',
      entityType: 'MILESTONE',
      entityId: milestone.id,
      details: { projectId, title: milestone.title, targetDate: milestone.targetDate },
    });

    return milestone;
  }

  public updateMilestone(projectId: string, milestoneId: string, updates: Partial<Milestone>, updatedBy?: AppUser): Milestone | null {
    const project = this.projects.get(projectId);
    if (!project) return null;

    const idx = project.milestones.findIndex((m) => m.id === milestoneId);
    if (idx === -1) return null;

    project.milestones[idx] = { ...project.milestones[idx], ...updates };
    project.updatedAt = new Date().toISOString();

    this.addAuditLog({
      userId: updatedBy?.id,
      userEmail: updatedBy?.email,
      userRole: updatedBy?.role,
      action: 'UPDATE_MILESTONE',
      entityType: 'MILESTONE',
      entityId: milestoneId,
      details: { projectId, updates },
    });

    return project.milestones[idx];
  }

  public deleteMilestone(projectId: string, milestoneId: string, deletedBy?: AppUser): boolean {
    const project = this.projects.get(projectId);
    if (!project) return false;

    project.milestones = project.milestones.filter((m) => m.id !== milestoneId);
    project.updatedAt = new Date().toISOString();

    this.addAuditLog({
      userId: deletedBy?.id,
      userEmail: deletedBy?.email,
      userRole: deletedBy?.role,
      action: 'DELETE_MILESTONE',
      entityType: 'MILESTONE',
      entityId: milestoneId,
      details: { projectId },
    });

    return true;
  }

  // Audit Logs
  public addAuditLog(log: {
    userId?: string;
    userEmail?: string;
    userRole?: string;
    action: string;
    entityType: string;
    entityId?: string;
    details?: any;
  }) {
    this.auditLogs.unshift({
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      createdAt: new Date().toISOString(),
      ...log,
    });
    // Keep max 500 logs
    if (this.auditLogs.length > 500) {
      this.auditLogs.pop();
    }
  }

  public getAuditLogs(limit = 50) {
    return this.auditLogs.slice(0, limit);
  }
}

export const dbStore = new ResilientProjectStore();
