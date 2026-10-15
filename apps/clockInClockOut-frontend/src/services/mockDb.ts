import { User, AttendanceRecord, OrganizationSettings } from '../types';
import dayjs from 'dayjs';

const USERS_KEY = 'checkpoint_users';
const ATTENDANCE_KEY = 'checkpoint_attendance';
const SETTINGS_KEY = 'checkpoint_settings';
const CURRENT_USER_KEY = 'checkpoint_current_user';

const INITIAL_USERS: User[] = [
  {
    id: 'u1',
    employeeId: 'EMP-GA001',
    name: 'Sarah Connor',
    email: 'sarah.connor@checkpoint.io',
    phone: '+1 (555) 019-2834',
    role: 'admin',
    status: 'active',
    designation: 'HR Director',
    department: 'Human Resources',
    joinedDate: '2024-01-15',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
  },
  {
    id: 'u2',
    employeeId: 'EMP-GA002',
    name: 'John Miller',
    email: 'john.miller@checkpoint.io',
    phone: '+1 (555) 014-9982',
    role: 'employee',
    status: 'active',
    designation: 'Senior Software Engineer',
    department: 'Engineering',
    joinedDate: '2024-03-10',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
  },
  {
    id: 'u3',
    employeeId: 'EMP-GA003',
    name: 'Emily Davis',
    email: 'emily.davis@checkpoint.io',
    phone: '+1 (555) 012-4431',
    role: 'employee',
    status: 'active',
    designation: 'Product Designer',
    department: 'Product',
    joinedDate: '2024-06-01',
    avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150',
  },
  {
    id: 'u4',
    employeeId: 'EMP-GA004',
    name: 'David Chen',
    email: 'david.chen@checkpoint.io',
    phone: '+1 (555) 017-3390',
    role: 'employee',
    status: 'active',
    designation: 'Marketing Lead',
    department: 'Marketing',
    joinedDate: '2024-05-18',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
  },
  {
    id: 'u5',
    employeeId: 'EMP-GA005',
    name: 'Marcus Vance',
    email: 'marcus.vance@checkpoint.io',
    phone: '+1 (555) 011-8822',
    role: 'employee',
    status: 'inactive',
    designation: 'Sales Executive',
    department: 'Sales',
    joinedDate: '2024-02-20',
    avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150',
  }
];

const INITIAL_SETTINGS: OrganizationSettings = {
  companyName: 'ClockInClockOut Technologies Inc.',
  officeName: 'HQ Silicon Valley',
  latitude: 37.774929,
  longitude: -122.419416,
  radius: 100, // 100 meters geo-fence
  officeStartTime: '09:00',
  officeEndTime: '18:00',
};

// Generate historical attendance data for the past 14 days
const generateHistoricalAttendance = (users: User[]): AttendanceRecord[] => {
  const records: AttendanceRecord[] = [];
  const today = dayjs();
  const activeEmployees = users.filter(u => u.role === 'employee');

  for (let i = 14; i >= 0; i--) {
    const currentDate = today.subtract(i, 'day');
    const isWeekend = currentDate.day() === 0 || currentDate.day() === 6;

    if (isWeekend) continue; // Skip weekends

    const dateStr = currentDate.format('YYYY-MM-DD');

    activeEmployees.forEach(emp => {
      // For today, generate realistic records: 1 absent, others active
      if (i === 0) {
        if (emp.employeeId === 'EMP-GA004') {
          records.push({
            id: `att_${emp.id}_${dateStr}`,
            employeeId: emp.employeeId,
            employeeName: emp.name,
            date: dateStr,
            checkIn: null,
            checkOut: null,
            status: 'absent',
            workingHours: 0,
            notes: 'Unexcused absence - No clock-in recorded',
          });
          return;
        }

        const checkInTime = dayjs(`${dateStr} 08:55`, 'YYYY-MM-DD HH:mm');
        records.push({
          id: `att_${emp.id}_${dateStr}`,
          employeeId: emp.employeeId,
          employeeName: emp.name,
          date: dateStr,
          checkIn: checkInTime.format('HH:mm:ss'),
          checkOut: null,
          status: 'present',
          workingHours: 0,
        });
        return;
      }

      // 10% chance of absence
      const isAbsent = Math.random() < 0.1;
      if (isAbsent) {
        records.push({
          id: `att_${emp.id}_${dateStr}`,
          employeeId: emp.employeeId,
          employeeName: emp.name,
          date: dateStr,
          checkIn: null,
          checkOut: null,
          status: 'absent',
          workingHours: 0,
        });
        return;
      }

      // Random check-in between 08:30 and 10:15
      const checkInHour = Math.random() < 0.3 ? 9 : 8; // 30% chance to check in at 9, 70% at 8
      const checkInMin = Math.floor(Math.random() * 60);
      const checkInTime = dayjs(`${dateStr} ${checkInHour}:${checkInMin}`, 'YYYY-MM-DD HH:mm');
      
      const officeStart = dayjs(`${dateStr} 09:00`, 'YYYY-MM-DD HH:mm');
      const isLate = checkInTime.isAfter(officeStart);

      // Random check-out between 17:30 and 19:00 (or auto-closed 5% of time)
      const isAutoClosed = Math.random() < 0.05;
      
      let checkOutStr: string | null = null;
      let workingHours = 0;
      let status: AttendanceRecord['status'] = isLate ? 'late' : 'present';

      if (isAutoClosed) {
        status = 'auto_closed';
        workingHours = 8.0; // Fixed default or partial
      } else {
        const checkOutHour = 17 + Math.floor(Math.random() * 2);
        const checkOutMin = Math.floor(Math.random() * 60);
        const checkOutTime = dayjs(`${dateStr} ${checkOutHour}:${checkOutMin}`, 'YYYY-MM-DD HH:mm');
        checkOutStr = checkOutTime.format('HH:mm:ss');
        workingHours = parseFloat(checkOutTime.diff(checkInTime, 'hour', true).toFixed(2));
      }

      records.push({
        id: `att_${emp.id}_${dateStr}`,
        employeeId: emp.employeeId,
        employeeName: emp.name,
        date: dateStr,
        checkIn: checkInTime.format('HH:mm:ss'),
        checkOut: checkOutStr,
        status,
        workingHours,
      });
    });
  }

  return records;
};

// Initialize Database in LocalStorage
export const initDb = () => {
  if (!localStorage.getItem(USERS_KEY)) {
    localStorage.setItem(USERS_KEY, JSON.stringify(INITIAL_USERS));
  }
  if (!localStorage.getItem(SETTINGS_KEY)) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(INITIAL_SETTINGS));
  }
  if (!localStorage.getItem(ATTENDANCE_KEY)) {
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    const attendance = generateHistoricalAttendance(users);
    localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(attendance));
  }
};

// Get Data helpers
export const getUsers = (): User[] => {
  initDb();
  return JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
};

export const saveUsers = (users: User[]) => {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

export const getAttendance = (): AttendanceRecord[] => {
  initDb();
  let records: AttendanceRecord[] = JSON.parse(localStorage.getItem(ATTENDANCE_KEY) || '[]');
  const todayStr = dayjs().format('YYYY-MM-DD');
  const hasToday = records.some((r) => r.date === todayStr);
  if (!hasToday && records.length > 0) {
    const users = getUsers();
    const todayRecords = generateHistoricalAttendance(users).filter((r) => r.date === todayStr);
    records = [...todayRecords, ...records];
    localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(records));
  }
  return records;
};

export const saveAttendance = (records: AttendanceRecord[]) => {
  localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(records));
};

export const getSettings = (): OrganizationSettings => {
  initDb();
  return JSON.parse(localStorage.getItem(SETTINGS_KEY) || JSON.stringify(INITIAL_SETTINGS));
};

export const saveSettings = (settings: OrganizationSettings) => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

export const getSessionUser = (): User | null => {
  const userStr = localStorage.getItem(CURRENT_USER_KEY);
  if (!userStr) return null;
  // Make sure we have the latest user details from our DB
  const user = JSON.parse(userStr) as User;
  const dbUsers = getUsers();
  const current = dbUsers.find(u => u.id === user.id || u.email === user.email);
  return current || user;
};

export const setSessionUser = (user: User | null) => {
  if (user) {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(CURRENT_USER_KEY);
  }
};
