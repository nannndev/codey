import { dispatch } from './_lib/dispatch.js';
import { config, cron, subscribe, unsubscribe } from './_lib/routes/push.js';

/** Web Push: /api/push/<action>. */
export default dispatch('push', { config, subscribe, unsubscribe, cron });
