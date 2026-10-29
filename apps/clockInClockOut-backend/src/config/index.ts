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

    redis: {
        url: parsedEnv.REDIS_URL,
    },

    portalLoginUrl: parsedEnv.PORTAL_LOGIN_URL,
    faceRecognitionApiUrl: parsedEnv.FACE_RECOGNITION_API_URL,
    aws: {
        region: parsedEnv.AWS_REGION,
        accessKeyId: parsedEnv.AWS_ACCESS_KEY_ID,
        secretAccessKey: parsedEnv.AWS_SECRET_ACCESS_KEY,
        bucketName: parsedEnv.AWS_S3_BUCKET_NAME,
    },
} as const;