# Frontend v1 Design

**Date:** 2026-05-15  
**Scope:** BattleList + BattleDetail pages, deployed to HK server

## Overview

React + TypeScript + Vite SPA. Two pages: match history list and single-match scoreboard. No routing library — navigation handled via React state. No UI component library — plain CSS with Valorant-inspired dark theme.

## Component Structure

```
App.tsx
  Sidebar            — left nav, highlights active page
  BattleList         — fetches /api/battles, renders match cards
  BattleDetail       — fetches /api/battles/{id}, renders scoreboard
```

`App.tsx` holds two state values: `page: 'list' | 'detail'` and `selectedMatchId: string | null`. Clicking a match card sets both; clicking the back button resets to `'list'`.

## Pages

### BattleList

Fetches `GET /api/battles?limit=50` on mount. Renders one card per match:

- **Left border:** green `#5cb85c` for win, red `#d9534f` for loss, gray `#555` for deathmatch
- **Columns:** Win/Loss badge + map name · queue badge · K / D / A · ACS (dash if null) · RR change (hidden for non-competitive) · relative time ("今天 17:41")
- Clicking a card navigates to BattleDetail

Loading state: skeleton rows. Error state: inline message.

### BattleDetail

Fetches `GET /api/battles/{match_id}` on mount. Layout:

- **Header:** ← back button · map name · win/loss · queue · duration · RR change
- **Scoreboard:** two sections for each team (skipped for deathmatch), sorted by ACS desc
  - Columns: player name (+ MVP badge) · K/D/A · ACS · HS% · damage
  - Current user's row highlighted (matched by the `name` field containing "Edmund")
- Character IDs displayed as-is for now (UUID); mapping to agent names is future work

## Sidebar

Fixed-width `130px`. Links: 对局记录 (active), 英雄统计 (disabled/greyed for now). Logo text "VATRACK" in accent red.

## Theme

```css
--bg:        #0f1923
--surface:   #131f2e
--sidebar:   #111c27
--border:    #1e2d3d
--accent:    #ff4655
--win:       #5cb85c
--loss:      #d9534f
--text:      #ffffff
--muted:     #4a5568
```

All colors defined as CSS custom properties on `:root` in `index.css`. No external CSS framework.

## API Client

`src/api/client.ts` already has axios configured with `VITE_API_URL`. Add typed helper functions:

```ts
export const getBattles = (limit = 50) => client.get('/battles', { params: { limit } })
export const getBattle  = (id: string)  => client.get(`/battles/${id}`)
```

## Deployment

1. Create `frontend/.env.production`: `VITE_API_URL=http://64.90.21.168/api`
2. `npm run build` → outputs to `frontend/dist/`
3. `dist/` committed to git, deployed via post-receive hook alongside backend
4. Nginx serves `frontend/dist/` at `/` (new location block added to server config)

The post-receive hook runs `npm ci && npm run build` in `frontend/` before restarting the backend service.

## Out of Scope (v1)

- Agent name mapping (character UUIDs shown raw)
- AgentStats page (sidebar link disabled)
- Pagination (limit=50 is enough for now)
- Mobile layout
- Auth / user switching
