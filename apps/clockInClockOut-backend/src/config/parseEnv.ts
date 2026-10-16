import dotenv from "dotenv";
dotenv.config({ override: true });
import { envSchema, type Env } from "./env.schema.js";

function parseEnv(): Env {
    const result = envSchema.safeParse(process.env);

    if (!result.success) {
        console.error("\n\n❌ Environment configuration failed.\n");

        for (const issue of result.error.issues) {
            const path = issue.path.join(".");
            console.error(`   • ${path}: ${issue.message}`);
        }

        console.error("\nRefer src/config/env.schema.ts and update .env accordingly. \nThen try again.");

        process.exit(1);
    }

    return result.data;
}

export const parsedEnv = parseEnv();