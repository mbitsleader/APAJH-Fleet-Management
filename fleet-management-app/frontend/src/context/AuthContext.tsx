'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { apiFetch } from '@/lib/apiFetch';

type Role = 'ADMIN' | 'DIRECTEUR' | 'MANAGER' | 'PROFESSIONNEL';

interface User {
  id: string;
  name: string;
  role: Role;
  email: string;
}

interface AuthContextType {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Check session on mount by calling /api/users/me
    const verifySession = async () => {
      try {
        const res = await apiFetch('/api/users/me');
        if (res.ok) {
          const userData = await res.json();
          setUser(userData);
        } else {
          setUser(null);
          if (pathname !== '/login') router.push('/login');
        }
      } catch (error) {
        console.error('Session verification failed:', error);
        setUser(null);
        if (pathname !== '/login') router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    if (pathname !== '/login') {
      verifySession();
    } else {
      setLoading(false);
    }
  }, [pathname, router]);

  const login = (userData: User) => {
    setUser(userData);
    router.push('/');
  };

  const logout = async () => {
    try {
      await apiFetch('/api/users/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout error:', error);
    }
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
