'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as zod from 'zod';
import { Settings, Users, AlertTriangle, Trash2, Plus } from 'lucide-react';
import { useAuthStore } from '../../../../../store/useAuthStore';
import {
  getProjectApi,
  updateProjectApi,
  deleteProjectApi,
  addProjectMemberApi,
  updateProjectMemberRoleApi,
  removeProjectMemberApi,
} from '../../../../../lib/projects-api';
import Input from '../../../../../components/ui/input';
import Button from '../../../../../components/ui/button';
import Spinner from '../../../../../components/ui/spinner';
import Badge from '../../../../../components/ui/badge';
import Avatar from '../../../../../components/ui/avatar';
import Skeleton from '../../../../../components/ui/skeleton';

const projectSchema = zod.object({
  name: zod.string().min(1, 'Project name is required'),
  description: zod.string().optional(),
  color: zod.string().min(1, 'Please select a color'),
});

const inviteSchema = zod.object({
  email: zod.string().email('Please enter a valid email address'),
  role: zod.enum(['ADMIN', 'MEMBER', 'VIEWER']),
});

type ProjectFormValues = zod.infer<typeof projectSchema>;
type InviteFormValues = zod.infer<typeof inviteSchema>;

const PRESET_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6'];

export default function ProjectSettingsPage({ params }: { params: { projectId: string } }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);

  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);

  const { data: projectDetail, isLoading, isError } = useQuery({
    queryKey: ['project', params.projectId],
    queryFn: () => getProjectApi(params.projectId),
    enabled: !!params.projectId,
  });

  // Check if current user is an ADMIN of this project
  const userMembership = projectDetail?.members.find((m) => m.userId === currentUser?.id);
  const isAdmin = userMembership?.role === 'ADMIN';

  const {
    register: registerProject,
    handleSubmit: handleSubmitProject,
    setValue: setProjectValue,
    reset: resetProject,
    formState: { errors: projectErrors },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
  });

  const {
    register: registerInvite,
    handleSubmit: handleSubmitInvite,
    reset: resetInvite,
    formState: { errors: inviteErrors },
  } = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: '',
      role: 'MEMBER',
    },
  });

  useEffect(() => {
    if (projectDetail) {
      resetProject({
        name: projectDetail.name,
        description: projectDetail.description || '',
        color: projectDetail.color,
      });
      setSelectedColor(projectDetail.color);
    }
  }, [projectDetail, resetProject]);

  const updateMutation = useMutation({
    mutationFn: (data: ProjectFormValues) => updateProjectApi(params.projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', params.projectId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteProjectApi(params.projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      router.push('/dashboard');
    },
  });

  const inviteMutation = useMutation({
    mutationFn: (data: InviteFormValues) => addProjectMemberApi(params.projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', params.projectId] });
      resetInvite();
      setInviteError(null);
    },
    onError: (err: any) => {
      setInviteError(err.response?.data?.message || 'Failed to add project member.');
    },
  });

  const roleChangeMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: 'ADMIN' | 'MEMBER' | 'VIEWER' }) =>
      updateProjectMemberRoleApi(params.projectId, memberId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', params.projectId] });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) => removeProjectMemberApi(params.projectId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', params.projectId] });
    },
  });

  const onUpdateProjectSubmit = (data: ProjectFormValues) => {
    updateMutation.mutate(data);
  };

  const onInviteSubmit = (data: InviteFormValues) => {
    inviteMutation.mutate(data);
  };

  const handleColorSelect = (color: string) => {
    if (!isAdmin) return;
    setSelectedColor(color);
    setProjectValue('color', color);
  };

  if (isLoading) {
    return (
      <div className="space-y-10">
        {/* General Settings Skeleton */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center space-x-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <Skeleton className="w-5 h-5 bg-slate-200 dark:bg-slate-800" />
            <Skeleton className="h-5 w-32 bg-slate-200 dark:bg-slate-800" />
          </div>
          <div className="space-y-6 max-w-2xl">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24 bg-slate-200 dark:bg-slate-800" />
              <Skeleton className="h-10 w-full bg-slate-200 dark:bg-slate-800" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24 bg-slate-200 dark:bg-slate-800" />
              <Skeleton className="h-20 w-full bg-slate-200 dark:bg-slate-800" />
            </div>
          </div>
        </div>

        {/* Team Members Skeleton */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center space-x-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <Skeleton className="w-5 h-5 bg-slate-200 dark:bg-slate-800" />
            <Skeleton className="h-5 w-32 bg-slate-200 dark:bg-slate-800" />
          </div>
          <div className="space-y-4">
            <div className="h-12 bg-slate-50 dark:bg-slate-950 rounded-xl flex items-center px-6 justify-between">
              <Skeleton className="h-4 w-1/4 bg-slate-200 dark:bg-slate-800" />
              <Skeleton className="h-4 w-1/6 bg-slate-200 dark:bg-slate-800" />
            </div>
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 flex items-center px-6 justify-between border-b border-slate-100 dark:border-slate-805 last:border-0">
                <div className="flex items-center space-x-3">
                  <Skeleton className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-24 bg-slate-200 dark:bg-slate-800" />
                    <Skeleton className="h-3 w-32 bg-slate-200 dark:bg-slate-800" />
                  </div>
                </div>
                <Skeleton className="h-5 w-16 bg-slate-200 dark:bg-slate-800" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isError || !projectDetail) {
    return (
      <div className="text-center p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl transition-colors duration-200">
        <h3 className="text-lg font-bold text-red-500">Error loading project</h3>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">Make sure you have access to this workspace.</p>
        <Button onClick={() => router.push('/dashboard')} className="mt-4">
          Back to Dashboard
        </Button>
      </div>
    );
  }

  // Non-admins see a clear read-only notice instead of a partially accessible settings page
  if (!isAdmin) {
    return (
      <div className="space-y-6">
        {/* Access Restricted Banner */}
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-6 flex items-start gap-4">
          <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-amber-800 dark:text-amber-300 text-base">Settings — View Only</h3>
            <p className="text-amber-700 dark:text-amber-400 text-sm mt-1 leading-relaxed">
              You are a <span className="font-bold uppercase">{userMembership?.role}</span> in this project.
              Only project <span className="font-bold">Admins</span> can change project settings, manage members, or modify roles.
            </p>
          </div>
        </div>

        {/* Read-only project info */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs space-y-4 transition-colors duration-200">
          <div className="flex items-center space-x-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <Settings className="w-5 h-5 text-slate-400" />
            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200">General Settings</h3>
            <span className="ml-auto text-xs font-semibold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">Read only</span>
          </div>
          <div className="space-y-3 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
            <div className="flex gap-3">
              <span className="font-semibold text-slate-500 dark:text-slate-400 w-28 shrink-0">Name</span>
              <span className="font-medium text-slate-800 dark:text-slate-205">{projectDetail.name}</span>
            </div>
            {projectDetail.description && (
              <div className="flex gap-3">
                <span className="font-semibold text-slate-500 dark:text-slate-400 w-28 shrink-0">Description</span>
                <span className="text-slate-700 dark:text-slate-300">{projectDetail.description}</span>
              </div>
            )}
            <div className="flex gap-3 items-center">
              <span className="font-semibold text-slate-500 dark:text-slate-400 w-28 shrink-0">Accent Color</span>
              <span className="w-5 h-5 rounded-full border border-slate-200 dark:border-slate-800 shadow-xs" style={{ backgroundColor: projectDetail.color }} />
            </div>
          </div>
        </section>

        {/* Read-only team members list */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6 transition-colors duration-200">
          <div className="flex items-center space-x-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <Users className="w-5 h-5 text-slate-400" />
            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-205">Team Members</h3>
            <span className="ml-auto text-xs font-semibold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">Read only</span>
          </div>
          <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-xl">
            <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800">
              <thead className="bg-slate-50 dark:bg-slate-950">
                <tr>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-505 dark:text-slate-400 uppercase tracking-wider">Name & Email</th>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-505 dark:text-slate-400 uppercase tracking-wider">Role</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {projectDetail.members.map((member) => (
                  <tr key={member.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-3.5">
                        <Avatar name={member.user.displayName} src={member.user.avatarUrl} size="sm" />
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {member.user.displayName}
                            {member.userId === currentUser?.id && (
                              <span className="ml-2 text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded-full">You</span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{member.user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge value={member.role} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }
  return (
    <div className="space-y-10">
      {/* General Settings */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-805 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6 transition-colors duration-200">
        <div className="flex items-center space-x-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <Settings className="w-5 h-5 text-slate-500" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">General Settings</h3>
        </div>

        <form onSubmit={handleSubmitProject(onUpdateProjectSubmit)} className="space-y-6 max-w-2xl">
          <Input
            label="Project Name"
            placeholder="e.g. Mobile App Development"
            error={projectErrors.name?.message}
            disabled={!isAdmin}
            {...registerProject('name')}
          />

          <Input
            label="Description"
            placeholder="Describe the purpose of this project..."
            isTextarea
            rows={3}
            error={projectErrors.description?.message}
            disabled={!isAdmin}
            {...registerProject('description')}
          />

          {/* Color Presets */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
              Accent Color
            </label>
            <div className="flex flex-wrap gap-2.5">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => handleColorSelect(color)}
                  className={`w-7 h-7 rounded-full border-2 transition duration-150 transform ${
                    selectedColor === color
                      ? 'border-slate-800 dark:border-white scale-110'
                      : 'border-transparent shadow-xs hover:scale-105'
                  } ${!isAdmin && 'cursor-not-allowed opacity-60'}`}
                  style={{ backgroundColor: color }}
                  disabled={!isAdmin}
                />
              ))}
            </div>
          </div>

          {isAdmin && (
            <div className="flex justify-end pt-4">
              <Button type="submit" isLoading={updateMutation.isPending}>
                Save Changes
              </Button>
            </div>
          )}
        </form>
      </section>

      {/* Team Members List */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-805 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6 transition-colors duration-200">
        <div className="flex items-center space-x-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <Users className="w-5 h-5 text-slate-500" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Team Members</h3>
        </div>

        {/* Invite Member form (Admin Only) */}
        {isAdmin && (
          <form
            onSubmit={handleSubmitInvite(onInviteSubmit)}
            className="p-5 border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 grid gap-4 sm:grid-cols-12 items-end transition-colors"
          >
            <div className="sm:col-span-6">
              <Input
                label="Invite by Email"
                placeholder="developer@example.com"
                error={inviteErrors.email?.message}
                {...registerInvite('email')}
              />
            </div>
            <div className="sm:col-span-3 space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                Project Role
              </label>
              <select
                {...registerInvite('role')}
                className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 focus:border-blue-400 text-sm transition-colors duration-200"
              >
                <option value="MEMBER">Member</option>
                <option value="VIEWER">Viewer</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <div className="sm:col-span-3">
              <Button
                type="submit"
                className="w-full flex items-center justify-center"
                isLoading={inviteMutation.isPending}
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Add Member
              </Button>
            </div>

            {inviteError && (
              <p className="sm:col-span-12 text-xs text-red-500 dark:text-red-400 font-medium">{inviteError}</p>
            )}
          </form>
        )}

        {/* Members List Table */}
        <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-xl">
          <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-950">
              <tr>
                <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Name & Email
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Role
                </th>
                {isAdmin && (
                  <th className="px-6 py-3.5 text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {projectDetail.members.map((member) => (
                <tr key={member.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-3.5">
                      <Avatar name={member.user.displayName} src={member.user.avatarUrl} size="sm" />
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{member.user.displayName}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{member.user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {isAdmin && member.userId !== currentUser?.id ? (
                      <select
                        value={member.role}
                        onChange={(e) =>
                          roleChangeMutation.mutate({
                            memberId: member.id,
                            role: e.target.value as any,
                          })
                        }
                        className="px-2.5 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-400 transition-colors duration-200"
                        disabled={roleChangeMutation.isPending}
                      >
                        <option value="ADMIN" className="dark:bg-slate-900 dark:text-slate-100">Admin</option>
                        <option value="MEMBER" className="dark:bg-slate-900 dark:text-slate-100">Member</option>
                        <option value="VIEWER" className="dark:bg-slate-900 dark:text-slate-100">Viewer</option>
                      </select>
                    ) : (
                      <Badge value={member.role} />
                    )}
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {member.userId !== currentUser?.id && (
                        <button
                          onClick={() => {
                            if (confirm(`Remove ${member.user.displayName} from this project?`)) {
                              removeMemberMutation.mutate(member.id);
                            }
                          }}
                          className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-semibold text-xs"
                          disabled={removeMemberMutation.isPending}
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Delete Project (Admin Only) */}
      {isAdmin && (
        <section className="bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6 transition-colors duration-200">
          <div className="flex items-center space-x-3 border-b border-red-100/50 dark:border-red-900/20 pb-4 text-red-700 dark:text-red-400 animate-pulse-slow">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="text-lg font-bold">Danger Zone</h3>
          </div>

          <div className="space-y-4 max-w-2xl">
            <p className="text-sm text-red-800 dark:text-red-300 leading-relaxed">
              Deleting this project will permanently delete the project record and cascade-delete all related tasks, activities, comments, and member associations. This action cannot be undone.
            </p>

            <div className="space-y-3">
              <label className="text-xs font-bold text-red-800 dark:text-red-400 uppercase tracking-wide block">
                To confirm, type the project name: <span className="font-extrabold italic select-all">{projectDetail.name}</span>
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type project name here"
                className="w-full px-4 py-3 rounded-lg border border-red-200 dark:border-red-900/40 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900/30 text-sm transition-colors duration-200"
              />
            </div>

            <div className="pt-2">
              <Button
                variant="danger"
                className="flex items-center"
                disabled={deleteConfirmText !== projectDetail.name || deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
                isLoading={deleteMutation.isPending}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Project
              </Button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
