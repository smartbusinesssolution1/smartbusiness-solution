import React, { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import dayjs from 'dayjs';
import {
  User as UserIcon,
  Mail,
  Phone,
  Briefcase,
  Calendar,
  Save,
  Camera,
  ShieldCheck,
  Building2,
  BadgeCheck,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Lock,
  X,
  RotateCcw,
} from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { User } from '../../types';
import { setSessionUser, getUsers, saveUsers } from '../../services/mockDb';
import { clockInApi, platformAuthApi } from '../../services/apiClient';
import { getAvatarUrl } from '../../utils/imageUrl';
import { cn } from '../../lib/utils';
import {
  Button,
  Card,
  Badge,
  Label,
  Separator,
  Tooltip,
} from '../../components/ui';

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Full name must be at least 2 characters'),
  phone: z.string().trim().min(5, 'Phone number must be at least 5 digits'),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export const AdminProfile: React.FC = () => {
  const { user, currentTenant, updateCurrentUserState } = useAuth();

  const [isUpdating, setIsUpdating] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(user?.avatarUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Toast feedback state
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const showToast = (message: string, severity: 'success' | 'error' = 'success') => {
    setToast({ open: true, message, severity });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, open: false }));
    }, 4500);
  };

  // Allow only super admin and admin to update their profile picture
  const canUpdateAvatar =
    user?.role === 'admin' ||
    currentTenant?.role === 'OWNER' ||
    currentTenant?.role === 'ADMIN';

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || '',
      phone: user?.phone || '',
    },
  });

  // Keep form in sync when user loads or updates
  useEffect(() => {
    if (user) {
      reset({
        name: user.name || '',
        phone: user.phone || '',
      });
      setAvatarPreview(user.avatarUrl);
    }
  }, [user, reset]);

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please upload a valid image file (PNG, JPG, WebP).', 'error');
      return;
    }

    // 5MB limit
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image size should be less than 5MB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setAvatarPreview(result);
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = async (data: ProfileFormValues) => {
    if (!user) return;
    setIsUpdating(true);

    try {
      // 1. Persist Name to central platform-api (PostgreSQL users table)
      try {
        await clockInApi.patch('/api/v1/auth/profile', {
          fullName: data.name,
        });
      } catch {
        await platformAuthApi
          .patch('/api/v1/auth/profile', {
            fullName: data.name,
          })
          .catch(() => {});
      }

      // 2. Persist Profile Picture to Clock-In backend if changed and privileged
      if (canUpdateAvatar && avatarPreview && avatarPreview !== user.avatarUrl) {
        await clockInApi
          .patch('/api/v1/employees/me', {
            biometricPhotoUrl: avatarPreview,
          })
          .catch((err) => console.warn('Could not persist avatar to employee record:', err));
      }

      // 3. Update local session & mockDb
      const dbUsers = getUsers();
      const index = dbUsers.findIndex(
        (u) => u.id === user.id || u.email.toLowerCase() === user.email.toLowerCase()
      );

      const updated: User = {
        ...(index !== -1 ? dbUsers[index] : user),
        ...user,
        name: data.name,
        phone: data.phone,
        avatarUrl:
          canUpdateAvatar && avatarPreview
            ? avatarPreview
            : index !== -1
            ? dbUsers[index].avatarUrl
            : user.avatarUrl,
      };

      if (index !== -1) {
        dbUsers[index] = updated;
      } else {
        dbUsers.push(updated);
      }

      saveUsers(dbUsers);
      setSessionUser(updated);
      updateCurrentUserState(updated);
      if (user?.id && (avatarPreview || updated.avatarUrl)) {
        localStorage.setItem(`avatar_uploaded_${user.id}`, 'true');
      }

      showToast('Administrator details updated and saved successfully!', 'success');
    } catch (err: any) {
      console.error('Failed to update admin profile:', err);
      showToast(
        err?.response?.data?.error?.message || err?.message || 'Failed to update admin profile.',
        'error'
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const displayAvatar = avatarPreview || user?.avatarUrl;

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
      {/* ── 1. Page Header ── */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="eyebrow">ACCOUNT IDENTITY & GOVERNANCE</span>
            <div className="flex items-center gap-3">
              <h1 className="text-[1.625rem] sm:text-[1.75rem] font-semibold tracking-[-0.02em] leading-tight text-ink">
                Admin Profile
              </h1>
              <Badge variant="brand" className="gap-1 font-mono text-[0.6875rem]">
                <ShieldCheck className="size-3 text-primary-600" />
                <span>System Administrator</span>
              </Badge>
            </div>
            <p className="max-w-2xl text-sm leading-relaxed text-muted">
              Review your official administrative credentials, update corporate contact details, and manage biometric identity.
            </p>
          </div>
        </div>
      </div>

      {/* ── 2. Two-Column Layout ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* Left Column (4 cols): Photo, Name & Read-Only Specs */}
        <div className="flex flex-col gap-5 lg:col-span-4">
          {/* Identity Card */}
          <Card className="p-6 flex flex-col items-center text-center">
            {/* Avatar with Camera Button */}
            <div className="relative mb-3">
              {displayAvatar ? (
                <img
                  src={getAvatarUrl(displayAvatar)}
                  alt={user?.name || 'Administrator'}
                  className="size-24 rounded-full border-2 border-primary-500/80 object-cover shadow-sm"
                />
              ) : (
                <div className="flex size-24 items-center justify-center rounded-full bg-primary-600 font-mono text-2xl font-bold text-white shadow-sm">
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
                </div>
              )}

              {canUpdateAvatar && (
                <>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageFileChange}
                  />
                  <Tooltip content="Upload high-res profile photo">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute bottom-0 right-0 flex size-7 items-center justify-center rounded-full border border-white bg-primary-600 text-white shadow-sm transition-transform hover:scale-105 hover:bg-primary-700"
                    >
                      <Camera className="size-3.5" />
                    </button>
                  </Tooltip>
                </>
              )}
            </div>

            <h2 className="text-base font-semibold text-ink leading-tight">
              {user?.name || 'Administrator'}
            </h2>
            <span className="font-mono text-xs text-muted mt-0.5">
              {user?.designation || 'System Owner'}
            </span>

            <div className="mt-2.5">
              <Badge variant="brand" className="font-mono text-[0.6875rem] gap-1">
                <ShieldCheck className="size-3" />
                <span>Executive Privileges</span>
              </Badge>
            </div>

            <Separator className="my-5 w-full" />

            {/* Read-only Specs List */}
            <div className="flex w-full flex-col gap-3 text-left">
              {/* Employee ID */}
              <div className="flex items-start gap-2.5">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-line bg-subtle text-muted mt-0.5">
                  <BadgeCheck className="size-3.5 text-primary-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-mono text-[0.625rem] font-bold uppercase tracking-wider text-muted block">
                    ADMINISTRATOR ID
                  </span>
                  <span className="font-mono text-xs font-semibold text-ink block mt-0.5">
                    {user?.employeeId || '--'}
                  </span>
                </div>
              </div>

              {/* Email */}
              <div className="flex items-start gap-2.5">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-line bg-subtle text-muted mt-0.5">
                  <Mail className="size-3.5 text-primary-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-mono text-[0.625rem] font-bold uppercase tracking-wider text-muted block">
                    OFFICIAL EMAIL
                  </span>
                  <span className="text-xs font-medium text-ink break-all block mt-0.5">
                    {user?.email || '--'}
                  </span>
                </div>
              </div>

              {/* Department */}
              <div className="flex items-start gap-2.5">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-line bg-subtle text-muted mt-0.5">
                  <Building2 className="size-3.5 text-primary-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-mono text-[0.625rem] font-bold uppercase tracking-wider text-muted block">
                    DEPARTMENT
                  </span>
                  <span className="text-xs font-medium text-ink block mt-0.5">
                    {user?.department || 'Operations Management'}
                  </span>
                </div>
              </div>

              {/* Date Onboarded */}
              <div className="flex items-start gap-2.5">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-line bg-subtle text-muted mt-0.5">
                  <Calendar className="size-3.5 text-primary-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-mono text-[0.625rem] font-bold uppercase tracking-wider text-muted block">
                    DATE ONBOARDED
                  </span>
                  <span className="font-mono text-xs font-medium text-ink block mt-0.5">
                    {user?.joinedDate ? dayjs(user.joinedDate).format('DD MMM YYYY') : '--'}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* Security & Multi-Tenant Status Card */}
          <Card className="p-4 flex flex-col gap-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-ink">
              <Lock className="size-3.5 text-primary-600" />
              <span>Security & Tenant Scope</span>
            </div>
            <div className="rounded-lg border border-line bg-subtle/50 p-2.5 font-mono text-[0.6875rem] text-muted flex flex-col gap-1">
              <div>
                Tenant: <strong className="text-ink">{currentTenant?.name || 'Master Corp'}</strong>
              </div>
              <div>
                Role: <strong className="text-ink">{currentTenant?.role || 'OWNER'}</strong>
              </div>
            </div>
            <p className="text-[0.6875rem] leading-relaxed text-muted">
              Credentials protected by organization 2FA guards and session token rotation.
            </p>
          </Card>
        </div>

        {/* Right Column (8 cols): Form Settings */}
        <div className="flex flex-col gap-5 lg:col-span-8">
          <Card className="p-6 flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-primary-600 font-semibold text-sm">
                <UserIcon className="size-4" />
                <span>Personal & Contact Credentials</span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Update your administrative contact details. These are visible on corporate punch records and audit logs.
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Full Name */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="name" className="text-xs font-medium text-ink">
                    Full Legal Name
                  </Label>
                  <div className="relative">
                    <UserIcon className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-faint" />
                    <input
                      id="name"
                      type="text"
                      disabled={isUpdating}
                      placeholder="e.g. Yash Solanki"
                      className={cn(
                        'h-9 w-full rounded-lg border border-line bg-canvas pl-9 pr-3 text-xs text-ink transition-colors focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400',
                        errors.name && 'border-rose-400 focus:border-rose-400 focus:ring-rose-400'
                      )}
                      {...register('name')}
                    />
                  </div>
                  {errors.name ? (
                    <span className="font-mono text-[0.625rem] text-rose-600 font-medium">
                      {errors.name.message}
                    </span>
                  ) : (
                    <span className="font-mono text-[0.625rem] text-muted">
                      Displayed on attendance audit ledgers
                    </span>
                  )}
                </div>

                {/* Contact Phone */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="phone" className="text-xs font-medium text-ink">
                    Contact Phone Number
                  </Label>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-faint" />
                    <input
                      id="phone"
                      type="tel"
                      disabled={isUpdating}
                      placeholder="e.g. +91 98765 43210"
                      className={cn(
                        'h-9 w-full rounded-lg border border-line bg-canvas pl-9 pr-3 text-xs text-ink transition-colors focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400',
                        errors.phone && 'border-rose-400 focus:border-rose-400 focus:ring-rose-400'
                      )}
                      {...register('phone')}
                    />
                  </div>
                  {errors.phone ? (
                    <span className="font-mono text-[0.625rem] text-rose-600 font-medium">
                      {errors.phone.message}
                    </span>
                  ) : (
                    <span className="font-mono text-[0.625rem] text-muted">
                      Direct corporate mobile or office line
                    </span>
                  )}
                </div>

                {/* Official Email (Read-only) */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email" className="text-xs font-medium text-ink">
                    Official Email (SSO Identity)
                  </Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-faint" />
                    <input
                      id="email"
                      type="email"
                      readOnly
                      disabled
                      value={user?.email || ''}
                      className="h-9 w-full rounded-lg border border-line bg-subtle/70 pl-9 pr-3 text-xs text-muted cursor-not-allowed font-mono"
                    />
                  </div>
                  <span className="font-mono text-[0.625rem] text-muted">
                    Primary login identity managed by platform auth
                  </span>
                </div>

                {/* Department / Role (Read-only) */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="designation" className="text-xs font-medium text-ink">
                    Official Designation
                  </Label>
                  <div className="relative">
                    <Briefcase className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-faint" />
                    <input
                      id="designation"
                      type="text"
                      readOnly
                      disabled
                      value={user?.designation || 'System Owner'}
                      className="h-9 w-full rounded-lg border border-line bg-subtle/70 pl-9 pr-3 text-xs text-muted cursor-not-allowed"
                    />
                  </div>
                  <span className="font-mono text-[0.625rem] text-muted">
                    Governed by organization role hierarchy
                  </span>
                </div>
              </div>

              <Separator className="my-1" />

              {/* Form Action Buttons */}
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isUpdating || !isDirty}
                  onClick={() =>
                    reset({
                      name: user?.name || '',
                      phone: user?.phone || '',
                    })
                  }
                  className="gap-1.5 text-xs text-muted hover:text-ink"
                >
                  <RotateCcw className="size-3" />
                  <span>Reset Changes</span>
                </Button>

                <Button
                  type="submit"
                  variant="brand"
                  size="default"
                  disabled={isUpdating}
                  className="gap-2 px-6 shadow-sm"
                >
                  {isUpdating ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>Saving Profile...</span>
                    </>
                  ) : (
                    <>
                      <Save className="size-4" />
                      <span>Save Profile Changes</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>

      {/* Floating Toast Notification */}
      {toast.open && (
        <div
          className={cn(
            'fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl border p-3.5 text-xs font-medium shadow-pop animate-in slide-in-from-bottom-3',
            toast.severity === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-rose-200 bg-rose-50 text-rose-900'
          )}
        >
          {toast.severity === 'success' ? (
            <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="size-4 text-rose-600 shrink-0" />
          )}
          <span>{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast((prev) => ({ ...prev, open: false }))}
            className="ml-2 rounded p-0.5 hover:bg-black/5"
          >
            <X className="size-3" />
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminProfile;
