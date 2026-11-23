'use client';

import React, { useState } from 'react';
import { Plus, AlertTriangle, RefreshCw, CheckCircle2, Clock } from 'lucide-react';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignee: string;
  version: number;
}

export function TaskBoard() {
  const [tasks, setTasks] = useState<Task[]>([
    {
      id: 'task-1',
      title: 'PostgreSQL connection pool & retry configuration',
      description: 'Tune max_connections and set statement timeouts to prevent pool exhaustion.',
      status: 'todo',
      priority: 'high',
      assignee: 'Alice Smith',
      version: 1,
    },
    {
      id: 'task-2',
      title: 'Implement Optimistic Concurrency Control with atomic versioning',
      description: 'Add version column, verify concurrency on UPDATE, return 409 Conflict on mismatch.',
      status: 'in_progress',
      priority: 'critical',
      assignee: 'Bob Jones',
      version: 2,
    },
    {
      id: 'task-3',
      title: 'FastAPI streaming activity analytics pipeline',
      description: 'Process 50k events in O(1) memory via generator streaming.',
      status: 'review',
      priority: 'medium',
      assignee: 'Charlie Brown',
      version: 1,
    },
    {
      id: 'task-4',
      title: 'Docker Compose multi-stage containerization',
      description: 'Configure non-root users, healthchecks, and internal networks.',
      status: 'done',
      priority: 'low',
      assignee: 'Diana Prince',
      version: 3,
    },
  ]);

  const [conflictModal, setConflictModal] = useState<{
    isOpen: boolean;
    taskId: string;
    taskTitle: string;
    clientVersion: number;
    serverVersion: number;
  }>({
    isOpen: false,
    taskId: '',
    taskTitle: '',
    clientVersion: 1,
    serverVersion: 2,
  });

  const columns: Array<{ id: Task['status']; title: string; color: string }> = [
    { id: 'todo', title: 'To Do', color: 'border-slate-300' },
    { id: 'in_progress', title: 'In Progress', color: 'border-blue-400' },
    { id: 'review', title: 'Review', color: 'border-amber-400' },
    { id: 'done', title: 'Completed', color: 'border-emerald-400' },
  ];

  // Move task status normally
  const handleMoveStatus = (taskId: string, newStatus: Task['status']) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          return { ...t, status: newStatus, version: t.version + 1 };
        }
        return t;
      })
    );
  };

  // Trigger simulated concurrency conflict (Assessment 15 Capstone)
  const handleSimulateConflict = (task: Task) => {
    setConflictModal({
      isOpen: true,
      taskId: task.id,
      taskTitle: task.title,
      clientVersion: task.version,
      serverVersion: task.version + 1,
    });
  };

  const resolveConflict = (action: 'reload' | 'override') => {
    if (action === 'reload') {
      setTasks((prev) =>
        prev.map((t) => (t.id === conflictModal.taskId ? { ...t, version: conflictModal.serverVersion } : t))
      );
    } else {
      setTasks((prev) =>
        prev.map((t) => (t.id === conflictModal.taskId ? { ...t, version: conflictModal.serverVersion + 1 } : t))
      );
    }
    setConflictModal((prev) => ({ ...prev, isOpen: false }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Sprint Task Board</h2>
          <p className="text-sm text-slate-500">
            Real-time multi-tenant collaboration with Optimistic Concurrency Control (OCC).
          </p>
        </div>

        <button
          onClick={() => {
            const newTask: Task = {
              id: `task-${Date.now()}`,
              title: `New Task #${tasks.length + 1}`,
              description: 'Created via interactive board',
              status: 'todo',
              priority: 'medium',
              assignee: 'Alice Smith',
              version: 1,
            };
            setTasks([...tasks, newTask]);
          }}
          className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Create Task</span>
        </button>
      </div>

      {/* Kanban Columns */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {columns.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.id);

          return (
            <div key={col.id} className="bg-slate-100 rounded-xl p-4 flex flex-col space-y-3 min-h-[500px]">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="font-semibold text-sm text-slate-700">{col.title}</span>
                <span className="bg-white text-slate-600 text-xs font-bold px-2 py-0.5 rounded-full border border-slate-200">
                  {colTasks.length}
                </span>
              </div>

              <div className="space-y-3 flex-1">
                {colTasks.map((task) => (
                  <div
                    key={task.id}
                    className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm hover:shadow transition-shadow space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <span
                        className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${
                          task.priority === 'critical'
                            ? 'bg-rose-100 text-rose-700'
                            : task.priority === 'high'
                            ? 'bg-amber-100 text-amber-700'
                            : task.priority === 'medium'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {task.priority}
                      </span>
                      <span className="text-[11px] font-mono font-semibold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200">
                        v{task.version}
                      </span>
                    </div>

                    <p className="text-sm font-semibold text-slate-900 leading-snug">{task.title}</p>
                    <p className="text-xs text-slate-500 line-clamp-2">{task.description}</p>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <span className="font-medium text-slate-700">{task.assignee}</span>

                      {/* OCC Drill Button */}
                      <button
                        onClick={() => handleSimulateConflict(task)}
                        title="Simulate two users updating this task concurrently to test Assessment 15"
                        className="text-[11px] text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded font-medium transition-colors"
                      >
                        Drill OCC 409
                      </button>
                    </div>

                    {/* Quick Move Bar */}
                    <div className="flex items-center space-x-1 pt-1">
                      {col.id !== 'todo' && (
                        <button
                          onClick={() => handleMoveStatus(task.id, 'todo')}
                          className="text-[10px] text-slate-500 hover:text-indigo-600 px-1.5 py-0.5 bg-slate-50 rounded"
                        >
                          ← Todo
                        </button>
                      )}
                      {col.id !== 'in_progress' && (
                        <button
                          onClick={() => handleMoveStatus(task.id, 'in_progress')}
                          className="text-[10px] text-slate-500 hover:text-indigo-600 px-1.5 py-0.5 bg-slate-50 rounded"
                        >
                          Progress
                        </button>
                      )}
                      {col.id !== 'done' && (
                        <button
                          onClick={() => handleMoveStatus(task.id, 'done')}
                          className="text-[10px] text-slate-500 hover:text-indigo-600 px-1.5 py-0.5 bg-slate-50 rounded"
                        >
                          Done →
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Optimistic Concurrency Control Conflict Resolution Modal */}
      {conflictModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-rose-200">
            <div className="flex items-center space-x-3 text-rose-600">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-bold">409 Concurrency Conflict</h3>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed">
              Another team member updated <strong>"{conflictModal.taskTitle}"</strong> concurrently while you were
              editing.
            </p>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500">Your Base Version:</span>
                <span className="font-bold text-rose-600">v{conflictModal.clientVersion} (Stale)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Current Server Version:</span>
                <span className="font-bold text-emerald-600">v{conflictModal.serverVersion} (Fresh)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Server Status:</span>
                <span className="font-bold text-slate-800">in_progress</span>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              WorkSphere prevented a silent overwrite. Choose how to resolve this collision:
            </p>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => resolveConflict('reload')}
                className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Discard & Reload Server State</span>
              </button>
              <button
                onClick={() => resolveConflict('override')}
                className="flex items-center space-x-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Merge & Bump Version</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

