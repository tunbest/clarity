import { Project, ProjectMetrics } from '../types';

export function calculateProjectMetrics(project: Project): ProjectMetrics {
  const tasks = project?.tasks || [];
  const milestones = project?.milestones || [];
  const risks = project?.risks || [];
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'DONE').length;
  const inProgressTasks = tasks.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'REVIEW').length;
  const blockedTasks = tasks.filter((t) => t.status === 'BLOCKED').length;
  const today = new Date().toISOString().slice(0, 10);
  const overdueTasks = tasks.filter((t) => t.status !== 'DONE' && t.dueDate && t.dueDate < today).length;
  const totalEstimatedHours = tasks.reduce((sum, t) => sum + (Number(t.estimatedHours) || 0), 0);
  const totalActualHours = tasks.reduce((sum, t) => sum + (Number(t.actualHours) || 0), 0);

  let progressPercent = 0;
  if (totalEstimatedHours > 0) {
    const earnedHours = tasks.reduce((sum, t) => sum + ((Number(t.estimatedHours) || 0) * ((t.status === 'DONE' ? 100 : (t.completionPercent || 0)) / 100)), 0);
    progressPercent = Math.round((earnedHours / totalEstimatedHours) * 100);
  } else if (totalTasks > 0) {
    progressPercent = Math.round((completedTasks / totalTasks) * 100);
  }

  const start = new Date(project.startDate).getTime();
  const end = new Date(project.endDate).getTime();
  const now = Date.now();
  let plannedProgress = 0;
  if (end > start) plannedProgress = now <= start ? 0 : now >= end ? 100 : ((now - start) / (end - start)) * 100;
  const SPI = plannedProgress > 0 ? Number((progressPercent / plannedProgress).toFixed(2)) : 1;
  const SV = Math.round((progressPercent - plannedProgress) * 10) / 10;

  const criticalRisksCount = risks.filter((risk) => risk.status === 'ACTIVE' && risk.probability * risk.impact >= 15).length;
  const totalRisksCount = risks.length;
  const completedMilestones = milestones.filter((m) => m.completed).length;
  const totalMilestones = milestones.length;

  let healthScore = 100;
  if (SPI < 1) healthScore -= SPI >= 0.9 ? 8 : SPI >= 0.8 ? 18 : 30;
  if (overdueTasks > 0) healthScore -= Math.min(25, overdueTasks * 6);
  if (blockedTasks > 0) healthScore -= Math.min(15, blockedTasks * 5);
  if (criticalRisksCount > 0) healthScore -= Math.min(20, criticalRisksCount * 8);
  healthScore = Math.max(10, Math.min(100, Math.round(healthScore)));

  let healthStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';
  if (healthScore < 60 || SPI < 0.8 || criticalRisksCount >= 2) healthStatus = 'CRITICAL';
  else if (healthScore < 80 || SPI < 0.95 || overdueTasks > 0) healthStatus = 'WARNING';

  return {
    SPI, SV, progressPercent, totalTasks, completedTasks, inProgressTasks, blockedTasks, overdueTasks,
    totalEstimatedHours, totalActualHours, healthScore, healthStatus, criticalRisksCount, totalRisksCount,
    completedMilestones, totalMilestones,
  };
}

export function formatCurrency(amount: number, currency: string = '€'): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: currency === '€' ? 'EUR' : currency === '$' ? 'USD' : 'EUR', maximumFractionDigits: 0 }).format(amount);
}

export function formatDateFR(dateStr?: string): string {
  if (!dateStr) return '-';
  try { return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return dateStr; }
}
