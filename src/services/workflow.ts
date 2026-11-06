import type { AdminRole, ComplaintStatus, IncidentStatus } from '../types/civic';

const WARD_ROLES = new Set<AdminRole>([
  'super_admin',
  'state_admin',
  'district_admin',
  'municipal_admin',
  'ward_admin',
]);

const DEPT_ROLES = new Set<AdminRole>([
  'super_admin',
  'state_admin',
  'district_admin',
  'municipal_admin',
]);

export const COMPLAINT_TRANSITIONS: Record<
  ComplaintStatus,
  Partial<Record<ComplaintStatus, Set<AdminRole>>>
> = {
  received: { under_review: WARD_ROLES },
  under_review: {
    inspection_scheduled: WARD_ROLES,
    in_progress: WARD_ROLES,
    awaiting_verification: DEPT_ROLES,
  },
  inspection_scheduled: {
    in_progress: WARD_ROLES,
    awaiting_verification: DEPT_ROLES,
  },
  in_progress: {
    awaiting_verification: DEPT_ROLES,
  },
  awaiting_verification: {},
  reopened: {
    under_review: WARD_ROLES,
    in_progress: WARD_ROLES,
  },
  resolved: {
    closed: DEPT_ROLES,
  },
  closed: {},
};

export function canTransition(
  current: ComplaintStatus,
  target: ComplaintStatus,
  role: AdminRole
): boolean {
  const allowed = COMPLAINT_TRANSITIONS[current]?.[target];
  return Boolean(allowed && allowed.has(role));
}

export function allowedTargets(current: ComplaintStatus, role: AdminRole): ComplaintStatus[] {
  const map = COMPLAINT_TRANSITIONS[current] || {};
  return (Object.entries(map) as Array<[ComplaintStatus, Set<AdminRole>]>)
    .filter(([, roles]) => roles.has(role))
    .map(([status]) => status);
}

export function isDeptPlus(role: AdminRole): boolean {
  return DEPT_ROLES.has(role);
}

export function deriveIncidentStatus(memberStatuses: ComplaintStatus[]): IncidentStatus {
  if (memberStatuses.length > 0 && memberStatuses.every((s) => s === 'closed')) {
    return 'resolved';
  }
  if (memberStatuses.some((s) => s === 'reopened')) {
    return 'reopened';
  }
  if (
    memberStatuses.some((s) => s === 'awaiting_verification' || s === 'resolved')
  ) {
    return 'awaiting_verification';
  }
  if (
    memberStatuses.some(
      (s) => s === 'in_progress' || s === 'inspection_scheduled'
    )
  ) {
    return 'in_progress';
  }
  return 'open';
}
