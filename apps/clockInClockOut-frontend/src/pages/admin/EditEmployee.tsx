import React, { useEffect, useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  ArrowLeft,
  Upload,
  Trash2,
  Clock,
  User as UserIcon,
  Mail,
  Phone,
  Briefcase,
  Building2,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  RotateCw,
  Save,
} from 'lucide-react';

import { employeeService } from '../../services/employeeService';
import BrandLoader from '../../components/BrandLoader';
import { settingsService } from '../../services/settingsService';
import { useAuth } from '../../context/AuthContext';
import { DayWiseShiftPicker, DEFAULT_WEEKLY_SCHEDULE } from '../../components/DayWiseShiftPicker';
import { WeeklySchedule } from '../../types';
import { getAvatarUrl } from '../../utils/imageUrl';
import { STANDARD_DEPARTMENTS } from '../../constants/departments';
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

export const EditEmployee: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { currentTenant, isSuperAdmin, user } = useAuth();
  const isOwner = Boolean(currentTenant?.role === 'OWNER' || isSuperAdmin);

  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule>(DEFAULT_WEEKLY_SCHEDULE);

  // Fetch current employee data
  const { data: employee, isLoading, error: fetchError } = useQuery({
    queryKey: ['adminEmployee', id],
    queryFn: () => employeeService.getEmployee(id || ''),
    enabled: Boolean(user && id),
  });

  // Fetch organization settings
  const { data: orgSettings } = useQuery({
    queryKey: ['adminSettings'],
    queryFn: () => settingsService.getSettings(),
    enabled: Boolean(user),
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
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

  const departmentOptions = React.useMemo(() => {
    const list = [...STANDARD_DEPARTMENTS];
    if (employee?.department && !list.includes(employee.department as any)) {
      list.push(employee.department as any);
    }
    return list;
  }, [employee?.department]);

  // Populate form values when data loaded
  useEffect(() => {
    if (employee) {
      reset({
        name: employee.name,
        email: employee.email,
        phone: employee.phone,
        designation: employee.designation,
        department: employee.department,
        role: employee.role === 'admin' ? 'admin' : 'employee',
        status: employee.status,
        shiftType: employee.shiftType || 'general',
        shiftStartTime: employee.shiftStartTime || orgSettings?.officeStartTime || '09:00',
        shiftEndTime: employee.shiftEndTime || orgSettings?.officeEndTime || '18:00',
      });
      if (employee.avatarUrl) {
        setPreviewUrl(employee.avatarUrl);
      }
      if (Array.isArray(employee.weeklySchedule) && employee.weeklySchedule.length > 0) {
        setWeeklySchedule(employee.weeklySchedule);
      } else if (employee.weeklySchedule && typeof employee.weeklySchedule === 'object') {
        const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
        setWeeklySchedule(
          days.map((d) => ({
            day: d,
            isWorkDay: (employee.weeklySchedule as any)[d]?.isWorkDay ?? !['SAT', 'SUN'].includes(d),
            startTime: (employee.weeklySchedule as any)[d]?.startTime || '09:00',
            endTime: (employee.weeklySchedule as any)[d]?.endTime || '18:00',
          }))
        );
      }
    }
  }, [employee, orgSettings, reset]);

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: (formData: FormData) => employeeService.updateEmployee(id || '', formData),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['adminEmployees'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['adminEmployee', id] }),
        queryClient.invalidateQueries({ queryKey: ['adminDashboardMetrics'], refetchType: 'all' }),
      ]);
      navigate('/admin/employees');
    },
    onError: (err: any) => {
      setError(err?.message || 'Failed to save updates to the employee.');
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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const onSubmit = (data: EmployeeFormValues) => {
    setError(null);
    setFileError(null);

    if (!previewUrl && !selectedFile) {
      setFileError('Corporate profile picture is mandatory for biometric face registration.');
      return;
    }

    if (data.role === 'admin' && !isOwner && employee?.role !== 'admin') {
      setError('Only organization owners can grant administrator privileges.');
      return;
    }

    if (employee?.role === 'admin' && !isOwner) {
      setError('Only organization owners can modify administrator profiles.');
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

    formData.append('shiftType', data.shiftType);
    if (data.shiftType === 'custom') {
      formData.append('weeklySchedule', JSON.stringify(weeklySchedule));
    }

    if (selectedFile) {
      formData.append('avatar', selectedFile);
    }

    updateMutation.mutate(formData);
  };

  if (isLoading) {
    return <BrandLoader fullScreen message="Loading employee profile..." />;
  }

  if (fetchError || !employee) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        <Button variant="ghost" size="sm" asChild className="gap-1.5 -ml-2 text-muted hover:text-ink">
          <Link to="/admin/employees">
            <ArrowLeft className="size-3.5" />
            <span>Back to directory</span>
          </Link>
        </Button>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
          Failed to fetch the requested employee. The record may have been deleted or moved.
        </div>
      </div>
    );
  }

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
        <span className="eyebrow">PERSONNEL ADMINISTRATION</span>
        <h1 className="text-[1.625rem] sm:text-[1.75rem] font-semibold tracking-[-0.02em] leading-tight text-ink">
          Edit Staff Profile
        </h1>
        <p className="text-xs sm:text-sm text-muted leading-relaxed">
          Update corporate parameters, contact channels, and shift schedule for{' '}
          <strong className="text-ink font-semibold">{employee.name}</strong> ({employee.employeeId || 'ID'}).
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800">
          <AlertTriangle className="size-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
        {/* Card 1: Biometric Photo */}
        <Card className="p-5">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-sm font-semibold">1. Biometric Profile Photo</CardTitle>
            <CardDescription className="text-xs">
              Clear frontal photo used for automated AI face recognition and identity badges.
            </CardDescription>
          </CardHeader>

          <div className="flex flex-col sm:flex-row items-center gap-5 pt-2">
            <div className="relative">
              {previewUrl ? (
                <img
                  src={getAvatarUrl(previewUrl) || previewUrl}
                  alt={employee.name}
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
                id="edit-avatar-upload-input"
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
                  <span>Replace Photo</span>
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

        {/* Card 2: Contact & Identity */}
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
              <Label htmlFor="email">Business Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="sarah@company.com"
                error={Boolean(errors.email)}
                {...register('email')}
              />
              {errors.email && <p className="text-[0.6875rem] text-rose-600">{errors.email.message}</p>}
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
                <p className="text-[0.6875rem] text-muted">Only organization owners can modify admin roles.</p>
              )}
            </div>

            {/* Status */}
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
                {departmentOptions.map((dept) => (
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
            disabled={updateMutation.isPending}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            variant="brand"
            disabled={updateMutation.isPending}
            className="gap-2 px-6"
          >
            {updateMutation.isPending ? (
              <>
                <RotateCw className="size-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="size-4" />
                <span>Save Changes</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default EditEmployee;
