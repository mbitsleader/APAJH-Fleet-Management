'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { type Role } from '@/lib/permissions';

export type AdminRole = Role;

export function useAdminAccess(allowedRoles: readonly AdminRole[]) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const isAuthorized = !!user && allowedRoles.includes(user.role as AdminRole);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace('/login');
      return;
    }

    if (!allowedRoles.includes(user.role as AdminRole)) {
      router.replace('/');
    }
  }, [allowedRoles, authLoading, router, user]);

  return {
    user,
    authLoading,
    isAuthorized,
    isReady: !authLoading && isAuthorized,
  };
}

export function useAuthorizedAdminLoader(
  allowedRoles: readonly AdminRole[],
  load: () => void | Promise<void>
) {
  const access = useAdminAccess(allowedRoles);

  useEffect(() => {
    if (!access.isReady) return;
    void load();
  }, [access.isReady, load]);

  return access;
}
