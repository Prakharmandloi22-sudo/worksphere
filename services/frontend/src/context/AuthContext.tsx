'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type UserRole = 'platform_admin' | 'org_owner' | 'project_manager' | 'team_member' | 'auditor';

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isPlatformAdmin: boolean;
}

export interface OrganizationMembership {
  organizationId: string;
  organizationName: string;
  slug: string;
  role: UserRole;
}

interface AuthContextType {
  user: UserProfile | null;
  activeOrg: OrganizationMembership | null;
  token: string | null;
  currentRole: UserRole;
  login: (token: string, user: UserProfile, org: OrganizationMembership) => void;
  logout: () => void;
  switchRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>({
    id: 'demo-user-101',
    email: 'alex.vance@acme.com',
    firstName: 'Alex',
    lastName: 'Vance',
    isPlatformAdmin: true,
  });

  const [activeOrg, setActiveOrg] = useState<OrganizationMembership | null>({
    organizationId: 'demo-org-101',
    organizationName: 'Acme Enterprise Solutions',
    slug: 'acme-corp',
    role: 'org_owner',
  });

  const [token, setToken] = useState<string | null>('demo-jwt-token-placeholder');
  const [currentRole, setCurrentRole] = useState<UserRole>('org_owner');

  const login = (newToken: string, newUser: UserProfile, newOrg: OrganizationMembership) => {
    setToken(newToken);
    setUser(newUser);
    setActiveOrg(newOrg);
    setCurrentRole(newOrg.role);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setActiveOrg(null);
  };

  const switchRole = (newRole: UserRole) => {
    setCurrentRole(newRole);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        activeOrg,
        token,
        currentRole,
        login,
        logout,
        switchRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

