export type Role = 'ADMIN' | 'DIRECTEUR' | 'MANAGER' | 'PROFESSIONNEL';

export type Permission =
  | 'accessAdmin'
  | 'manageUsers'
  | 'resetOtherUserPassword'
  | 'deleteUser'
  | 'manageVehicles'
  | 'forceDeleteVehicle'
  | 'manageCleaningSchedule'
  | 'deleteCleaningSchedule'
  | 'manageSettings'
  | 'declareCriticalIncident'
  | 'manageAdminTrips'
  | 'viewAllVehicles';

const permissionMatrix: Record<Permission, readonly Role[]> = {
  accessAdmin: ['ADMIN', 'DIRECTEUR', 'MANAGER'],
  manageUsers: ['ADMIN', 'DIRECTEUR'],
  resetOtherUserPassword: ['ADMIN', 'DIRECTEUR'],
  deleteUser: ['ADMIN', 'DIRECTEUR'],
  manageVehicles: ['ADMIN', 'DIRECTEUR', 'MANAGER'],
  forceDeleteVehicle: ['ADMIN', 'DIRECTEUR'],
  manageCleaningSchedule: ['ADMIN', 'DIRECTEUR', 'MANAGER'],
  deleteCleaningSchedule: ['ADMIN', 'DIRECTEUR'],
  manageSettings: ['ADMIN'],
  declareCriticalIncident: ['ADMIN', 'DIRECTEUR', 'MANAGER'],
  manageAdminTrips: ['ADMIN', 'DIRECTEUR', 'MANAGER'],
  viewAllVehicles: ['ADMIN', 'DIRECTEUR'],
};

export const ADMIN_ACCESS_ROLES = permissionMatrix.accessAdmin;

export function hasPermission(role: Role | null | undefined, permission: Permission): boolean {
  return !!role && permissionMatrix[permission].includes(role);
}

export function canAccessAdmin(role: Role | null | undefined): boolean {
  return hasPermission(role, 'accessAdmin');
}

export function canManageUsers(role: Role | null | undefined): boolean {
  return hasPermission(role, 'manageUsers');
}

export function canResetPassword(role: Role | null | undefined): boolean {
  return hasPermission(role, 'resetOtherUserPassword');
}

export function canDeleteUser(role: Role | null | undefined): boolean {
  return hasPermission(role, 'deleteUser');
}

export function canManageVehicles(role: Role | null | undefined): boolean {
  return hasPermission(role, 'manageVehicles');
}

export function canDeleteVehicle(role: Role | null | undefined, force = false): boolean {
  return force ? hasPermission(role, 'forceDeleteVehicle') : hasPermission(role, 'manageVehicles');
}

export function canManageCleaningSchedule(role: Role | null | undefined): boolean {
  return hasPermission(role, 'manageCleaningSchedule');
}

export function canManageSettings(role: Role | null | undefined): boolean {
  return hasPermission(role, 'manageSettings');
}

export function canManageAdminTrips(role: Role | null | undefined): boolean {
  return hasPermission(role, 'manageAdminTrips');
}

export function canViewAllVehicles(role: Role | null | undefined): boolean {
  return hasPermission(role, 'viewAllVehicles');
}
