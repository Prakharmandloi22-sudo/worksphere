'use client';

import React from 'react';
import { Navbar } from '../../components/Navbar';
import { Sidebar } from '../../components/Sidebar';
import { Layers, Calendar, CheckSquare, Clock, Plus } from 'lucide-react';

export default function ManagerPage() {
  const projects = [
    {
      id: 'proj-1',
      name: 'Core Infrastructure Modernization',
      key: 'INFRA',
      progress: 75,
      tasksCount: 24,
      completedCount: 18,
      status: 'active',
      milestones: ['Database Connection Pooling', 'BullMQ Worker Topology', 'FastAPI Integration'],
    },
    {
      id: 'proj-2',
      name: 'Enterprise Security Compliance',
      key: 'SEC',
      progress: 40,
      tasksCount: 15,
      completedCount: 6,
      status: 'active',
      milestones: ['HMAC Webhooks', 'Token Rotation & Family Revocation', 'Audit Trail'],
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />
      <div className="flex flex-1">
        <Sidebar />

        <main className="flex-1 p-8 space-y-6 max-w-7xl mx-auto">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-indigo-100 rounded-lg text-indigo-700">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Project Manager Portal</h1>
                <p className="text-xs text-slate-500">Plan milestones, assign tasks, and track sprint delivery.</p>
              </div>
            </div>

            <button className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-sm transition-colors">
              <Plus className="w-4 h-4" />
              <span>New Project</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {projects.map((p) => (
              <div key={p.id} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded border border-indigo-200">
                      {p.key}
                    </span>
                    <h3 className="font-bold text-base text-slate-900 mt-2">{p.name}</h3>
                  </div>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    {p.status}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-medium text-slate-600">
                    <span>Progress</span>
                    <span>{p.progress}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-600 h-2 rounded-full transition-all"
                      style={{ width: `${p.progress}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400 pt-1">
                    <span>{p.completedCount} / {p.tasksCount} Tasks Completed</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <p className="text-xs font-semibold text-slate-700">Milestones:</p>
                  <ul className="text-xs text-slate-600 space-y-1">
                    {p.milestones.map((m) => (
                      <li key={m} className="flex items-center space-x-2">
                        <CheckSquare className="w-3.5 h-3.5 text-indigo-500" />
                        <span>{m}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

