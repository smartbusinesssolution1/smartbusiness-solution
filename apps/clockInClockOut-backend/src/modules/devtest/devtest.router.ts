import express from 'express';

// Controller
import { authtest } from './devtest.controller';

const router  = express.Router();

router.get('/auth', authtest);

export { router as devTestRouter };