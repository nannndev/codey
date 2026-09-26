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

