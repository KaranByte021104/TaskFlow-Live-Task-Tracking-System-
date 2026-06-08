'use client';

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as zod from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Modal from './ui/modal';
import Input from './ui/input';
import Button from './ui/button';
import { createProjectApi, updateProjectApi, Project } from '../lib/projects-api';

const projectSchema = zod.object({
  name: zod.string().min(1, 'Project name is required'),
  description: zod.string().optional(),
  color: zod.string().min(1, 'Please select a color'),
});

type ProjectFormValues = zod.infer<typeof projectSchema>;

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project?: Project | null; // If passed, we are in Edit mode
}

const PRESET_COLORS = [
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#14b8a6', // Teal
];

export default function ProjectModal({ isOpen, onClose, project }: ProjectModalProps) {
  const queryClient = useQueryClient();
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: '',
      description: '',
      color: PRESET_COLORS[0],
    },
  });

  // Reset/Prefill form values when open state or project changes
  useEffect(() => {
    if (isOpen) {
      if (project) {
        reset({
          name: project.name,
          description: project.description || '',
          color: project.color,
        });
        setSelectedColor(project.color);
      } else {
        reset({
          name: '',
          description: '',
          color: PRESET_COLORS[0],
        });
        setSelectedColor(PRESET_COLORS[0]);
      }
    }
  }, [isOpen, project, reset]);

  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
    setValue('color', color);
  };

  const createMutation = useMutation({
    mutationFn: createProjectApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProjectFormValues }) =>
      updateProjectApi(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', project?.id] });
      onClose();
    },
  });

  const onSubmit = (data: ProjectFormValues) => {
    if (project) {
      updateMutation.mutate({ id: project.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={project ? 'Edit Project Settings' : 'Create New Project'}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Input
          label="Project Name"
          placeholder="e.g. Website Redesign"
          error={errors.name?.message}
          {...register('name')}
        />

        <Input
          label="Description"
          placeholder="Short summary of this project..."
          isTextarea
          rows={3}
          error={errors.description?.message}
          {...register('description')}
        />

        {/* Color presets selection */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
            Accent Color
          </label>
          <div className="flex flex-wrap gap-3">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => handleColorSelect(color)}
                className={`w-8 h-8 rounded-full border-2 transition duration-150 transform hover:scale-110 focus:outline-none ${
                  selectedColor === color ? 'border-slate-800 dark:border-white scale-110' : 'border-transparent shadow-sm'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          {errors.color && <p className="text-xs text-red-500">{errors.color.message}</p>}
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <Button variant="secondary" type="button" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isPending}>
            {project ? 'Save Changes' : 'Create Project'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
