'use client';

import React from 'react';
import { Activity, ShieldCheck, AlertCircle, TrendingUp } from 'lucide-react';

interface HealthProps {
  score?: number;
  risk?: 'low' | 'medium' | 'high' | 'critical';
  completionRate?: number;
  overdueCount?: number;
}

export function HealthScoreWidget({
  score = 88.5,
  risk = 'low',
  completionRate = 75.0,
  overdueCount = 1,
}: HealthProps) {
  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low':
        return 'text-emerald-700 bg-emerald-50 border-emerald-200';
      case 'medium':
        return 'text-amber-700 bg-amber-50 border-amber-200';
      case 'high':
        return 'text-orange-700 bg-orange-50 border-orange-200';
      default:
        return 'text-rose-700 bg-rose-50 border-rose-200';
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Activity className="w-5 h-5 text-indigo-600" />
          <h3 className="font-bold text-slate-900 text-sm">Delivery Health & Analytics</h3>
        </div>
        <span
          className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${getRiskColor(
            risk
          )}`}
        >
          {risk} risk
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4 pt-2">
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
          <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Health Score</p>
          <p className="text-2xl font-black text-indigo-600 mt-1">{score}<span className="text-xs font-medium text-slate-400">/100</span></p>
        </div>

        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
          <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Completion</p>
          <p className="text-2xl font-black text-slate-800 mt-1">{completionRate}%</p>
        </div>

        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
          <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Overdue Work</p>
          <p className={`text-2xl font-black mt-1 ${overdueCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
            {overdueCount}
          </p>
        </div>
      </div>

      <p className="text-xs text-slate-500 flex items-center space-x-1">
        <TrendingUp className="w-3.5 h-3.5 text-indigo-500 inline mr-1" />
        <span>Powered by WorkSphere FastAPI Analytics Microservice</span>
      </p>
    </div>
  );
}

