import { adminDatabases, applyCors, authenticateUser, isConfigured, readBody, type ApiRequest, type ApiResponse } from './appwrite-admin.js';

/**
 * Boilerplate for small JSON routes: CORS, method check, configuration and
 * (optionally) the signed-in player. Errors with a 4xx `code` are shown to the
 * player; anything else is logged and reported as unavailable.
 */

export interface RouteContext<Body> {
  req: ApiRequest;
  user: { id: string; name: string } | null;
  body: Partial<Body>;
  query: (key: string) => string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
}

export function route<Body = Record<string, unknown>>(
  method: 'GET' | 'POST',
  options: { auth: 'required' | 'optional' | 'none'; label: string },
  handle: (context: RouteContext<Body>) => Promise<unknown>,
) {
  return async (req: ApiRequest, res: ApiResponse) => {
    applyCors(res, method);
    if (req.method === 'OPTIONS') return void res.status(200).json({ ok: true });
    if (req.method && req.method !== method) return void res.status(405).json({ error: 'Method not allowed.' });
    if (!isConfigured()) return void res.status(503).json({ error: `${options.label} is not configured.` });
    const user = options.auth === 'none' ? null : await authenticateUser(req.headers);
    if (options.auth === 'required' && !user) return void res.status(401).json({ error: 'Sign in with GitHub first.' });
    const query = (key: string) => {
      const value = req.query[key];
      return (Array.isArray(value) ? value[0] : value) ?? '';
    };
    try {
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json(await handle({ req, user, body: readBody<Body>(req), query, db: adminDatabases() }));
    } catch (error) {
      const code = (error as { code?: number }).code;
      if (code && code >= 400 && code < 500 && error instanceof Error) return void res.status(code).json({ error: error.message });
      console.error(`${options.label} failed:`, error);
      res.status(503).json({ error: `${options.label} is unavailable right now. Try again shortly.` });
    }
  };
}
