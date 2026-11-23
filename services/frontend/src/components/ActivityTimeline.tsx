'use client';

import React from 'react';
import { History, User, CheckCircle, Edit3, PlusCircle, Trash2 } from 'lucide-react';

export interface ActivityItem {
  id: string;
  action: string;
  entityType: string;
  author: string;
  timestamp: string;
  diffSummary?: string;
}

export function ActivityTimeline() {
  const activities: ActivityItem[] = [
    {
      id: 'act-1',
      action: 'updated',
      entityType: 'task',
      author: 'Bob Jones',
      timestamp: '10 minutes ago',
      diffSummary: 'Changed status from "todo" → "in_progress" (v2)',
    },
    {
      id: 'act-2',
      action: 'created',
      entityType: 'task',
      author: 'Alice Smith',
      timestamp: '35 minutes ago',
      diffSummary: 'Created task "Implement Optimistic Concurrency Control"',
    },
    {
      id: 'act-3',
      action: 'invited',
      entityType: 'member',
      author: 'Alex Vance',
      timestamp: '2 hours ago',
      diffSummary: 'Invited charlie@acme.com as team_member',
    },
    {
      id: 'act-4',
      action: 'created',
      entityType: 'project',
      author: 'Alex Vance',
      timestamp: 'Yesterday',
      diffSummary: 'Initialized project "Core Infrastructure Modernization" (INFRA)',
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
      <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
        <History className="w-5 h-5 text-indigo-600" />
        <h3 className="font-bold text-slate-900 text-sm">Tenant Activity Ledger (Immutable)</h3>
      </div>

      <div className="space-y-4 relative before:absolute before:inset-0 before:left-3 before:w-0.5 before:bg-slate-200">
        {activities.map((act) => (
          <div key={act.id} className="relative flex items-start space-x-4 pl-8">
            <div className="absolute left-1.5 top-1 w-3.5 h-3.5 rounded-full bg-indigo-600 border-2 border-white shadow-sm"></div>

            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-900">{act.author}</span>
                <span className="text-[11px] text-slate-400">{act.timestamp}</span>
              </div>
              <p className="text-xs text-slate-600 font-mono bg-slate-50 p-2 rounded border border-slate-100">
                {act.diffSummary}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

