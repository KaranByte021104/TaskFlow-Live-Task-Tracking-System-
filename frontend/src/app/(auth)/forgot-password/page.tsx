'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as zod from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { requestOtpApi } from '../../../lib/auth-api';
import Spinner from '../../../components/ui/spinner';

const forgotPasswordSchema = zod.object({
  email: zod.string().email('Please enter a valid email address'),
});

type ForgotPasswordFormValues = zod.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data: ForgotPasswordFormValues) => {
    setLoading(true);
    setError(null);
    try {
      await requestOtpApi(data.email);
      setSubmittedEmail(data.email);
      setSuccess(true);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
        'An error occurred. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleNavigateToVerify = () => {
    router.push(`/verify-otp?email=${encodeURIComponent(submittedEmail)}`);
  };

  if (success) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 p-8 sm:p-10 space-y-8 animate-fade-in transition-colors duration-200">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950/30 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 19v-8.93a2 2 0 01.89-1.664l8-4a2 2 0 011.83 0l8 4A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-2.25-1.5a2 2 0 00-2.25 0l-2.25 1.5" />
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
            Code Sent!
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            If an account exists for that email, a 6-digit code has been sent. It expires in 15 minutes.
          </p>
        </div>
        <div className="space-y-3 pt-2">
          <button
            onClick={handleNavigateToVerify}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-200 block text-center text-sm"
          >
            Enter Code
          </button>
          <div className="text-center pt-2">
            <Link href="/login" className="font-semibold text-slate-500 dark:text-slate-405 hover:text-blue-600 dark:hover:text-blue-400 text-xs">
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 p-8 sm:p-10 space-y-8 transition-colors duration-200">
      {/* App Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
          Forgot password?
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-404">
          We&apos;ll send a 6-digit code to your email
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
        </div>

        {/* Action Button */}
        <div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition duration-200 flex items-center justify-center"
          >
            {loading ? (
              <>
                <Spinner className="w-5 h-5 mr-2 animate-spin" />
                Sending Code...
              </>
            ) : (
              'Send Code'
            )}
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
        <Link href="/login" className="font-semibold text-blue-600 dark:text-blue-400 hover:underline text-sm">
          Back to Login
        </Link>
      </div>
    </div>
  );
}
