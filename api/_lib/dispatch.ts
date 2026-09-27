/**
 * One serverless function serving several routes, to stay inside the Vercel
 * Hobby plan's 12 functions. vercel.json rewrites /api/<group>/<action> to
 * /api/<group>?action=<action>; the path is read too, for local servers that
 * skip the rewrite.
 */

interface DispatchRequest {
  url?: string;
  query?: Record<string, string | string[] | undefined>;
}

interface DispatchResponse {
  status: (code: number) => { json: (body: unknown) => void };
}

// Each route declares its own request and response shapes, so they are loosely typed here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Route = (req: any, res: any) => unknown;

export function routeAction(req: DispatchRequest, group: string): string {
  const fromQuery = req.query?.action;
  const action = Array.isArray(fromQuery) ? fromQuery[0] : fromQuery;
  if (action) return action;
  const path = (req.url ?? '').split('?')[0];
  const match = path.match(new RegExp(`/api/${group}/([\\w-]+)/?$`));
  return match ? match[1] : '';
}

export function dispatch(group: string, routes: Record<string, Route>) {
  return (req: DispatchRequest, res: DispatchResponse) => {
    const route = routes[routeAction(req, group)];
    if (!route) return void res.status(404).json({ error: 'Not found.' });
    return route(req, res);
  };
}
