import { parsedEnv } from "./parseEnv.js";

export const env = {
    server: {
        nodeEnv: parsedEnv.NODE_ENV,
        isDev: parsedEnv.NODE_ENV === "dev",
        isTest: parsedEnv.NODE_ENV === "test",
        isProd: parsedEnv.NODE_ENV === "prod",
        port: parsedEnv.PORT,
        origin: parsedEnv.ORIGIN,
    },

    rateLimit: {
        windowMs: parsedEnv.RATE_LIMIT_WINDOWMS,
        limit: parsedEnv.RATE_LIMIT_MAX,
    },

    jwt: {
        accessToken: {
            secret: parsedEnv.JWT_ACCESS_TOKEN_SECRET,
            expiresIn: parsedEnv.JWT_ACCESS_TOKEN_EXPIRES_IN,
        },
    },

    database: {
        url: parsedEnv.DATABASE_URL,
        poolMax: parsedEnv.DB_POOL_MAX,
    },

    smtp: {
        host: parsedEnv.SMTP_HOST,
        port: parsedEnv.SMTP_PORT,
        secure: parsedEnv.SMTP_SECURE,
        user: parsedEnv.SMTP_USER,
        pass: parsedEnv.SMTP_PASS,
        from: parsedEnv.SMTP_FROM || (parsedEnv.SMTP_USER ? `SmartBusiness <${parsedEnv.SMTP_USER}>` : "noreply@smartbusiness.com"),
    },

    portalLoginUrl: parsedEnv.PORTAL_LOGIN_URL,
} as const;