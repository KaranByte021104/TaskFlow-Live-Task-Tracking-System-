'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createChannelApi } from '@/lib/chat-api';
import Avatar from '../ui/avatar';
import Spinner, { PureSpinner } from '../ui/spinner';
import { X, Search, Lock, Globe } from 'lucide-react';

interface CreateChannelModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  members: { id: string; displayName: string; email: string; avatarUrl: string | null }[];
}

export default function CreateChannelModal({
  projectId,
  isOpen,
  onClose,
  members,
}: CreateChannelModalProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const createMutation = useMutation({
    mutationFn: () =>
      createChannelApi(projectId, {
        name: name.trim().toLowerCase().replace(/\s+/g, '-'), // Slack-style names
        description: description.trim() || undefined,
        isPrivate,
        memberIds: isPrivate ? selectedMemberIds : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-channels', projectId] });
      onClose();
      // Reset state
      setName('');
      setDescription('');
      setIsPrivate(false);
      setSelectedMemberIds([]);
      setSearchQuery('');
    },
  });

  if (!isOpen) return null;

  const filteredMembers = members.filter(
    (m) =>
      m.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleMember = (userId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col transition duration-150 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/80">
          <h2 className="text-sm font-bold text-slate-800 dark:text-white">Create Channel</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-450 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5.5 h-5.5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto max-h-[75vh]">
          {/* Name */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Channel Name
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-3 text-sm text-slate-400 font-semibold">#</span>
              <input
                type="text"
                placeholder="e.g. marketing-plan"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-7 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-white text-sm focus:outline-none focus:border-blue-500 transition"
              />
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">
              Lowercase letters, numbers, and dashes only.
            </p>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Description (optional)
            </label>
            <textarea
              placeholder="What is this channel about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-white text-sm focus:outline-none focus:border-blue-500 transition resize-none"
            />
          </div>

          {/* Privacy Toggle */}
          <div className="p-4 border border-slate-100 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-950/20 rounded-2xl flex items-center justify-between">
            <div className="flex items-center space-x-3.5 min-w-0">
              {isPrivate ? (
                <Lock className="w-5 h-5 text-amber-500 shrink-0" />
              ) : (
                <Globe className="w-5 h-5 text-emerald-500 shrink-0" />
              )}
              <div className="text-left min-w-0">
                <p className="text-xs font-bold text-slate-800 dark:text-white">
                  {isPrivate ? 'Private Channel' : 'Public Channel'}
                </p>
                <p className="text-[10px] text-slate-450 dark:text-slate-550 mt-0.5 truncate">
                  {isPrivate
                    ? 'Only invited members can view and join'
                    : 'Visible and open to all project members'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsPrivate(!isPrivate)}
              className={`w-11 h-6 rounded-full p-0.5 transition duration-200 focus:outline-none ${
                isPrivate ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-800'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition duration-200 ${
                  isPrivate ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Member Selector if Private */}
          {isPrivate && (
            <div className="space-y-2 animate-in slide-in-from-top-3 duration-200">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  Invite Members ({selectedMemberIds.length} selected)
                </label>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-450 dark:text-slate-550 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search project members..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs placeholder-slate-450 dark:placeholder-slate-550 text-slate-850 dark:text-white focus:outline-none"
                />
              </div>

              {/* Members List */}
              <div className="border border-slate-100 dark:border-slate-800 rounded-xl max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/40 p-1 bg-slate-50/20 dark:bg-slate-950/20">
                {filteredMembers.map((member) => {
                  const isSelected = selectedMemberIds.includes(member.id);
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => toggleMember(member.id)}
                      className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/45 text-left transition"
                    >
                      <div className="flex items-center space-x-2">
                        <Avatar name={member.displayName} src={member.avatarUrl} size="sm" />
                        <div>
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                            {member.displayName}
                          </p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500">
                            {member.email}
                          </p>
                        </div>
                      </div>
                      <div
                        className={`w-4 h-4 rounded-md border flex items-center justify-center transition shrink-0 ${
                          isSelected
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        {isSelected && (
                          <svg
                            className="w-2.5 h-2.5 fill-current"
                            viewBox="0 0 20 20"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path d="M0 11l2-2 5 5L18 3l2 2L7 18z" />
                          </svg>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={createMutation.isPending || !name.trim()}
              className="w-full flex items-center justify-center py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            >
              {createMutation.isPending ? <PureSpinner className="w-5 h-5 text-white" /> : 'Create Channel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
