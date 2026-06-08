'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as zod from 'zod';
import Link from 'next/link';
import { setNewPasswordApi } from '../../../lib/auth-api';
import Spinner from '../../../components/ui/spinner';
import PasswordInput from '../../../components/ui/password-input';

const resetPasswordSchema = zod
  .object({
    password: zod.string().min(8, 'Password must be at least 8 characters long'),
    confirmPassword: zod.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ResetPasswordFormValues = zod.infer<typeof resetPasswordSchema>;

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      router.replace('/forgot-password');
    }
  }, [token, router]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: ResetPasswordFormValues) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      await setNewPasswordApi(token, data.password);
      setSuccess(true);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
        'This session has expired. Please start over.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 p-8 sm:p-10 flex flex-col items-center justify-center min-h-[300px] transition-colors duration-200">
        <Spinner className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 p-8 sm:p-10 space-y-8 animate-fade-in transition-colors duration-200">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 bg-green-100 dark:bg-green-950/30 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
            Success!
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed text-center">
            Password reset successfully! You can now log in with your new password.
          </p>
        </div>
        <div className="text-center pt-2">
          <Link
            href="/login"
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-200 block text-center text-sm"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 p-8 sm:p-10 space-y-8 animate-fade-in transition-colors duration-200">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
          Set your new password
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-404">
          Please enter and confirm your new password below.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-5">
          <PasswordInput
            label="New Password"
            {...register('password')}
            placeholder="••••••••"
            error={errors.password?.message}
          />

          <PasswordInput
            label="Confirm New Password"
            {...register('confirmPassword')}
            placeholder="••••••••"
            error={errors.confirmPassword?.message}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition duration-200 flex items-center justify-center"
        >
          {loading ? (
            <>
              <Spinner className="w-5 h-5 mr-2 animate-spin" />
              Resetting Password...
            </>
          ) : (
            'Reset Password'
          )}
        </button>
      </form>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 flex flex-col items-center gap-2">
          <p className="text-xs text-red-650 dark:text-red-400 text-center font-medium leading-relaxed">
            {error}
          </p>
          <Link href="/forgot-password" className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline">
            Start over
          </Link>
        </div>
      )}
    </div>
  );
}

import { useEffect } from 'react';

export default function SetNewPasswordPage() {
  return (
    <Suspense fallback={
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 p-8 sm:p-10 flex flex-col items-center justify-center min-h-[300px] transition-colors duration-200">
        <Spinner className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
