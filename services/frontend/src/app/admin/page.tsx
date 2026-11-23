'use client';

import React from 'react';
import { Navbar } from '../../components/Navbar';
import { Sidebar } from '../../components/Sidebar';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert, Building2, Server, CheckCircle, Database } from 'lucide-react';

export default function AdminPage() {
  const { currentRole } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />
      <div className="flex flex-1">
        <Sidebar />

        <main className="flex-1 p-8 space-y-6 max-w-7xl mx-auto">
          <div className="flex items-center space-x-3 pb-4 border-b border-slate-200">
            <div className="p-2 bg-indigo-100 rounded-lg text-indigo-700">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Platform Administrator Portal</h1>
              <p className="text-xs text-slate-500">Cross-tenant infrastructure, tenant telemetry, and global settings.</p>
            </div>
          </div>

          {currentRole !== 'platform_admin' && (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-800 text-xs flex items-center justify-between">
              <span>Notice: You are previewing the Platform Admin view with role '{currentRole}'. Use the role selector in the navbar to switch.</span>
            </div>
          )}

          {/* Infrastructure Health Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Total Tenants</span>
                <Building2 className="w-4 h-4 text-indigo-600" />
              </div>
              <p className="text-2xl font-black text-slate-900">142</p>
              <span className="text-[10px] text-emerald-600 font-semibold">100% active, 0 suspended</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>PostgreSQL DB Pool</span>
                <Database className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-black text-slate-900">18 / 20</p>
              <span className="text-[10px] text-emerald-600 font-semibold">Healthy (avg latency 3.4ms)</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Redis Queue (BullMQ)</span>
                <Server className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-2xl font-black text-slate-900">0 DLQ</p>
              <span className="text-[10px] text-slate-500">Jobs: 1,489 completed / hr</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>FastAPI Microservice</span>
                <CheckCircle className="w-4 h-4 text-indigo-600" />
              </div>
              <p className="text-2xl font-black text-slate-900">99.98%</p>
              <span className="text-[10px] text-emerald-600 font-semibold">Liveness OK, 10.4k events/s</span>
            </div>
          </div>

          {/* Tenants Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900">Registered Organizations</h3>
              <span className="text-xs text-slate-400">Strictly Isolated Schemas & Tenants</span>
            </div>

            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                <tr>
                  <th className="py-3 px-4">Organization Name</th>
                  <th className="py-3 px-4">Slug</th>
                  <th className="py-3 px-4">Plan</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Isolation Mode</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                <tr>
                  <td className="py-3 px-4 font-semibold text-slate-900">Acme Enterprise Solutions</td>
                  <td className="py-3 px-4 text-indigo-600 font-mono">acme-corp</td>
                  <td className="py-3 px-4">Enterprise</td>
                  <td className="py-3 px-4"><span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px]">Active</span></td>
                  <td className="py-3 px-4 font-mono text-[11px]">organization_id scoped</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold text-slate-900">Globex International</td>
                  <td className="py-3 px-4 text-indigo-600 font-mono">globex-intl</td>
                  <td className="py-3 px-4">Professional</td>
                  <td className="py-3 px-4"><span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px]">Active</span></td>
                  <td className="py-3 px-4 font-mono text-[11px]">organization_id scoped</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold text-slate-900">Stark Industries</td>
                  <td className="py-3 px-4 text-indigo-600 font-mono">stark-ind</td>
                  <td className="py-3 px-4">Enterprise</td>
                  <td className="py-3 px-4"><span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px]">Active</span></td>
                  <td className="py-3 px-4 font-mono text-[11px]">organization_id scoped</td>
                </tr>
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}

