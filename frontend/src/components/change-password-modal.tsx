'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as zod from 'zod';
import { useRouter } from 'next/navigation';
import Modal from './ui/modal';
import PasswordInput from './ui/password-input';
import { changePasswordApi } from '../lib/auth-api';
import { useAuthStore } from '../store/useAuthStore';
import Spinner from './ui/spinner';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const changePasswordSchema = zod
  .object({
    currentPassword: zod.string().min(1, 'Current password is required'),
    newPassword: zod.string().min(8, 'New password must be at least 8 characters long'),
    confirmNewPassword: zod.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'New passwords do not match',
    path: ['confirmNewPassword'],
  });

type ChangePasswordFormValues = zod.infer<typeof changePasswordSchema>;

export default function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmNewPassword: '',
    },
  });

  const onSubmit = async (data: ChangePasswordFormValues) => {
    setLoading(true);
    setGeneralError(null);
    try {
      await changePasswordApi(data.currentPassword, data.newPassword, data.confirmNewPassword);
      // Close modal
      onClose();
      reset();
      // Logout
      logout();
      // Redirect
      router.push(`/login?message=${encodeURIComponent('Password changed. Please sign in with your new password.')}`);
    } catch (err: any) {
      const msg = err.response?.data?.message;
      const errorMsg = Array.isArray(msg) ? msg[0] : (msg || 'Failed to change password. Please try again.');
      if (errorMsg === 'Current password is incorrect.') {
        setError('currentPassword', {
          type: 'manual',
          message: 'Current password is incorrect.',
        });
      } else {
        setGeneralError(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    reset();
    setGeneralError(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Change Password">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {generalError && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-xs text-red-650 text-center font-medium">
            {generalError}
          </div>
        )}

        <PasswordInput
          label="Current Password"
          {...register('currentPassword')}
          placeholder="••••••••"
          error={errors.currentPassword?.message}
          disabled={loading}
        />

        <PasswordInput
          label="New Password"
          {...register('newPassword')}
          placeholder="••••••••"
          error={errors.newPassword?.message}
          disabled={loading}
        />

        <PasswordInput
          label="Confirm New Password"
          {...register('confirmNewPassword')}
          placeholder="••••••••"
          error={errors.confirmNewPassword?.message}
          disabled={loading}
        />

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 -mx-6 -mb-6 px-6 py-4 bg-slate-50 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="px-4 py-2 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-sm font-semibold transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition flex items-center justify-center min-w-[120px]"
          >
            {loading ? (
              <>
                <Spinner className="w-4 h-4 mr-1.5 animate-spin" />
                Changing...
              </>
            ) : (
              'Change Password'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
