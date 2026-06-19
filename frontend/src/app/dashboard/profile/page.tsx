'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as zod from 'zod';
import { Camera, Trash2, ShieldCheck, Mail, User as UserIcon, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';
import { useToastStore } from '../../../store/useToastStore';
import { getProfileApi, updateProfileApi, uploadAvatarApi, deleteAvatarApi } from '../../../lib/profile-api';
import Avatar from '../../../components/ui/avatar';
import Button from '../../../components/ui/button';
import Input from '../../../components/ui/input';

const profileSchema = zod.object({
  name: zod.string().min(2, 'Name must be at least 2 characters long'),
  email: zod.string().email('Please enter a valid email address'),
  notifyByEmail: zod.boolean().optional(),
});

type ProfileFormValues = zod.infer<typeof profileSchema>;

export default function ProfilePage() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const addToast = useToastStore((state) => state.addToast);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.displayName || '',
      email: user?.email || '',
      notifyByEmail: user?.notifyByEmail ?? true,
    },
  });

  // Sync form defaults when user data loads
  useEffect(() => {
    if (user) {
      reset({
        name: user.displayName,
        email: user.email,
        notifyByEmail: user.notifyByEmail ?? true,
      });
    }
  }, [user, reset]);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type & size
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      addToast('Only JPEG, PNG, and WebP images are allowed', 'error');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      addToast('File size must be less than 2 MB', 'error');
      return;
    }

    // Set preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload
    setIsUploading(true);
    try {
      const updatedUser = await uploadAvatarApi(file);
      setUser(updatedUser);
      setAvatarPreview(null);
      addToast('Avatar updated successfully', 'success');
    } catch (err: any) {
      setAvatarPreview(null);
      const msg = err.response?.data?.message || 'Failed to upload avatar';
      addToast(msg, 'error');
    } finally {
      setIsUploading(false);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = async () => {
    if (!confirm('Are you sure you want to remove your profile photo?')) return;

    setIsRemoving(true);
    try {
      const updatedUser = await deleteAvatarApi();
      setUser(updatedUser);
      addToast('Avatar removed successfully', 'success');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to remove avatar';
      addToast(msg, 'error');
    } finally {
      setIsRemoving(false);
    }
  };

  const onSubmit = async (values: ProfileFormValues) => {
    setIsSaving(true);
    setServerError(null);
    try {
      const updatedUser = await updateProfileApi({
        name: values.name,
        email: values.email,
        notifyByEmail: values.notifyByEmail,
      });
      setUser(updatedUser);
      reset({
        name: updatedUser.displayName,
        email: updatedUser.email,
        notifyByEmail: updatedUser.notifyByEmail ?? true,
      });
      addToast('Profile updated successfully', 'success');
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 409) {
        setServerError('Email address is already in use by another account');
      } else {
        setServerError(err.response?.data?.message || 'Failed to update profile');
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="py-6 max-w-2xl mx-auto">
      <div className="space-y-1 mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Profile Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Update your identity details, profile avatar, and account email.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-md shadow-slate-100/50 dark:shadow-none overflow-hidden transition-all duration-300">
        <div className="p-8 space-y-8">
          
          {/* Avatar Section */}
          <div className="flex flex-col items-center space-y-4">
            <div className="relative group">
              <div className="w-28 h-28 rounded-full ring-4 ring-slate-100 dark:ring-slate-800 overflow-hidden relative shadow-inner">
                {isUploading && (
                  <div className="absolute inset-0 bg-slate-950/60 flex items-center justify-center z-10">
                    <Loader2 className="w-8 h-8 animate-spin text-white" />
                  </div>
                )}
                <Avatar
                  name={user.displayName}
                  src={avatarPreview || user.avatarUrl}
                  className="w-full h-full text-3xl"
                />
              </div>
              
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 p-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-md border-2 border-white dark:border-slate-900 transition hover:scale-105 duration-150"
                title="Change Avatar"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept="image/*"
            />

            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
                className="!py-1.5 !px-3.5 text-xs hover:border-slate-300 dark:hover:border-slate-700"
                disabled={isUploading}
              >
                Upload Photo
              </Button>
              {user.avatarUrl && (
                <Button
                  variant="ghost"
                  onClick={handleRemovePhoto}
                  className="!py-1.5 !px-3.5 text-xs text-red-500 hover:text-red-650 hover:bg-red-50 dark:hover:bg-red-950/20"
                  disabled={isRemoving || isUploading}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Remove
                </Button>
              )}
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
              Accepts JPG, PNG, and WebP (Max size: 2 MB)
            </p>
          </div>

          <hr className="border-slate-100 dark:border-slate-800" />

          {/* Details Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {serverError && (
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-xs font-semibold flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                {serverError}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Full Name
              </label>
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Enter your name"
                  className="pl-10"
                  error={errors.name?.message}
                  {...register('name')}
                />
                <UserIcon className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Email Address
              </label>
              <div className="relative">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  className="pl-10"
                  error={errors.email?.message}
                  {...register('email')}
                />
                <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Notification Preferences
              </h3>
              <div className="flex items-center justify-between p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
                <div className="space-y-0.5 pr-4">
                  <label className="text-sm font-semibold text-slate-900 dark:text-white">
                    Email Notifications
                  </label>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Receive email alerts for task assignments, updates, and comments.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    {...register('notifyByEmail')}
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 font-medium">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                Secured settings page
              </div>
              <Button
                type="submit"
                disabled={!isDirty || isSaving}
                isLoading={isSaving}
                className="shadow-sm shadow-blue-500/10 min-w-[120px]"
              >
                Save Changes
              </Button>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
}
