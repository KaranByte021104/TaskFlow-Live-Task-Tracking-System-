'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Channel,
  updateChannelApi,
  archiveChannelApi,
  unarchiveChannelApi,
  listChannelMembersApi,
  addChannelMembersApi,
  removeChannelMemberApi,
  UserSummary,
} from '@/lib/chat-api';
import Avatar from '../ui/avatar';
import Spinner from '../ui/spinner';
import { X, Search, Trash2, UserPlus, Archive, Settings, Users } from 'lucide-react';

interface ChannelSettingsModalProps {
  channel: Channel;
  isOpen: boolean;
  onClose: () => void;
  isPrivileged: boolean; // whether requester is Admin or Manager
  currentUserId: string;
  projectMembers: { id: string; displayName: string; email: string; avatarUrl: string | null }[];
}

export default function ChannelSettingsModal({
  channel,
  isOpen,
  onClose,
  isPrivileged,
  currentUserId,
  projectMembers,
}: ChannelSettingsModalProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(channel.name);
  const [description, setDescription] = useState(channel.description || '');
  const [activeTab, setActiveTab] = useState<'info' | 'members'>('info');
  const [memberSearch, setMemberSearch] = useState('');
  const [showAddMember, setShowAddMember] = useState(false);
  const [addSearch, setAddSearch] = useState('');

  // Update form inputs when channel changes
  useEffect(() => {
    setName(channel.name);
    setDescription(channel.description || '');
    setActiveTab('info');
    setShowAddMember(false);
  }, [channel]);

  // Fetch current members of private channel
  const { data: members = [], isLoading: isMembersLoading } = useQuery({
    queryKey: ['channel-members', channel.id],
    queryFn: () => listChannelMembersApi(channel.id),
    enabled: isOpen && channel.isPrivate,
  });

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: () => updateChannelApi(channel.id, { name, description }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-channels', channel.projectId] });
      queryClient.invalidateQueries({ queryKey: ['channel', channel.id] });
      alert('Channel settings updated successfully!');
    },
  });

  // Archive Mutation
  const archiveMutation = useMutation({
    mutationFn: () => archiveChannelApi(channel.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-channels', channel.projectId] });
      onClose();
      alert('Channel archived successfully!');
    },
  });

  // Unarchive Mutation
  const unarchiveMutation = useMutation({
    mutationFn: () => unarchiveChannelApi(channel.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-channels', channel.projectId] });
      onClose();
      alert('Channel unarchived successfully!');
    },
  });

  // Add Member Mutation
  const addMembersMutation = useMutation({
    mutationFn: (memberIds: string[]) => addChannelMembersApi(channel.id, memberIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channel-members', channel.id] });
      setShowAddMember(false);
      setAddSearch('');
    },
  });

  // Remove Member Mutation
  const removeMemberMutation = useMutation({
    mutationFn: (targetUserId: string) => removeChannelMemberApi(channel.id, targetUserId),
    onSuccess: (_, targetUserId) => {
      queryClient.invalidateQueries({ queryKey: ['channel-members', channel.id] });
      if (targetUserId === currentUserId) {
        onClose(); // Close settings if user left the channel
      }
    },
  });

  if (!isOpen) return null;

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (channel.isGeneral || !isPrivileged) return;
    updateMutation.mutate();
  };

  const handleArchive = () => {
    if (confirm('Are you sure you want to archive this channel? This makes it read-only for everyone.')) {
      archiveMutation.mutate();
    }
  };

  const handleUnarchive = () => {
    if (confirm('Are you sure you want to unarchive this channel? This will restore messaging capabilities.')) {
      unarchiveMutation.mutate();
    }
  };

  // Filter candidates to add (project members not already in the private channel)
  const addCandidates = projectMembers.filter(
    (pm) =>
      !members.some((m) => m.id === pm.id) &&
      (pm.displayName.toLowerCase().includes(addSearch.toLowerCase()) ||
        pm.email.toLowerCase().includes(addSearch.toLowerCase()))
  );

  const filteredChannelMembers = members.filter(
    (m) =>
      m.displayName.toLowerCase().includes(memberSearch.toLowerCase()) ||
      m.email.toLowerCase().includes(memberSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col transition duration-150 animate-in zoom-in-95 duration-200 h-[600px] max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/80">
          <div>
            <h2 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
              <Settings className="w-4 h-4 text-slate-500" />
              Channel Settings
            </h2>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
              # {channel.name} {channel.isPrivate && '• Private'} {channel.isGeneral && '• General'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-450 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5.5 h-5.5" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-slate-150 dark:border-slate-800/85 px-4 bg-slate-50/20 dark:bg-slate-900/30">
          <button
            onClick={() => setActiveTab('info')}
            className={`px-4 py-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'info'
                ? 'border-blue-500 text-blue-600 dark:text-blue-450'
                : 'border-transparent text-slate-500 hover:text-slate-850 dark:hover:text-white'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            General Info
          </button>
          {channel.isPrivate && (
            <button
              onClick={() => setActiveTab('members')}
              className={`px-4 py-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
                activeTab === 'members'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-450'
                  : 'border-transparent text-slate-500 hover:text-slate-850 dark:hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Members ({members.length})
            </button>
          )}
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'info' ? (
            <form onSubmit={handleUpdate} className="space-y-5 h-full flex flex-col justify-between">
              <div className="space-y-4">
                {/* Name field */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    Channel Name
                  </label>
                  <input
                    type="text"
                    required
                    disabled={channel.isGeneral || !isPrivileged}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-white text-sm focus:outline-none focus:border-blue-500 transition disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  {channel.isGeneral && (
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 italic">
                      The general channel cannot be renamed.
                    </p>
                  )}
                </div>

                {/* Description field */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    Description
                  </label>
                  <textarea
                    disabled={!isPrivileged}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder="Enter channel description..."
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-white text-sm focus:outline-none focus:border-blue-500 transition resize-none disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Action buttons at bottom */}
              <div className="space-y-3 pt-6 border-t border-slate-100 dark:border-slate-800 mt-auto">
                {isPrivileged && !channel.isGeneral && (
                  <button
                    type="submit"
                    disabled={updateMutation.isPending}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition shadow-sm disabled:opacity-50"
                  >
                    Save Changes
                  </button>
                )}

                {isPrivileged && !channel.isGeneral && !channel.isArchived && (
                  <button
                    type="button"
                    onClick={handleArchive}
                    disabled={archiveMutation.isPending}
                    className="w-full py-2 border border-red-200 dark:border-red-950 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5"
                  >
                    <Archive className="w-4 h-4" />
                    Archive Channel (Read-Only)
                  </button>
                )}

                {isPrivileged && !channel.isGeneral && channel.isArchived && (
                  <button
                    type="button"
                    onClick={handleUnarchive}
                    disabled={unarchiveMutation.isPending}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Archive className="w-4 h-4" />
                    Unarchive Channel
                  </button>
                )}
              </div>
            </form>
          ) : (
            <div className="space-y-4 h-full flex flex-col">
              {/* Member list and controls */}
              <div className="flex items-center justify-between gap-3">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-450 dark:text-slate-550 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search channel members..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs placeholder-slate-450 dark:placeholder-slate-550 text-slate-850 dark:text-white focus:outline-none"
                  />
                </div>

                {isPrivileged && !channel.isArchived && (
                  <button
                    onClick={() => setShowAddMember(true)}
                    className="py-2 px-3 bg-blue-50 dark:bg-blue-950/30 text-blue-650 dark:text-blue-450 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-xs font-bold rounded-xl transition flex items-center gap-1 shrink-0"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Invite
                  </button>
                )}
              </div>

              {/* Members Scroll list */}
              <div className="flex-1 min-h-0 border border-slate-100 dark:border-slate-800 rounded-2xl overflow-y-auto bg-slate-50/20 dark:bg-slate-950/20 p-2 divide-y divide-slate-100 dark:divide-slate-800/40">
                {isMembersLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Spinner />
                  </div>
                ) : filteredChannelMembers.length === 0 ? (
                  <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-8">
                    No members match search
                  </p>
                ) : (
                  filteredChannelMembers.map((member) => {
                    const isSelf = member.id === currentUserId;
                    const canRemove = isPrivileged && !isSelf && !channel.isArchived;

                    return (
                      <div key={member.id} className="flex items-center justify-between p-2 rounded-xl transition hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                        <div className="flex items-center space-x-2.5">
                          <Avatar name={member.displayName} src={member.avatarUrl} size="sm" />
                          <div>
                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                              {member.displayName} {isSelf && '(You)'}
                            </p>
                            <p className="text-[10px] text-slate-450 dark:text-slate-500">
                              {member.email}
                            </p>
                          </div>
                        </div>

                        {/* Kick member / Leave buttons */}
                        {canRemove ? (
                          <button
                            onClick={() => removeMemberMutation.mutate(member.id)}
                            disabled={removeMemberMutation.isPending}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition shrink-0"
                            title="Remove from channel"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : isSelf && !channel.isArchived ? (
                          <button
                            onClick={() => removeMemberMutation.mutate(member.id)}
                            disabled={removeMemberMutation.isPending}
                            className="py-1 px-2 text-[10px] text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 border border-red-200 dark:border-red-950 font-bold rounded-lg transition"
                          >
                            Leave
                          </button>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Invite Member Popover Modal */}
      {showAddMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col h-[400px] animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/80">
              <h3 className="text-xs font-bold text-slate-800 dark:text-white">Invite Project Members</h3>
              <button
                onClick={() => setShowAddMember(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Candidate Search */}
            <div className="p-3 border-b border-slate-100 dark:border-slate-800">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search project members..."
                  value={addSearch}
                  onChange={(e) => setAddSearch(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs placeholder-slate-450 dark:placeholder-slate-550 text-slate-805 dark:text-white focus:outline-none"
                />
              </div>
            </div>

            {/* Candidate List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-slate-50/10 dark:bg-slate-950/10">
              {addCandidates.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-10">
                  No other members found to invite
                </p>
              ) : (
                addCandidates.map((cand) => (
                  <button
                    key={cand.id}
                    onClick={() => addMembersMutation.mutate([cand.id])}
                    disabled={addMembersMutation.isPending}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 text-left transition"
                  >
                    <div className="flex items-center space-x-2.5">
                      <Avatar name={cand.displayName} src={cand.avatarUrl} size="sm" />
                      <div>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {cand.displayName}
                        </p>
                        <p className="text-[10px] text-slate-450 dark:text-slate-550">
                          {cand.email}
                        </p>
                      </div>
                    </div>
                    <div className="py-1 px-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-[10px] transition">
                      Add
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
