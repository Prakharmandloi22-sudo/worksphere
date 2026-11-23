'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Layers,
  Kanban,
  FileCheck2,
  Users2,
  Settings,
  Activity,
  ShieldAlert,
} from 'lucide-react';

export function Sidebar() {
  const pathname = usePathname();
  const { currentRole } = useAuth();

  const navItems = [
    { label: 'Workspaces Hub', href: '/', icon: LayoutDashboard },
    { label: 'Tasks & Kanban', href: '/member', icon: Kanban },
    { label: 'Projects & Roadmap', href: '/manager', icon: Layers },
    { label: 'Organization & Team', href: '/owner', icon: Users2 },
    { label: 'Activity & Audit', href: '/auditor', icon: FileCheck2 },
    { label: 'Platform Administration', href: '/admin', icon: ShieldAlert, adminOnly: true },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between py-6 px-4">
      <div className="space-y-6">
        <div>
          <p className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Navigation</p>
          <nav className="mt-2 space-y-1">
            {navItems.map((item) => {
              if (item.adminOnly && currentRole !== 'platform_admin') return null;

              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 font-semibold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="pt-4 border-t border-slate-100">
          <p className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Tenant Context</p>
          <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-xs text-slate-500">Security Isolation</p>
            <p className="text-xs font-semibold text-emerald-700 flex items-center space-x-1 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
              <span>Tenant Boundary Enforced</span>
            </p>
          </div>
        </div>
      </div>

      <div className="p-3 bg-slate-900 rounded-lg text-white">
        <p className="text-xs font-medium text-slate-300">WorkSphere v1.0</p>
        <p className="text-[11px] text-slate-400 mt-0.5">Assessment Capstone Build</p>
      </div>
    </aside>
  );
}

