import express from "express";

// Controller
import { ctrlGetSettings, ctrlUpdateSettings } from "./settings.controller";

const router  = express.Router();

router.get('/',  ctrlGetSettings);
router.post('/', ctrlUpdateSettings);

export { router as settingsRouter };