'use client';

import React, { useState } from 'react';
import { Navbar } from '../../components/Navbar';
import { Sidebar } from '../../components/Sidebar';
import { Users, Mail, Shield, Webhook, CheckCircle2 } from 'lucide-react';

export default function OwnerPage() {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'project_manager' | 'team_member' | 'auditor'>('team_member');
  const [inviteSuccess, setInviteSuccess] = useState(false);

  const [members, setMembers] = useState([
    { name: 'Alex Vance', email: 'alex.vance@acme.com', role: 'org_owner', joined: 'Jan 2026' },
    { name: 'Bob Jones', email: 'bob.jones@acme.com', role: 'project_manager', joined: 'Feb 2026' },
    { name: 'Alice Smith', email: 'alice.smith@acme.com', role: 'team_member', joined: 'Feb 2026' },
    { name: 'Carol Auditor', email: 'carol@audit.com', role: 'auditor', joined: 'Mar 2026' },
  ]);

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;

    setMembers([
      ...members,
      {
        name: inviteEmail.split('@')[0],
        email: inviteEmail,
        role: inviteRole,
        joined: 'Just now',
      },
    ]);
    setInviteEmail('');
    setInviteSuccess(true);
    setTimeout(() => setInviteSuccess(false), 3000);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />
      <div className="flex flex-1">
        <Sidebar />

        <main className="flex-1 p-8 space-y-6 max-w-7xl mx-auto">
          <div className="flex items-center space-x-3 pb-4 border-b border-slate-200">
            <div className="p-2 bg-indigo-100 rounded-lg text-indigo-700">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Organization Owner Portal</h1>
              <p className="text-xs text-slate-500">Manage team members, assign RBAC permissions, and configure webhooks.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Invite Member Form */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
                <Mail className="w-4 h-4 text-indigo-600" />
                <h3>Invite New Member</h3>
              </div>
              <p className="text-xs text-slate-500">
                Dispatches a secure invitation token with specified RBAC role assignment.
              </p>

              {inviteSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Invitation dispatched successfully!</span>
                </div>
              )}

              <form onSubmit={handleInvite} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@acme.com"
                    required
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Role Assignment</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as any)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    <option value="project_manager">Project Manager (Creates & assigns tasks)</option>
                    <option value="team_member">Team Member (Edits assigned work)</option>
                    <option value="auditor">Auditor (Read-only compliance)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs py-2.5 rounded-lg shadow-sm transition-colors"
                >
                  Send Invitation
                </button>
              </form>
            </div>

            {/* Team Members List */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between">
              <div>
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-900">Current Organization Members</h3>
                  <span className="text-xs text-slate-400 font-medium">{members.length} members</span>
                </div>

                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                    <tr>
                      <th className="py-3 px-4">Member</th>
                      <th className="py-3 px-4">Email</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {members.map((m) => (
                      <tr key={m.email}>
                        <td className="py-3 px-4 font-semibold text-slate-900">{m.name}</td>
                        <td className="py-3 px-4 text-slate-500">{m.email}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              m.role === 'org_owner'
                                ? 'bg-purple-100 text-purple-700'
                                : m.role === 'project_manager'
                                ? 'bg-indigo-100 text-indigo-700'
                                : m.role === 'auditor'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {m.role}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400">{m.joined}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
