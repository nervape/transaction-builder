import Router from 'koa-router';
import { returnHandler } from './controllers/return';
import { forgeHandler } from './controllers/forge';

const router = new Router();

router.post('/return', returnHandler);
router.post('/forge', forgeHandler);

export default router;
