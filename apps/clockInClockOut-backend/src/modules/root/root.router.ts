import express from 'express';

// Controller
import { root, healthCheck } from './root.controller';

const router  = express.Router();

router.get('/',         root);
router.get('/health',   healthCheck);

export { router as rootRouter };