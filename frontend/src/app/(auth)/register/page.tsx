'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as zod from 'zod';
import Link from 'next/link';
import { registerApi } from '../../../lib/auth-api';
import { useAuthStore } from '../../../store/useAuthStore';
import PasswordInput from '../../../components/ui/password-input';

const registerSchema = zod
  .object({
    name: zod.string().min(2, 'Name must be at least 2 characters long'),
    email: zod.string().email('Please enter a valid email address'),
    password: zod.string().min(8, 'Password must be at least 8 characters long'),
    confirmPassword: zod.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type RegisterFormValues = zod.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: RegisterFormValues) => {
    setLoading(true);
    setError(null);
    try {
      const response = await registerApi(data.name, data.email, data.password);
      setAuth(response.user, response.accessToken);
      window.location.href = '/dashboard';
    } catch (err: any) {
      setError(
        err.response?.data?.message || 
        'Registration failed. Please try again with a different email.'
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
          Create Account
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Sign up to collaborate in real-time
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-5">
          {/* Full Name input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
              Full Name
            </label>
            <input
              type="text"
              {...register('name')}
              placeholder="John Doe"
              className={`w-full px-4 py-3 rounded-lg border bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:bg-white dark:focus:bg-slate-900 transition duration-200 ${
                errors.name
                  ? 'border-red-300 focus:ring-red-200'
                  : 'border-slate-200 dark:border-slate-800 focus:ring-blue-100 dark:focus:ring-blue-900/30 focus:border-blue-400'
              }`}
            />
            {errors.name && (
              <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>
            )}
          </div>

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
          <PasswordInput
            label="Password"
            {...register('password')}
            placeholder="••••••••"
            error={errors.password?.message}
          />
          <p className="text-xs text-slate-400 dark:text-slate-500 -mt-3">Must be at least 8 characters long</p>

          {/* Confirm Password input */}
          <PasswordInput
            label="Confirm Password"
            {...register('confirmPassword')}
            placeholder="••••••••"
            error={errors.confirmPassword?.message}
          />
        </div>

        {/* Action Button */}
        <div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition duration-200"
          >
            {loading ? 'Registering...' : 'Register'}
          </button>
        </div>
      </form>

      {/* API Errors */}
      {error && (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40">
          <p className="text-xs text-red-650 dark:text-red-400 text-center font-medium leading-relaxed">
            {error}
          </p>
        </div>
      )}

      {/* Navigation link */}
      <div className="text-center">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
