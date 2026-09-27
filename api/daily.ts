import { dispatch } from './_lib/dispatch.js';
import today from './_lib/routes/daily-today.js';
import start from './_lib/routes/daily-start.js';
import submit from './_lib/routes/daily-submit.js';

/** GET /api/daily, POST /api/daily/start, POST /api/daily/submit. */
export default dispatch('daily', { '': today, start, submit });
