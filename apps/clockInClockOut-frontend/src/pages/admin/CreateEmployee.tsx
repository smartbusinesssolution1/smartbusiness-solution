import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  ArrowLeft,
  Upload,
  Trash2,
  Clock,
  User as UserIcon,
  UserPlus,
  Mail,
  Phone,
  Briefcase,
  Building2,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  RotateCw,
  Sparkles,
} from 'lucide-react';

import { employeeService, CheckEmployeeEmailResult } from '../../services/employeeService';
import { settingsService } from '../../services/settingsService';
import { useAuth } from '../../context/AuthContext';
import { DayWiseShiftPicker, DEFAULT_WEEKLY_SCHEDULE } from '../../components/DayWiseShiftPicker';
import { WeeklySchedule } from '../../types';
import { STANDARD_DEPARTMENTS } from '../../constants/departments';
import { getAvatarUrl } from '../../utils/imageUrl';
import { cn } from '../../lib/utils';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Input,
  Label,
  Select,
  SelectItem,
} from '../../components/ui';

// Form Validation Schema
const schema = z.object({
  name: z.string().trim().min(3, 'Full Name must be at least 3 characters'),
  email: z.string().trim().email('Please enter a valid business email address'),
  phone: z.string().trim().min(5, 'Phone number must be at least 5 digits'),
  designation: z.string().trim().min(2, 'Designation is required'),
  department: z.string().trim().min(2, 'Department is required'),
  role: z.enum(['admin', 'employee']),
  status: z.enum(['active', 'inactive']),
  shiftType: z.enum(['general', 'custom']),
  shiftStartTime: z.string().optional(),
  shiftEndTime: z.string().optional(),
});

type EmployeeFormValues = z.infer<typeof schema>;

export const CreateEmployee: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user, currentTenant, isSuperAdmin } = useAuth();
  const isOwner = Boolean(currentTenant?.role === 'OWNER' || isSuperAdmin);

  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [existingAvatarUrl, setExistingAvatarUrl] = useState<string | null>(null);
  const [isAutoFilling, setIsAutoFilling] = useState<boolean>(false);
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule>(DEFAULT_WEEKLY_SCHEDULE);

  // Fetch organization settings for standard shift default
  const { data: orgSettings } = useQuery({
    queryKey: ['adminSettings'],
    queryFn: () => settingsService.getSettings(),
    enabled: Boolean(user),
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<EmployeeFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      designation: '',
      department: '',
      role: 'employee',
      status: 'active',
      shiftType: 'general',
      shiftStartTime: '09:00',
      shiftEndTime: '18:00',
    },
  });

  const watchShiftType = watch('shiftType');
  const watchRole = watch('role');
  const watchStatus = watch('status');
  const watchEmail = watch('email');

  const [emailCheckState, setEmailCheckState] = useState<{
    isLoading: boolean;
    result: CheckEmployeeEmailResult | null;
  }>({
    isLoading: false,
    result: null,
  });

  // Debounced check for existing user in tenant
  useEffect(() => {
    const trimmed = (watchEmail || '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmed || !emailRegex.test(trimmed)) {
      setEmailCheckState({ isLoading: false, result: null });
      return;
    }

    setEmailCheckState((prev) => ({ ...prev, isLoading: true }));
    const timer = setTimeout(async () => {
      try {
        const res = await employeeService.checkEmail(trimmed);
        setEmailCheckState({ isLoading: false, result: res });
      } catch {
        setEmailCheckState({ isLoading: false, result: null });
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [watchEmail]);

  // Sync default shift times from organization settings
  useEffect(() => {
    if (orgSettings?.officeStartTime || orgSettings?.officeEndTime) {
      const defaultStart = orgSettings.officeStartTime || '09:00';
      const defaultEnd = orgSettings.officeEndTime || '18:00';
      setValue('shiftStartTime', defaultStart);
      setValue('shiftEndTime', defaultEnd);
      setWeeklySchedule((prev) =>
        prev.map((item) => ({
          ...item,
          startTime: defaultStart,
          endTime: defaultEnd,
        }))
      );
    }
  }, [orgSettings, setValue]);

  // Create Mutation
  const mutation = useMutation({
    mutationFn: (formData: FormData) => employeeService.createEmployee(formData),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['adminEmployees'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['adminDashboardMetrics'], refetchType: 'all' }),
      ]);
      navigate('/admin/employees');
    },
    onError: (err: any) => {
      setError(err?.message || 'Failed to register the new employee.');
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setFileError('Please select a valid image file (PNG/JPG/JPEG).');
        return;
      }
      setSelectedFile(file);
      setExistingAvatarUrl(null);
      setFileError(null);

      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setExistingAvatarUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAutoFill = async () => {
    if (!emailCheckState.result?.user) return;
    setIsAutoFilling(true);

    try {
      const { user, existingWorkspaces } = emailCheckState.result;
      const profile = existingWorkspaces?.find((w) => w.isActive) || existingWorkspaces?.[0];

      if (user.name) setValue('name', user.name, { shouldValidate: true });
      const phoneVal = user.phone || profile?.phone;
      if (phoneVal) setValue('phone', phoneVal, { shouldValidate: true });
      if (profile?.designation) setValue('designation', profile.designation, { shouldValidate: true });
      if (profile?.department) setValue('department', profile.department, { shouldValidate: true });
      if (isOwner && profile?.role) {
        setValue('role', profile.role === 'admin' ? 'admin' : 'employee', { shouldValidate: true });
      }
      if (profile?.isActive !== undefined) {
        setValue('status', profile.isActive ? 'active' : 'inactive', { shouldValidate: true });
      }

      const targetAvatar = user.avatarUrl || profile?.avatarUrl;
      if (targetAvatar) {
        setExistingAvatarUrl(targetAvatar);
        const fullUrl = getAvatarUrl(targetAvatar);
        if (fullUrl) {
          setPreviewUrl(fullUrl);
          setFileError(null);
          try {
            const res = await fetch(fullUrl, { credentials: 'include' });
            if (res.ok) {
              const blob = await res.blob();
              const mime = blob.type || 'image/jpeg';
              const ext = mime.split('/')[1] || 'jpg';
              const file = new File([blob], `avatar-${Date.now()}.${ext}`, { type: mime });
              setSelectedFile(file);
            }
          } catch {
            // Non-fatal
          }
        }
      }
    } finally {
      setIsAutoFilling(false);
    }
  };

  const onSubmit = (data: EmployeeFormValues) => {
    if (emailCheckState.result?.status === 'EXISTS_CURRENT_WORKSPACE') {
      setError('An employee with this email already exists in this workspace.');
      return;
    }
    setError(null);
    setFileError(null);

    if (!selectedFile && !existingAvatarUrl) {
      setFileError('Profile photo is mandatory for biometric face registration.');
      return;
    }

    if (data.role === 'admin' && !isOwner) {
      setError('Only organization owners can grant administrator privileges.');
      return;
    }

    const formData = new FormData();
    formData.append('name', data.name);
    formData.append('email', data.email);
    formData.append('phone', data.phone);
    formData.append('designation', data.designation);
    formData.append('department', data.department);
    formData.append('role', isOwner ? data.role : 'employee');
    formData.append('status', data.status);
    if (selectedFile) {
      formData.append('avatar', selectedFile);
    } else if (existingAvatarUrl) {
      formData.append('existingAvatarUrl', existingAvatarUrl);
    }

    formData.append('shiftType', data.shiftType);
    if (data.shiftType === 'custom') {
      formData.append('weeklySchedule', JSON.stringify(weeklySchedule));
    }

    mutation.mutate(formData);
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      {/* Back button */}
      <div>
        <Button variant="ghost" size="sm" asChild className="gap-1.5 -ml-2 text-muted hover:text-ink">
          <Link to="/admin/employees">
            <ArrowLeft className="size-3.5" />
            <span>Back to directory</span>
          </Link>
        </Button>
      </div>

      {/* Page Header */}
      <div className="flex flex-col gap-1.5">
        <span className="eyebrow">PERSONNEL ONBOARDING</span>
        <h1 className="text-[1.625rem] sm:text-[1.75rem] font-semibold tracking-[-0.02em] leading-tight text-ink">
          Onboard New Employee
        </h1>
        <p className="text-xs sm:text-sm text-muted leading-relaxed">
          Add the employee's details, biometric face photo and shift schedule. They get an email to choose their own password.
        </p>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800">
          <AlertTriangle className="size-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Existing User Auto-Fill Banner */}
      {emailCheckState.result?.status === 'EXISTS_OTHER_WORKSPACE' && (
        <Card className="border-primary-200 bg-primary-50/50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <Sparkles className="size-4 shrink-0 text-primary-600 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-primary-900">
                  Existing SmartBusiness Account Found
                </p>
                <p className="text-[0.6875rem] text-primary-700/80 leading-relaxed">
                  {emailCheckState.result.user?.name} is registered in your organization. Auto-fill will import contact details and verified face photo.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="brand"
              size="sm"
              onClick={handleAutoFill}
              disabled={isAutoFilling}
              className="shrink-0"
            >
              {isAutoFilling ? 'Importing...' : 'Auto-fill profile'}
            </Button>
          </div>
        </Card>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
        {/* Card 1: Biometric Identity & Photo */}
        <Card className="p-5">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-sm font-semibold">1. Biometric Profile Photo</CardTitle>
            <CardDescription className="text-xs">
              Clear frontal photo required for automated AI face-recognition check-in.
            </CardDescription>
          </CardHeader>

          <div className="flex flex-col sm:flex-row items-center gap-5 pt-2">
            <div className="relative">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Avatar preview"
                  className="size-24 rounded-2xl border-2 border-primary-200 object-cover shadow-sm"
                />
              ) : (
                <div className="flex size-24 items-center justify-center rounded-2xl border-2 border-dashed border-line bg-subtle text-faint">
                  <UserIcon className="size-10" />
                </div>
              )}
            </div>

            <div className="flex flex-1 flex-col gap-2 items-center sm:items-start text-center sm:text-left">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                id="avatar-upload-input"
              />

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-1.5"
                >
                  <Upload className="size-3.5" />
                  <span>Choose Photo</span>
                </Button>

                {previewUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveFile}
                    className="gap-1.5 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                  >
                    <Trash2 className="size-3.5" />
                    <span>Remove</span>
                  </Button>
                )}
              </div>

              <p className="text-[0.6875rem] text-muted">
                JPG, PNG or WebP up to 5MB. Front-facing, well-lit without sunglasses or masks.
              </p>

              {fileError && (
                <p className="text-xs text-rose-600 font-medium">{fileError}</p>
              )}
            </div>
          </div>
        </Card>

        {/* Card 2: Contact & Personal Details */}
        <Card className="p-5">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-sm font-semibold">2. Personal & Contact Credentials</CardTitle>
            <CardDescription className="text-xs">
              Primary identification details and account login email.
            </CardDescription>
          </CardHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            {/* Full Name */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                placeholder="e.g. Sarah Connor"
                error={Boolean(errors.name)}
                {...register('name')}
              />
              {errors.name && <p className="text-[0.6875rem] text-rose-600">{errors.name.message}</p>}
            </div>

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="email">Business Email *</Label>
                {emailCheckState.isLoading && (
                  <RotateCw className="size-3 animate-spin text-muted" />
                )}
              </div>
              <Input
                id="email"
                type="email"
                placeholder="sarah@company.com"
                error={Boolean(errors.email || emailCheckState.result?.status === 'EXISTS_CURRENT_WORKSPACE')}
                {...register('email')}
              />
              {errors.email ? (
                <p className="text-[0.6875rem] text-rose-600">{errors.email.message}</p>
              ) : emailCheckState.result?.status === 'EXISTS_CURRENT_WORKSPACE' ? (
                <p className="text-[0.6875rem] text-rose-600">Employee already exists in this workspace.</p>
              ) : null}
            </div>

            {/* Phone */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">Contact Phone *</Label>
              <Input
                id="phone"
                placeholder="+1 (555) 012-3456"
                error={Boolean(errors.phone)}
                {...register('phone')}
              />
              {errors.phone && <p className="text-[0.6875rem] text-rose-600">{errors.phone.message}</p>}
            </div>

            {/* Account Role using shadcn Select */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="role">Access Role *</Label>
              <Select
                id="role"
                value={watchRole}
                onValueChange={(val) => setValue('role', val as any, { shouldValidate: true })}
                disabled={!isOwner}
              >
                <SelectItem value="employee">Standard Staff (Attendance Check-In)</SelectItem>
                <SelectItem value="admin">Administrator (Management & Reports)</SelectItem>
              </Select>
              {!isOwner && (
                <p className="text-[0.6875rem] text-muted">Only organization owners can grant admin role.</p>
              )}
            </div>

            {/* Account Status */}
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="status">Account Status *</Label>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="active"
                    checked={watchStatus === 'active'}
                    onChange={() => setValue('status', 'active')}
                    className="accent-primary-600"
                  />
                  <Badge variant="success" className="cursor-pointer">Active Account</Badge>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="inactive"
                    checked={watchStatus === 'inactive'}
                    onChange={() => setValue('status', 'inactive')}
                    className="accent-primary-600"
                  />
                  <Badge variant="secondary" className="cursor-pointer">Inactive / On Hold</Badge>
                </label>
              </div>
            </div>
          </div>
        </Card>

        {/* Card 3: Department & Position */}
        <Card className="p-5">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-sm font-semibold">3. Department & Organization Position</CardTitle>
            <CardDescription className="text-xs">
              Assign structural department division and job title.
            </CardDescription>
          </CardHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="department">Department Division *</Label>
              <Select
                id="department"
                value={watch('department') || ''}
                onValueChange={(val) => setValue('department', val, { shouldValidate: true })}
                placeholder="Select Department"
              >
                {STANDARD_DEPARTMENTS.map((dept) => (
                  <SelectItem key={dept} value={dept}>
                    {dept}
                  </SelectItem>
                ))}
              </Select>
              {errors.department && (
                <p className="text-[0.6875rem] text-rose-600">{errors.department.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="designation">Job Title / Designation *</Label>
              <Input
                id="designation"
                placeholder="e.g. Lead Product Designer"
                error={Boolean(errors.designation)}
                {...register('designation')}
              />
              {errors.designation && (
                <p className="text-[0.6875rem] text-rose-600">{errors.designation.message}</p>
              )}
            </div>
          </div>
        </Card>

        {/* Card 4: Working Hours & Shift Assignment */}
        <Card className="p-5">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-sm font-semibold">4. Shift Hours & Working Schedule</CardTitle>
            <CardDescription className="text-xs">
              Determine expected punch-in hours and geofence tracking policy.
            </CardDescription>
          </CardHeader>

          <div className="flex flex-col gap-4 pt-1">
            {/* Shift Mode Toggle */}
            <div className="flex rounded-lg border border-line bg-subtle p-0.5 max-w-md">
              <button
                type="button"
                onClick={() => setValue('shiftType', 'general')}
                className={cn(
                  'flex-1 rounded-md py-1.5 text-xs font-medium transition-all text-center',
                  watchShiftType === 'general'
                    ? 'bg-panel font-semibold text-ink shadow-sm'
                    : 'text-muted hover:text-ink'
                )}
              >
                Company Default Shift
              </button>
              <button
                type="button"
                onClick={() => setValue('shiftType', 'custom')}
                className={cn(
                  'flex-1 rounded-md py-1.5 text-xs font-medium transition-all text-center',
                  watchShiftType === 'custom'
                    ? 'bg-panel font-semibold text-ink shadow-sm'
                    : 'text-muted hover:text-ink'
                )}
              >
                Custom Day-Wise Shift
              </button>
            </div>

            {watchShiftType === 'general' ? (
              <div className="rounded-xl border border-line bg-subtle/50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Clock className="size-4 text-primary-600" />
                    <div>
                      <p className="text-xs font-semibold text-ink">Organization Standard Hours</p>
                      <p className="font-mono text-xs text-muted num">
                        {orgSettings?.officeStartTime || '09:00'} - {orgSettings?.officeEndTime || '18:00'} (Mon-Fri)
                      </p>
                    </div>
                  </div>
                  <Badge variant="brand" className="font-mono text-[0.625rem]">
                    Company Default
                  </Badge>
                </div>
              </div>
            ) : (
              <div className="pt-2">
                <DayWiseShiftPicker
                  value={weeklySchedule}
                  onChange={setWeeklySchedule}
                />
              </div>
            )}
          </div>
        </Card>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/admin/employees')}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            variant="brand"
            disabled={mutation.isPending}
            className="gap-2 px-6"
          >
            {mutation.isPending ? (
              <>
                <RotateCw className="size-4 animate-spin" />
                <span>Onboarding...</span>
              </>
            ) : (
              <>
                <UserPlus className="size-4" />
                <span>Onboard Employee</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default CreateEmployee;
