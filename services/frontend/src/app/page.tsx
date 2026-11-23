'use client';

import React from 'react';
import Link from 'next/link';
import { Navbar } from '../components/Navbar';
import { Sidebar } from '../components/Sidebar';
import { HealthScoreWidget } from '../components/HealthScoreWidget';
import { TaskBoard } from '../components/TaskBoard';
import { ActivityTimeline } from '../components/ActivityTimeline';
import { useAuth } from '../context/AuthContext';
import { ArrowRight, Layers, Users, Shield, Zap } from 'lucide-react';

export default function HomePage() {
  const { currentRole, activeOrg } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      <div className="flex flex-1">
        <Sidebar />

        <main className="flex-1 p-8 space-y-8 max-w-7xl mx-auto">
          {/* Welcome Banner */}
          <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-2xl p-6 text-white shadow-md flex items-center justify-between">
            <div className="space-y-2">
              <span className="text-xs uppercase font-bold tracking-wider px-2.5 py-1 bg-indigo-500/30 rounded-full text-indigo-200 border border-indigo-400/30">
                Multi-Tenant SaaS Platform
              </span>
              <h1 className="text-2xl font-black tracking-tight">WorkSphere Command Center</h1>
              <p className="text-sm text-indigo-200 max-w-xl">
                Active Organization: <strong>{activeOrg?.organizationName}</strong>. Current Role View:{' '}
                <span className="underline decoration-indigo-400 font-semibold">{currentRole}</span>.
              </p>
            </div>

            <div className="hidden lg:flex items-center space-x-3">
              <Link
                href="/member"
                className="bg-white text-indigo-900 hover:bg-indigo-50 px-4 py-2 rounded-lg text-sm font-bold shadow transition-all flex items-center space-x-1"
              >
                <span>Open Kanban</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <HealthScoreWidget score={91.2} risk="low" completionRate={82.0} overdueCount={1} />
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
              <div className="flex items-center space-x-2 text-indigo-600 font-bold text-sm">
                <Zap className="w-4 h-4" />
                <h3>Platform Capabilities</h3>
              </div>
              <ul className="text-xs text-slate-600 space-y-2 font-medium">
                <li className="flex items-center space-x-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>Optimistic Concurrency Control (OCC 409 Conflict)</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>Record-Level Multi-Tenant Data Isolation</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>Idempotent Job Queues & DLQ Handling</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>HMAC-SHA256 Webhook Verification</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>O(1) Streaming Python Activity Analytics</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Interactive Task Board */}
          <TaskBoard />

          {/* Activity Ledger */}
          <ActivityTimeline />
        </main>
      </div>
    </div>
  );
}

