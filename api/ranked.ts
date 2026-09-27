import { dispatch } from './_lib/dispatch.js';
import challenge from './_lib/routes/ranked-challenge.js';
import start from './_lib/routes/ranked-start.js';
import submit from './_lib/routes/ranked-submit.js';

/** POST /api/ranked/challenge, /api/ranked/start and /api/ranked/submit. */
export default dispatch('ranked', { challenge, start, submit });
