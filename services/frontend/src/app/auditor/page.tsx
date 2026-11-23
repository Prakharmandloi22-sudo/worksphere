'use client';

import React from 'react';
import { Navbar } from '../../components/Navbar';
import { Sidebar } from '../../components/Sidebar';
import { ActivityTimeline } from '../../components/ActivityTimeline';
import { FileCheck, Shield, Lock, Download } from 'lucide-react';

export default function AuditorPage() {
  const auditLogs = [
    {
      id: 'aud-101',
      event: 'user.login_attempt',
      actor: 'alex.vance@acme.com',
      ip: '192.168.1.45',
      status: 'SUCCESS',
      timestamp: '2026-11-23T15:30:12Z',
    },
    {
      id: 'aud-102',
      event: 'task.concurrency_conflict_detected',
      actor: 'bob.jones@acme.com',
      ip: '192.168.1.88',
      status: 'REJECTED_409',
      timestamp: '2026-11-23T15:24:05Z',
    },
    {
      id: 'aud-103',
      event: 'member.role_assigned',
      actor: 'alex.vance@acme.com',
      ip: '192.168.1.45',
      status: 'SUCCESS',
      timestamp: '2026-11-23T14:10:45Z',
    },
    {
      id: 'aud-104',
      event: 'cross_tenant_access_blocked',
      actor: 'user_foreign@beta.com',
      ip: '10.0.0.12',
      status: 'BLOCKED_403',
      timestamp: '2026-11-23T12:00:19Z',
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
                <FileCheck className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Compliance & Auditor Portal</h1>
                <p className="text-xs text-slate-500">
                  Read-only verifiable audit logs, security events, and tenant access verification.
                </p>
              </div>
            </div>

            <button className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-sm transition-colors">
              <Download className="w-4 h-4" />
              <span>Export Audit Trail (CSV)</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900">Security & Access Audit Logs</h3>
                <span className="text-xs text-emerald-600 font-semibold flex items-center space-x-1">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Immutable WORM Storage</span>
                </span>
              </div>

              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                  <tr>
                    <th className="py-3 px-4">Event Type</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4">IP Address</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Timestamp (UTC)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="py-3 px-4 font-semibold text-slate-900">{log.event}</td>
                      <td className="py-3 px-4 text-slate-500">{log.actor}</td>
                      <td className="py-3 px-4 text-slate-500">{log.ip}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                            log.status === 'SUCCESS'
                              ? 'bg-emerald-100 text-emerald-700'
                              : log.status === 'REJECTED_409'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-[11px]">{log.timestamp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <ActivityTimeline />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

