import { dispatch } from './_lib/dispatch.js';
import { feedRoute, followRoute, friends, league, relationRoute, searchRoute, unfollowRoute, xp } from './_lib/routes/social.js';

/** Weekly leagues and friends: /api/social/<action>. */
export default dispatch('social', {
  league,
  xp,
  follow: followRoute,
  unfollow: unfollowRoute,
  relation: relationRoute,
  friends,
  feed: feedRoute,
  search: searchRoute,
});
