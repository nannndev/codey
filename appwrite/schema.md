# Codey Appwrite Schema

Use these exact IDs by default.

## `profiles`

Document ID: Appwrite user ID.

| Attribute | Type | Required | Size/default |
| --- | --- | --- | --- |
| `githubUsername` | string | no | 100 |
| `displayName` | string | no | 160 |
| `avatarUrl` | URL | no | - |
| `currentStreak` | integer | yes | default `0`, min `0` |
| `bestStreak` | integer | yes | default `0`, min `0` |
| `lastActiveDate` | datetime | no | - |

Permissions:

- Read: `any`
- Update/Delete: the owning user
- Create: authenticated users, or a server function that provisions profiles

Indexes:

- Unique key on `githubUsername`

## `runs`

| Attribute | Type | Required |
| --- | --- | --- |
| `userId` | string (36) | yes |
| `sessionId` | string (36) | no |
| `language` | string (64) | yes |
| `mode` | enum: `snippet`, `timed`, `zen` | yes |
| `snippetLength` | string (10): `short`, `medium`, `long` | no |
| `targetChars` | integer | no |
| `speedTrace` | string (400) | no |
| `durationMs` | integer | yes |
| `durationSeconds` | integer | no |
| `wpm` | float | yes |
| `rawWpm` | float | yes |
| `accuracy` | float | yes |
| `consistency` | float | yes |
| `correctChars` | integer | yes |
| `keystrokes` | integer | yes |
| `mistakes` | integer | yes |
| `snippetsCompleted` | integer | yes |
| `sourceRepo` | string (255) | no |
| `verified` | boolean | yes, default `false` |

Permissions:

- Read verified leaderboard documents: `any`
- Read private/unverified documents: owning user
- Create/update verified documents: server API key only

Indexes:

- `userId`, `$createdAt` descending
- `language`, `mode`, `snippetLength`, `accuracy`, `wpm` descending
- `language`, `mode`, `durationSeconds`, `accuracy`, `wpm` descending

Every leaderboard is scoped to one language, so the two composite indexes above
cover all boards. `accuracy` is part of each index because ranked runs are
filtered by the accuracy floor before ordering by `wpm`.

`targetChars` records how long a snippet run actually was. The client only ranks
a run when that length falls inside the bounds its `snippetLength` category
guarantees, which keeps a "medium" score comparable to another "medium" score.

`speedTrace` is the run's pace over time as up to 16 comma-separated WPM values,
drawn as bars on the share card. It is optional: add it with
`npm run setup:share`; until then runs are stored without it.

## `run_sessions`

| Attribute | Type | Required |
| --- | --- | --- |
| `userId` | string (36) | yes |
| `challenge` | string (255) | yes |
| `mode` | enum: `snippet`, `timed`, `zen` | yes |
| `language` | string (64) | yes |
| `durationSeconds` | integer | no |
| `expiresAt` | datetime | yes |
| `completedAt` | datetime | no |

Permissions:

- Read: owning user
- Create/update/delete: server API key only

Indexes:

- Unique key on `challenge`
- `userId`, `$createdAt` descending

## `keyboard_stats`

Document ID: Appwrite user ID. This collection stores aggregate key metrics only;
raw key order and typed content never leave the browser.

| Attribute | Type | Required |
| --- | --- | --- |
| `userId` | string (36) | yes |
| `statsJson` | longtext | yes |
| `processedBatchIds` | string (8000) | yes |
| `updatedAt` | datetime | yes |

Permissions:

- Read: owning user
- Create/update/delete: server API key only

No index is required because each user document is fetched directly by its document ID.

## `daily_challenges`

Both daily collections can be created with `npm run setup:daily` (see `appwrite/README.md`).


Document ID: the UTC date, `YYYY-MM-DD`. The first request of the day picks a
snippet live from GitHub (the same pipeline as `/api/snippets`) and creates this
document; every later request reads it, so all players type identical code.
Nothing is created if GitHub has no usable snippet, and the next request retries.

| Attribute | Type | Required |
| --- | --- | --- |
| `date` | string (10) | yes |
| `language` | string (64) | yes |
| `code` | string (4000) | yes |
| `filename` | string (255) | yes |
| `sourceRepo` | string (255) | yes |
| `sourceUrl` | string (512) | yes |

Permissions:

- Read: `any`
- Create/update/delete: server API key only

No index is required; documents are fetched by ID.

## `daily_runs`

One document per player per day holding their best verified run. Document ID:
first 32 hex characters of `sha256("<date>:<userId>")`.

| Attribute | Type | Required |
| --- | --- | --- |
| `date` | string (10) | yes |
| `userId` | string (36) | yes |
| `language` | string (64) | yes |
| `wpm` | float | yes |
| `rawWpm` | float | yes |
| `accuracy` | float | yes |
| `durationMs` | integer | yes |
| `mistakes` | integer | yes |
| `keystrokes` | integer | yes |
| `attempts` | integer | yes |
| `bestAt` | datetime | yes |

Permissions:

- Read: `any`
- Create/update/delete: server API key only

Indexes:

- `date`, `wpm` descending (daily board and rank)
- `userId`, `date` descending (streaks)

Daily attempts reuse `run_sessions`: `/api/daily/start` creates a session whose
`challenge` is `sha256("daily:<date>:<userId>:<sessionId>")`, which binds the
attempt to one player and one day. `/api/daily/submit` checks it, closes the
session, and applies the same accuracy, WPM and timing checks as Ranked.


## `duel_rooms`

Directory of public duel rooms. Races stay peer to peer; this only lists rooms
that are waiting for players. Document ID: the room code (`CODEY-XXXXXX`).
Written only by `/api/duel/rooms` with the server key. Create it with
`npm run setup:duel`.

| Attribute | Type | Required |
| --- | --- | --- |
| `code` | string (12) | yes |
| `hostId` | string (36) | yes |
| `hostName` | string (64) | yes |
| `language` | string (64) | yes |
| `mode` | string (16): `snippet`, `timed` | yes |
| `detail` | string (32), e.g. `medium` or `30s` | yes |
| `players` | integer | yes |
| `maxPlayers` | integer | yes |
| `status` | string (16): `lobby`, `racing` | yes |
| `custom` | boolean | yes |
| `heartbeatAt` | datetime | yes |

Permissions: read `any`; no client writes.

Indexes:

- Key on `heartbeatAt` (desc)
- Key on `hostId`

Hosts refresh their listing about every 20 seconds; listings older than 50
seconds are hidden and ones older than 10 minutes are deleted on read.

## `challenges`

"Challenge a friend" links (`/c/<id>`). A signed-in player saves a finished
snippet run with its exact code; anyone with the link types the same snippet
against that score. Create it with `npm run setup:challenges`.

Collection permissions: read `any`, create `users`; document security off, so
nobody can edit or delete a challenge once it exists.

| Attribute | Type | Required |
| --- | --- | --- |
| `userId` | string (36) | yes |
| `name` | string (64) | yes |
| `username` | string (64) | no |
| `language` | string (64) | yes |
| `code` | string (16000) | yes |
| `filename` | string (256) | no |
| `sourceRepo` | string (200) | no |
| `sourceUrl` | string (500) | no |
| `wpm` | float | yes |
| `accuracy` | float | yes |

Index: `by_user` on `userId`.

## Weekly leagues, friends and push

Created with `npm run setup:social`. Every collection below is server-only
(no client permissions); the app reaches them through `/api/social/*` and
`/api/push/*`, which use the server API key.

### `league_players`

One per player (document id = user id): `division` (0 Bronze … 3 Diamond),
the `week` and `groupId` they are playing this week, last week's settlement
(`lastWeek`, `lastResult` up/down/stay, `lastRank`, `lastDivision`),
`bestDivision`, and the daily XP cap counter (`xpDate`, `xpToday`).

A finished week is settled the first time the player is seen in a new week:
top 5 of the group move up, bottom 5 move down (groups of 10 or more).

### `league_groups`

`week`, `division`, `number`, `size`. Groups hold up to 30 players; id
`<week>-<division>-<number>`. Index: `week`, `division`, `size`, `number`.

### `league_members`

One per player per week (id `<week>_<userId>`): `week`, `groupId`, `userId`,
`division`, `xp`, and the display `name`, `username`, `avatarUrl`.
Indexes: `groupId` + `xp` desc, `userId`.

### `league_xp`

One per run counted towards a league (document id = the run's id), so a run
never earns XP twice: `userId`, `week`, `xp`.

### `follows`

One-way follows, id = hash of follower and followee: `followerId`,
`followeeId`. Indexes on each.

### `push_subscriptions`

One per browser (id = hash of the endpoint): `userId`, `endpoint`, `p256dh`,
`auth`, `streak` and `league` opt-ins, and `tzOffset` (minutes east of UTC).
Indexes: `userId`, `streak`.

Push needs these Vercel environment variables (`npm run setup:push-keys`
prints a fresh set): `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
and `CRON_SECRET`. The daily streak reminder runs from Vercel Cron at 12:00 UTC.
