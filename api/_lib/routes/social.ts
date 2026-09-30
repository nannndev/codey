import { route } from '../route.js';
import { awardRun } from '../league.js';
import { feed, follow, friendsBoard, leagueView, memberProfile, relation, search, unfollow, USER_ID } from '../social.js';
import { notifyUsers, overtakeMessage } from '../push.js';

const RUN_ID = /^[A-Za-z0-9._-]{1,36}$/;
const badRequest = (message: string) => Object.assign(new Error(message), { code: 400 });

/** GET /api/social/league: your division, this week's group and last week's result. */
export const league = route('GET', { auth: 'required', label: 'The league' }, ({ db, user }) => leagueView(db, user!.id));

/** POST /api/social/xp { runId }: counts a stored run towards this week's league. */
export const xp = route<{ runId: string }>('POST', { auth: 'required', label: 'League XP' }, async ({ db, user, body }) => {
  const runId = String(body.runId ?? '');
  if (!RUN_ID.test(runId)) throw badRequest('Unknown run.');
  const profile = await memberProfile(db, user!.id, user!.name);
  const award = await awardRun(db, user!.id, runId, profile);
  if (!award) return { gained: 0 };
  if (award.overtaken.length) {
    // Best effort: a failed push never costs the player their XP.
    await notifyUsers(db, award.overtaken, 'league', overtakeMessage(profile.name, award.division)).catch((error) => console.warn('League push failed:', error));
  }
  return { gained: award.gained, weekXp: award.weekXp, division: award.division };
});

const target = (value: unknown) => {
  const id = String(value ?? '');
  if (!USER_ID.test(id)) throw badRequest('Unknown player.');
  return id;
};

export const followRoute = route<{ userId: string }>('POST', { auth: 'required', label: 'Following' }, ({ db, user, body }) => follow(db, user!.id, target(body.userId)));
export const unfollowRoute = route<{ userId: string }>('POST', { auth: 'required', label: 'Following' }, ({ db, user, body }) => unfollow(db, user!.id, target(body.userId)));
/** GET /api/social/relation?userId=: follower counts, and whether you follow them. */
export const relationRoute = route('GET', { auth: 'optional', label: 'Profiles' }, ({ db, user, query }) => relation(db, user?.id ?? null, target(query('userId'))));
export const friends = route('GET', { auth: 'required', label: 'Friends' }, ({ db, user }) => friendsBoard(db, user!.id));
export const feedRoute = route('GET', { auth: 'required', label: 'The feed' }, ({ db, user }) => feed(db, user!.id));
export const searchRoute = route('GET', { auth: 'optional', label: 'Search' }, ({ db, user, query }) => search(db, user?.id ?? null, query('q')));
