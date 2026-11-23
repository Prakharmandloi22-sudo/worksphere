'use client';

import React from 'react';
import { Navbar } from '../../components/Navbar';
import { Sidebar } from '../../components/Sidebar';
import { TaskBoard } from '../../components/TaskBoard';
import { CheckCircle2 } from 'lucide-react';

export default function MemberPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />
      <div className="flex flex-1">
        <Sidebar />

        <main className="flex-1 p-8 space-y-6 max-w-7xl mx-auto">
          <div className="flex items-center space-x-3 pb-4 border-b border-slate-200">
            <div className="p-2 bg-indigo-100 rounded-lg text-indigo-700">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Team Member Workspace</h1>
              <p className="text-xs text-slate-500">
                Track assigned tasks, collaborate with comments, and test Optimistic Concurrency Control.
              </p>
            </div>
          </div>

          <TaskBoard />
        </main>
      </div>
    </div>
  );
}

