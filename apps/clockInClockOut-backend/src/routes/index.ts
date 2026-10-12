import express from 'express';
import { authMiddleware } from "../middlewares/auth.middleware";
import { tenantMiddleware, requireProduct } from "@smartbusiness/auth";
import { UPLOADS_DIR      } from '../shared/utils/uploadDir';
// import { attendanceRouter } from '../modules/attendance/attendance.router';
import { settingsRouter   } from '../modules/settings/settings.router';
// import { userRouter       } from '../modules/user/user.router';
import { rootRouter     } from '../modules/root/root.router';
import { devTestRouter  } from '../modules/devtest/devtest.router';

const apiV1 = express.Router();

// ─── Unprotected Routes ───────────────────────────
apiV1.use('/', rootRouter);

// ─── Protected Routes ─────────────────────────────

// Auth Middlewares: auth → tenant → product entitlement → routes
apiV1.use(authMiddleware);
apiV1.use(tenantMiddleware);
apiV1.use(requireProduct("clock-in-clock-out"));

// API Routes
apiV1.get('/devtest',    devTestRouter)
// apiV1.use('/attendance', attendanceRouter);
apiV1.use('/settings',   settingsRouter);
apiV1.use('/uploads',    express.static(UPLOADS_DIR)); // Mutler: Serve uploaded selfies statically
// apiV1.use('/users',      userRouter);

export { apiV1 };