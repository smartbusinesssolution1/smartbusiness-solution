import express from 'express';
import { authMiddleware } from "../middlewares/auth.middleware";
import { tenantMiddleware, requireProduct } from "@smartbusiness/auth";
import { UPLOADS_DIR      } from '../shared/utils/uploadDir';
// import { attendanceRouter } from '../modules/attendance/attendance.router';
import { settingsRouter   } from '../modules/settings/settings.router';
import employeeRouter   from '../modules/employee/employee.routes.js';
import workspaceRouter  from '../modules/workspace/workspace.routes.js';
// import { userRouter       } from '../modules/user/user.router';

import { rootRouter     } from '../modules/root/root.router';
import { devTestRouter  } from '../modules/devtest/devtest.router';
import adminGeofenceRouter from '../modules/admin/geofence/admin-geofence.routes.js';
import adminEmployeeRouter from '../modules/admin/employee/admin-employee.routes.js';
import adminAttendanceRouter from '../modules/admin/attendance/admin-attendance.routes.js';

const apiV1 = express.Router();

// ─── Unprotected Routes ───────────────────────────
apiV1.use('/', rootRouter);
apiV1.use('/uploads', express.static(UPLOADS_DIR));

// Centralized Auth Proxy: Relay /auth requests to platform-api (Port 3001)
apiV1.use('/auth', async (req, res) => {
  try {
    const platformApiUrl = process.env.PLATFORM_API_URL || 'http://localhost:3001';
    const targetUrl = `${platformApiUrl}/api/v1/auth${req.path}`;

    const headers: Record<string, string> = {
      'content-type': (req.headers['content-type'] as string) || 'application/json',
    };
    if (req.headers.cookie) headers['cookie'] = req.headers.cookie;
    if (req.headers['x-tenant-id']) headers['x-tenant-id'] = req.headers['x-tenant-id'] as string;

    const fetchResponse = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: ['POST', 'PUT', 'PATCH'].includes(req.method) ? JSON.stringify(req.body) : undefined,
    });

    const setCookieHeaders = (fetchResponse.headers as any).getSetCookie?.() || [];
    if (setCookieHeaders.length > 0) {
      res.setHeader('Set-Cookie', setCookieHeaders);
    } else {
      const singleSetCookie = fetchResponse.headers.get('set-cookie');
      if (singleSetCookie) res.setHeader('Set-Cookie', singleSetCookie);
    }

    const data = await fetchResponse.json();
    return res.status(fetchResponse.status).json(data);
  } catch (err: any) {
    return res.status(502).json({
      success: false,
      error: {
        code: 'BAD_GATEWAY',
        message: 'Could not connect to centralized platform-api at Port 3001. Ensure platform-api is running.',
      },
    });
  }
});

// ─── Protected Routes ─────────────────────────────

// Auth Middlewares: auth → tenant → product entitlement → routes
apiV1.use(authMiddleware);
apiV1.use(tenantMiddleware);
apiV1.use(requireProduct("clock-in-clock-out"));

// API Routes
apiV1.get('/devtest',    devTestRouter);
apiV1.use('/workspaces', workspaceRouter);
apiV1.use('/employees',  employeeRouter);

// Admin Routes (Gated by requireAdmin)
apiV1.use('/admin/attendance/geofences', adminGeofenceRouter);
apiV1.use('/admin/geofences',            adminGeofenceRouter);
apiV1.use('/admin/employees',            adminEmployeeRouter);
apiV1.use('/admin/attendance',           adminAttendanceRouter);

// apiV1.use('/attendance', attendanceRouter);
apiV1.use('/settings',   settingsRouter);
// apiV1.use('/users',      userRouter);

export { apiV1 };