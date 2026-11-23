'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth, UserRole } from '../context/AuthContext';
import { Shield, Building, UserCheck } from 'lucide-react';

export function Navbar() {
  const { user, activeOrg, currentRole, switchRole } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-30 px-6 flex items-center justify-between">
      <div className="flex items-center space-x-6">
        <Link href="/" className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
            W
          </div>
          <span className="font-bold text-xl tracking-tight text-slate-900">WorkSphere</span>
        </Link>

        {activeOrg && (
          <div className="hidden sm:flex items-center space-x-2 px-3 py-1 bg-slate-100 rounded-full text-xs font-medium text-slate-700">
            <Building className="w-3.5 h-3.5 text-indigo-500" />
            <span>{activeOrg.organizationName}</span>
            <span className="text-slate-400">|</span>
            <span className="text-indigo-600 uppercase tracking-wider font-semibold">{activeOrg.slug}</span>
          </div>
        )}
      </div>

      <div className="flex items-center space-x-4">
        {/* Role Switcher for Assessment Reviewers */}
        <div className="flex items-center space-x-2 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200">
          <Shield className="w-4 h-4 text-indigo-600" />
          <span className="text-xs font-medium text-indigo-900">Active Role:</span>
          <select
            value={currentRole}
            onChange={(e) => switchRole(e.target.value as UserRole)}
            className="text-xs bg-white border border-indigo-300 rounded px-2 py-0.5 font-semibold text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="platform_admin">Platform Admin</option>
            <option value="org_owner">Organization Owner</option>
            <option value="project_manager">Project Manager</option>
            <option value="team_member">Team Member</option>
            <option value="auditor">Auditor</option>
          </select>
        </div>

        {/* User Info */}
        <div className="flex items-center space-x-3 border-l border-slate-200 pl-4">
          <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-semibold text-xs">
            {user?.firstName?.[0]}
            {user?.lastName?.[0]}
          </div>
          <div className="hidden md:block text-left">
            <p className="text-xs font-semibold text-slate-900">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-[11px] text-slate-500">{user?.email}</p>
          </div>
        </div>
      </div>
    </header>
  );
}

