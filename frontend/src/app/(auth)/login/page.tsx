'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as zod from 'zod';
import Link from 'next/link';
import { loginApi } from '../../../lib/auth-api';
import { useAuthStore } from '../../../store/useAuthStore';
import { useToastStore } from '../../../store/useToastStore';
import PasswordInput from '../../../components/ui/password-input';
import Spinner from '../../../components/ui/spinner';

const loginSchema = zod.object({
  email: zod.string().email('Please enter a valid email address'),
  password: zod.string().min(1, 'Password is required'),
});

type LoginFormValues = zod.infer<typeof loginSchema>;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((state) => state.setAuth);
  const addToast = useToastStore((state) => state.addToast);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const message = searchParams.get('message');
    if (message) {
      addToast(message, 'success');
      // Clear URL parameter so it doesn't show again on refresh
      router.replace('/login');
    }
  }, [searchParams, addToast, router]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setLoading(true);
    setError(null);
    try {
      const response = await loginApi(data.email, data.password);
      setAuth(response.user, response.accessToken);
      window.location.href = '/dashboard';
    } catch (err: any) {
      setError(
        err.response?.data?.message || 
        'Invalid email or password. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 p-8 sm:p-10 space-y-8 transition-colors duration-200">
      {/* App Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
          Task Tracker
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Sign in to manage your team&apos;s live tasks
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-5">
          {/* Email input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
              Email Address
            </label>
            <input
              type="email"
              {...register('email')}
              placeholder="you@example.com"
              className={`w-full px-4 py-3 rounded-lg border bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:bg-white dark:focus:bg-slate-900 transition duration-200 ${
                errors.email
                  ? 'border-red-300 focus:ring-red-200'
                  : 'border-slate-200 dark:border-slate-800 focus:ring-blue-100 dark:focus:ring-blue-900/30 focus:border-blue-400'
              }`}
            />
            {errors.email && (
              <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>
            )}
          </div>

          {/* Password input */}
          <div>
            <PasswordInput
              label="Password"
              {...register('password')}
              placeholder="••••••••"
              error={errors.password?.message}
            />
            <div className="flex justify-end mt-1.5">
              <Link href="/forgot-password" className="text-xs font-semibold text-blue-600 hover:underline">
                Forgot password?
              </Link>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition duration-200"
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </div>
      </form>

      {/* API Errors */}
      {error && (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40">
          <p className="text-xs text-red-650 text-center font-medium leading-relaxed">
            {error}
          </p>
        </div>
      )}

      {/* Navigation link */}
      <div className="text-center">
        <p className="text-sm text-slate-605 dark:text-slate-400">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="font-semibold text-blue-600 hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 p-8 sm:p-10 flex flex-col items-center justify-center min-h-[300px] transition-colors duration-200">
        <Spinner className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
