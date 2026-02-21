# AYAU App — Roadmap & Working Document

> **How to use this file:** This is the single source of truth across all machines.
> Read "Next Up" first, then the session log to understand context.

---

## Next Up (start here on any machine)

**Immediate priority (MVP focus):**

1. **App features** — in active development, prioritize product over tooling

**When ready to revisit infrastructure:**
- GitHub Actions CI — deferred (Vercel already deploys, solo dev, `npm run test:run` locally is enough)
- Expand test coverage — add tests as new service functions are added

---

## Session Log

### Session 2026-02-20
**Completed:**
- ✅ `.gitignore` — added `coverage/`, `.vercel/`, `*.tsbuildinfo`, `.env.*.local`, `.claude/`
- ✅ `.env.example` — created template file for onboarding new devs
- ✅ `eslint.config.js` — created (ESLint was installed but broken without config)
- ✅ **Bug fix** `UserManager.jsx:1215` — removed dangling JSX copy-paste fragment (was a parse error)
- ✅ Packages updated: `@eslint/js`, `@mui/*`, `@types/react*`, `eslint`, `eslint-plugin-react-refresh`, `lucide-react`, `music-metadata`
- ✅ `@tailwindcss/vite` — pinned to `4.1.18` (4.2.0 has native binding bug on this machine, skip until fixed upstream)
- ✅ Docs: `DOCUMENTATION-INDEX.md` updated with ROADMAP entry, `README.md` refreshed, guide dates corrected
- ✅ Confirmed `.env.local` was already NOT tracked by git (TD-01 resolved)

**Skipped (intentional):**
- `eslint-plugin-react-hooks` → 7.x (major bump, needs validation)
- `globals` → 17.x (major bump, needs validation)

### Session 2026-02-21
**Completed:**
- ✅ **Testing infrastructure** (Vitest + Testing Library)
  - Installed: `vitest`, `@vitest/coverage-v8`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`
  - `vite.config.js` extended with `test:` block (jsdom env, setup file, coverage config)
  - Added `npm run test`, `npm run test:run`, `npm run test:coverage` scripts
  - `src/test/setup.js` — imports `@testing-library/jest-dom` matchers
  - `src/test/supabase-api.test.js` — 22 tests covering `isAdmin`, `isManagerOrAdmin`, `getUserRole`, `getAllUsers`, `getSignedUrl`, `createPlaylist`, `recordPlay`; uses `vi.hoisted()` for mock functions
  - `src/test/ErrorBoundary.test.jsx` — 4 tests: renders children, shows fallback, hides fallback, reload button
  - **Result: 26/26 tests passing**
- ✅ **Error Boundary** (`src/components/ErrorBoundary.jsx`)
  - Created class component with MUI fallback UI (icon + message + reload button, in Spanish)
  - Wrapped entire app in `src/App.jsx` — catches any render crash before blank screen
- ✅ **Logger utility** (`src/utils/logger.js`)
  - `logger.log` is a no-op in production (`import.meta.env.PROD`), `logger.warn/error` always surface
  - Replaced all `console.log` calls: `MusicPlayer.jsx` (1) and `AnalyticsDashboardV2.jsx` (34)
  - ESLint `no-console` warnings drop from 63 → 0 for `console.log`
- ✅ **Security Advisor — 24 Security Definer View errors** (`database/fix-security-definer-views.sql`)
  - Created migration using a DO block that safely skips views not yet deployed
  - Sets `security_invoker = true` on all analytics, royalty, and playlist views
  - Verified via `pg_class.reloptions` — all affected views now show `["security_invoker=true"]`
  - Re-run Security Advisor to confirm 0 errors remaining

### Session 2026-02-20 (continued)
**Completed:**
- ✅ **Bug fix — Password Reset** (`src/pages/PasswordReset.jsx`)
  - Root cause: was reading `?token=` from query string; Supabase sends token in URL **hash** (`#access_token=...&type=recovery`)
  - Replaced entire custom SQL token flow (`request_password_reset`, `validate_reset_token`, `complete_password_reset` RPCs) with Supabase native auth:
    - `supabase.auth.resetPasswordForEmail(email, { redirectTo })` for sending the email
    - `supabase.auth.onAuthStateChange` watching for `PASSWORD_RECOVERY` to detect the recovery session
    - Hash param fast-path check (`window.location.hash`) in case event fires before component mounts
    - `supabase.auth.updateUser({ password })` to set the new password
    - `supabase.auth.signOut()` after success so user logs in fresh
- ✅ **Sync Playback seek position** (`src/context/SyncPlaybackContext.jsx:261`)
  - Completed the TODO — `applyRemoteState` now dispatches `SYNC_SEEK` when remote `playback_position` differs from local by >3 seconds
  - Uses existing `SYNC_SEEK` action already wired in `PlayerContext.jsx`
  - `playback_position` column (seconds) already exists in `playback_sessions` table

---

## Current State Snapshot

| Area | Status | Notes |
|------|--------|-------|
| Core player | ✅ Working | Spectrum visualizer, resume, URL auto-renewal |
| Admin panel | ✅ Working | Full CRUD for users, songs, playlists, accounts |
| Auth / RBAC | ✅ Working | Supabase Auth + 4 roles + force-password flow |
| Analytics | ✅ Working | Recharts dashboard, royalty tracking |
| DB security | ✅ Fixed | 24 Security Definer View errors resolved (security_invoker=true) |
| Sync playback | ✅ Seek fixed | `applyRemoteState` dispatches `SYNC_SEEK` when >3s off |
| ESLint | ✅ Configured | `eslint.config.js` created, 0 errors / 63 warnings |
| Env security | ✅ Safe | `.env.local` not in git, `.env.example` added |
| `.gitignore` | ✅ Complete | Covers `coverage/`, `.vercel/`, `.claude/`, etc. |
| Packages | ✅ Up to date | Minor/patch updated. 2 major skips intentional (see log) |
| Test coverage | ✅ Started | Vitest configured, 26 tests passing (service layer + ErrorBoundary) |
| Error boundaries | ✅ Done | `ErrorBoundary.jsx` wraps App — friendly crash screen |
| Structured logging | ✅ Done | `logger.js` — no-ops in prod, 0 `console.log` remaining |
| Vercel deploy | ✅ Working | Auto-deploys on push to main |
| GitHub Actions CI | ⏳ Deferred | Solo MVP dev — Vercel covers deploy, run tests locally |

---

## Priority 1 — Pre-Production Fixes

### 1.1 Environment Variable Security ✅ DONE
- `.env.local` confirmed not tracked by git
- `.gitignore` updated with comprehensive patterns
- `.env.example` created as onboarding template
- Production: set vars in Vercel dashboard, never in repo

### 1.2 Global Error Boundary ❌ TODO
- **Problem:** Unhandled render error → blank screen for users.
- **Files:** Create `src/components/ErrorBoundary.jsx`, update `src/App.jsx`
- **Pattern:**
  ```jsx
  // src/components/ErrorBoundary.jsx
  class ErrorBoundary extends React.Component {
    state = { hasError: false }
    static getDerivedStateFromError() { return { hasError: true } }
    render() {
      if (this.state.hasError) return <FallbackUI />
      return this.props.children
    }
  }
  // src/App.jsx — wrap router with <ErrorBoundary>
  ```

### 1.3 Complete Sync Playback ✅ DONE
- Seek position now synced: `applyRemoteState` dispatches `SYNC_SEEK` when remote `playback_position` differs from local by >3 seconds.
- `playback_position` (seconds) already existed in `playback_sessions` table; `SYNC_SEEK` action already existed in `PlayerContext.jsx`.

---

## Priority 2 — Testing Infrastructure

No tests exist. Without them, every change is a potential regression.

### 2.1 Unit Tests (Vitest) ❌ TODO
- Install: `vitest`, `@testing-library/react`, `@testing-library/user-event`, `jsdom`
- Configure in `vite.config.js`:
  ```js
  test: { environment: 'jsdom', globals: true }
  ```
- Start with: `src/utils/musicPlayer.js`, `src/services/supabase-api.js` (mock Supabase client)
- Target: 60% coverage of service layer

### 2.2 Component Tests ❌ TODO
- Priority: `MusicPlayer.jsx`, `Login.jsx`, `ForcePasswordChangeModal.jsx`
- Use `@testing-library/react` with mocked context providers

### 2.3 End-to-End Tests (Playwright) ❌ TODO
- Critical paths: Login → playlist → play, admin upload flow, force password change

---

## Priority 3 — Code Quality

### 3.1 Break Down Large Components ❌ TODO

| File | LOC | Suggested Split |
|------|-----|-----------------|
| `UserManager.jsx` | ~1,434 | `UserTable`, `UserForm`, `UserPermissions`, `UserFilters` |
| `AnalyticsDashboardV2.jsx` | ~1,312 | `MetricCards`, `PlayChart`, `RoyaltyTable`, `FilterBar` |
| `SongManager.jsx` | ~1,172 | `SongTable`, `SongUploadForm`, `BulkUploadDialog`, `SongMetaEditor` |

### 3.2 Structured Logging ❌ TODO
- 63 ESLint warnings mark every `console.log` — use them as the fix list
- **Plan A (quick):** Create `src/utils/logger.js` that no-ops in production:
  ```js
  const isProd = import.meta.env.PROD
  export const logger = {
    log: (...args) => !isProd && console.log(...args),
    warn: (...args) => console.warn(...args),
    error: (...args) => console.error(...args),
  }
  ```
- **Plan B (later):** Add Sentry for production error tracking
- **Recommended order:** Do Plan A now, Plan B after CI/CD is up

### 3.3 ESLint Configuration ✅ DONE
- `eslint.config.js` created with React hooks rules + `no-console` warning
- Run: `npm run lint`

### 3.4 Performance Optimizations ❌ TODO
- `React.memo` on pure presentational components
- `useMemo` in `AnalyticsDashboardV2.jsx` for expensive computations
- Lazy-load admin routes: `React.lazy` + `Suspense` (fixes 1.4MB bundle warning)
- Analyze bundle: `npx vite-bundle-visualizer`

### 3.5 localStorage Hardening ❌ TODO
- 6 uses in resume playback — wrap in try/catch for `QuotaExceededError`
- Validate stored data shape before use

---

## Priority 4 — Dependencies

| Package | Status | Notes |
|---------|--------|-------|
| `@eslint/js` | ✅ 9.39.3 | Updated |
| `@mui/icons-material` | ✅ 7.3.8 | Updated |
| `@mui/material` | ✅ 7.3.8 | Updated |
| `@tailwindcss/vite` | ⚠️ 4.1.18 | Pinned — 4.2.0 native binding bug on this machine |
| `@types/react` | ✅ 19.2.14 | Updated |
| `@types/react-dom` | ✅ 19.2.3 | Updated |
| `eslint` | ✅ 9.39.3 | Updated |
| `eslint-plugin-react-hooks` | ⚠️ 5.2.0 | Latest is 7.x — major bump, skip until tested |
| `eslint-plugin-react-refresh` | ✅ 0.5.0 | Updated |
| `globals` | ⚠️ 15.15.0 | Latest is 17.x — major bump, skip until tested |
| `lucide-react` | ✅ 0.575.0 | Updated |
| `music-metadata` | ✅ 11.12.1 | Updated |

---

## Priority 5 — CI/CD & Deployment

### 5.1 Vercel ✅ Working
- Auto-deploys on push to `main` via Vercel git integration
- Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel dashboard (not in repo)
- **Check SPA routing:** navigate directly to `/admin` on the deployed URL — if Vercel returns 404, add:
  ```json
  { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
  ```
  as `vercel.json` at project root.

### 5.2 GitHub Actions ⏳ Deferred — add when tests exist
- Vercel already handles build + deploy, so Actions only adds value for running tests on PRs.
- Template for when ready:
  ```yaml
  on: [pull_request]
  jobs:
    ci:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with: { node-version: 20 }
        - run: npm ci
        - run: npm run lint
        - run: npm test
        - run: npm run build
  ```

---

## Priority 6 — Feature Improvements (Backlog)

### 6.1 TypeScript Migration
- Start new files as `.tsx`, migrate service layer first
- Add `tsconfig.json`

### 6.2 Offline / PWA
- `vite-plugin-pwa` — cache player shell and last playlist

### 6.3 Accessibility Audit
- Run Lighthouse on all main views
- Keyboard navigation for music player controls

### 6.4 Mobile / Responsive Polish
- Tablet-friendly admin views
- Bottom navigation bar for mobile

### 6.5 Toast Notifications
- MUI `notistack` or custom context
- Events: upload success/fail, song added, user created

---

## Priority 7 — Database & Backend (Backlog)

### 7.1 Canonical Schema ❌ TODO
- 59 migration files, several are `FIX_*` patches
- Create single `database/schema.sql` representing current state
- Keep migration files only for future incremental changes

### 7.2 Storage Cleanup Policy
- Delete unused audio files when songs are removed from the system

### 7.3 RLS Policy Audit
- Verify `client_user` cannot see data from other accounts
- Test against a dedicated Supabase test project

---

## Tech Debt Register

| ID | Area | Description | Severity | Status |
|----|------|-------------|----------|--------|
| TD-01 | Security | `.env.local` in git | Critical | ✅ Resolved |
| TD-02 | Reliability | No error boundaries | High | ❌ Open |
| TD-03 | Quality | No test coverage | High | ❌ Open |
| TD-04 | Completeness | Sync seek not implemented | Medium | ✅ Resolved |
| TD-05 | Maintainability | 3 components >1000 LOC | Medium | ❌ Open |
| TD-06 | Observability | 63 console.log in production code | Medium | ❌ Open |
| TD-07 | Config | ESLint config file missing | Low | ✅ Resolved |
| TD-08 | Performance | No lazy loading for admin routes | Low | ❌ Open |
| TD-09 | Database | 59 migration files, no canonical schema | Low | ❌ Open |
| TD-10 | Dependencies | `react-hooks` + `globals` major versions behind | Low | ⚠️ Deferred |
| TD-11 | Bug | `UserManager.jsx` parse error (dangling JSX) | Medium | ✅ Resolved |
| TD-12 | Bug | Password reset link broken (wrong token location) | High | ✅ Resolved |

---

## Notes for Contributors

- **Admin components:** `src/components/admin/`
- **All Supabase calls** go through `src/services/supabase-api.js` — keep it that way
- **Player state:** `src/context/PlayerContext.jsx` | **Sync state:** `src/context/SyncPlaybackContext.jsx`
- **Database migrations:** `database/` — add new ones as dated files, never edit existing
- **Signed URL renewal:** `MusicPlayer.jsx` — URLs expire 1hr, renewal triggers at 50min
- **ESLint:** `npm run lint` — 0 errors expected, 63 warnings are tracked tech debt (TD-06)
- **Build:** `npm run build` — bundle warning (1.4MB) is expected, tracked as TD-08
- **Tailwind pinned:** `@tailwindcss/vite` at `4.1.18` — do not bump until 4.2.x native binding is fixed
