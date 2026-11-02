# Little Joy Arcade integration

Hexodus is a standalone game that plugs into <https://littlejoyarcade.site>
without a build-time dependency on the platform.

## What is wired today

| Piece | Status |
| --- | --- |
| Arcade listing | Manifest in the portal catalogue (`games.ts`) and the `games` table |
| Subdomain | `hexodus.littlejoyarcade.site` → GitHub Pages project site |
| Account panel + cloud mirror | `public/arcade-client.js` (drop-in SDK client) |
| Local saves | `localStorage['hexodus-save-v1']`, always written first |
| Achievements | Ten in-game achievements, saved locally |
| Entitlements | Read by the arcade client, **not** enforced by Hexodus yet |
| Payments | None. No checkout, no products sold |
| Ads | None in game |

## The drop-in client

`index.html` loads the client after the game module:

```html
<script src="./arcade-client.js" data-game-id="hexodus"></script>
```

It adds a small account panel (create account, sign in, sync, sign out), refreshes
sessions, and mirrors Web Storage keys into `game_progress` in Supabase. The
public anon key inside the file is safe to ship; row-level security protects the
data. Because the game keeps a single JSON save under `hexodus-save-v1`, the
mirror needs no game-specific code — a signed-in player's board unlocks and stars
follow them to another device after the next sync.

Save shape (see `src/progress.js`):

```json
{
  "version": 1,
  "unlocked": 13,
  "stars": { "1": 3, "2": 2 },
  "daily": { "2026-11-02": { "stars": 3 } },
  "achievements": ["first_ray", "flawless"],
  "totalCleared": 12,
  "tilesCleared": 240,
  "zenCleared": 4,
  "classicBest": 3,
  "streak": { "last": "2026-11-02", "count": 2 },
  "settings": { "sound": true, "theme": "candy", "reducedMotion": false },
  "completedJourney": false
}
```

`normalizeSave` repairs anything missing, so the client can hand back an older or
partial save without breaking the game.

## Offline behaviour

The game never waits on the network: `loadSave()` reads storage synchronously and
`record()` writes it synchronously. The arcade client's sync is best-effort. If
the backend is unreachable, play continues and the local save remains
authoritative until a later sync.

## Entitlements and the store (not enabled)

The intended identifiers are:

- `arcade.ad_free`
- `hexodus.ad_free`
- `hexodus.premium_themes`
- `hexodus.puzzle_pack_1`

None are required to play, and Hexodus does not read them yet. When the arcade
store goes live, the safe pattern is:

1. Server grants entititlements after verified payment (never the client).
2. Hexodus asks the arcade client for entitlements at boot.
3. Ad-free only changes whether ads render; it must never gate progress.
4. Premium themes unlock through the same check; the four built-in themes stay
   free.

There is no ad code in this build. Ad slots, when added, belong on menus or the
completion screen — never during active play.

## Publishing a new Hexodus build

1. Push to `main`; the Pages workflow runs tests, builds, and deploys.
2. The arcade catalogue entry's `playUrl` points at `/play/`, which the workflow
   creates by copying the build.
3. Version and download links are refreshed by the portal's release sync when a
   GitHub release exists.
