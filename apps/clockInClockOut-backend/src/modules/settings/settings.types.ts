import { z } from "zod";

// Zod Schemas
import { updateSettingsSchema } from "./settings.validator";

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;