'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as zod from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Modal from '@/components/ui/modal';
import Input from '@/components/ui/input';
import Button from '@/components/ui/button';
import { getProjectApi } from '@/lib/projects-api';
import { createTaskApi, TaskStatus, TaskPriority, uploadTaskImagesApi, getProjectLabelsApi, addLabelToTaskApi } from '@/lib/tasks-api';
import ImageUploader from './image-uploader';
import { useToastStore } from '@/store/useToastStore';

const taskSchema = zod.object({
  title: zod.string().min(2, 'Title must be at least 2 characters long'),
  description: zod.string().optional(),
  priority: zod.enum(['LOW', 'MEDIUM', 'HIGH']),
  assigneeId: zod.string().optional(),
  dueDate: zod.string().optional(),
});

type TaskFormValues = zod.infer<typeof taskSchema>;

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  status: TaskStatus;
}

export default function CreateTaskModal({ isOpen, onClose, projectId, status }: CreateTaskModalProps) {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();
  const [pendingFiles, setPendingFiles] = React.useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [selectedLabelIds, setSelectedLabelIds] = React.useState<string[]>([]);

  const { data: projectDetail } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProjectApi(projectId),
    enabled: isOpen && !!projectId,
  });

  const { data: projectLabels = [] } = useQuery({
    queryKey: ['project-labels', projectId],
    queryFn: () => getProjectLabelsApi(projectId),
    enabled: isOpen && !!projectId,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: '',
      description: '',
      priority: 'MEDIUM',
      assigneeId: '',
      dueDate: '',
    },
  });

  const mutation = useMutation({
    mutationFn: (data: TaskFormValues) =>
      createTaskApi(projectId, {
        ...data,
        status,
      }),
  });

  const onSubmit = async (data: TaskFormValues) => {
    setIsSubmitting(true);
    try {
      const newTask = await mutation.mutateAsync(data);

      if (pendingFiles.length > 0) {
        try {
          const formData = new FormData();
          pendingFiles.forEach((file) => {
            formData.append('images', file);
          });
          await uploadTaskImagesApi(newTask.id, formData);
        } catch (uploadErr) {
          addToast('Task created, but some attachments failed to upload.', 'warning');
        }
      }

      for (const labelId of selectedLabelIds) {
        try {
          await addLabelToTaskApi(newTask.id, labelId);
        } catch (labelErr) {
          addToast('Failed to add some labels to the task.', 'warning');
        }
      }

      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['activities', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-stats', projectId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });

      reset();
      setPendingFiles([]);
      setSelectedLabelIds([]);
      onClose();
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Failed to create task.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isPending = isSubmitting;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Task">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Input
          label="Task Title"
          placeholder="e.g. Implement user login validation"
          error={errors.title?.message}
          {...register('title')}
        />

        <Input
          label="Description"
          placeholder="What needs to be done..."
          isTextarea
          rows={3}
          error={errors.description?.message}
          {...register('description')}
        />

        <div className="grid grid-cols-2 gap-4">
          {/* Priority dropdown */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
              Priority
            </label>
            <select
              {...register('priority')}
              className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 focus:border-blue-400 text-sm transition-colors duration-200"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </div>

          {/* Due date picker */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
              Due Date
            </label>
            <input
              type="date"
              {...register('dueDate')}
              className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 focus:border-blue-400 text-sm transition-colors duration-200"
            />
          </div>
        </div>

        {/* Assignee selection */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
            Assignee
          </label>
          <select
            {...register('assigneeId')}
            className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 focus:border-blue-400 text-sm transition-colors duration-200"
          >
            <option value="" className="dark:bg-slate-900 dark:text-slate-400">Unassigned</option>
            {projectDetail?.members.map((member) => (
              <option key={member.id} value={member.user.id} className="dark:bg-slate-900 dark:text-slate-100">
                {member.user.displayName} ({member.user.email})
              </option>
            ))}
          </select>
        </div>

        {/* Labels Selection */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
            Labels
          </label>
          <div className="flex flex-wrap gap-2 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
            {projectLabels.length > 0 ? (
              projectLabels.map((lbl: any) => (
                <label key={lbl.id} className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2.5 py-1 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                  <input
                    type="checkbox"
                    checked={selectedLabelIds.includes(lbl.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedLabelIds([...selectedLabelIds, lbl.id]);
                      } else {
                        setSelectedLabelIds(selectedLabelIds.filter((id) => id !== lbl.id));
                      }
                    }}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: lbl.color }} />
                  <span className="text-slate-705 dark:text-slate-300">{lbl.name}</span>
                </label>
              ))
            ) : (
              <span className="text-xs text-slate-400 italic">No labels available in this project. Create them in project settings.</span>
            )}
          </div>
        </div>

        {/* Attachments Section */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
            Attachments
          </label>
          <ImageUploader
            isPendingMode
            onFilesChange={setPendingFiles}
          />
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <Button variant="secondary" type="button" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isPending}>
            Create Task
          </Button>
        </div>
      </form>
    </Modal>
  );
}
