# AYAU — Technical Architecture

> Version: 2.0 (Post-migration: Supabase + Vercel)
> Last updated: March 2026

---

## 1. System Overview

AYAU is a **multi-tenant music streaming and management platform** designed for hospitality businesses (restaurants, bars, entertainment venues). It enables precise royalty tracking, centralized content management, and real-time synchronized playback across multiple physical locations.

**Core design goals:**
- Multi-tenant: one platform serving multiple independent clients (companies) and their venues
- Royalty-accurate: every second of audio is tracked per song, per location, per country
- Real-time: synchronized playback across venues with sub-second latency
- Secure: row-level security, signed URLs, JWT auth — zero data leakage between tenants

---

## 2. Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Frontend framework | React | 19.0 | UI rendering |
| Build tool | Vite | 6.2 | Dev server + production bundler |
| Routing | React Router DOM | 6.30 | SPA client-side routing |
| UI library | Material-UI (MUI) | 7.3 | Component library |
| CSS utilities | Tailwind CSS | 4.1 | Layout and spacing |
| Icons | MUI Icons + Lucide React | — | UI iconography |
| Charts | Recharts | 3.7 | Analytics dashboards |
| Audio engine | HTML5 Audio + Web Audio API | native | Playback + spectrum analysis |
| State management | React Context + useReducer | native | Global player + sync state |
| Backend / Database | Supabase (PostgreSQL) | 2.78 | Data persistence + auth |
| Real-time | Supabase Realtime | — | WebSocket sync for DJ Mode |
| File storage | Supabase Storage | — | Audio files + cover images |
| Authentication | Supabase Auth (JWT) | — | Session management |
| Edge Functions | Deno / TypeScript | — | Serverless user management |
| Deployment | Vercel | — | Frontend hosting + CDN |
| Testing | Vitest + Testing Library | 3.2 | Unit + component tests |

---

## 3. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER BROWSER (Vercel CDN)                    │
│                                                                  │
│   ┌──────────────┐   ┌──────────────────┐   ┌──────────────┐   │
│   │  Login /     │   │  HomePage        │   │  Admin       │   │
│   │  Password    │   │  (Streaming UI)  │   │  Panel       │   │
│   │  Reset       │   │                  │   │  /admin/*    │   │
│   └──────────────┘   └──────────────────┘   └──────────────┘   │
│                              │                                   │
│          ┌───────────────────┼───────────────────┐              │
│          ▼                   ▼                   ▼              │
│   ┌─────────────┐   ┌──────────────────┐                       │
│   │  Player     │   │  SyncPlayback    │                       │
│   │  Context    │◄──│  Context         │                       │
│   │  (audio +   │   │  (DJ Mode +      │                       │
│   │   playlist) │   │   realtime sync) │                       │
│   └─────────────┘   └──────────────────┘                       │
│          │                   │                                   │
│          └────────┬──────────┘                                  │
│                   ▼                                              │
│          ┌────────────────┐                                      │
│          │ supabase-api.js│  (API Service Layer)                │
│          └────────────────┘                                      │
└───────────────────┬─────────────────────────────────────────────┘
                    │ HTTPS / WSS
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                       SUPABASE PLATFORM                         │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  PostgreSQL (RLS enabled on all tables)                  │  │
│  │  clients · locations · user_profiles · playlists        │  │
│  │  songs · playlist_songs · play_history                   │  │
│  │  playback_sessions · stream_analytics_monthly            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────────┐  │
│  │  Supabase Auth │  │  Realtime      │  │  Storage         │  │
│  │  (JWT + email) │  │  (WebSockets)  │  │  songs/ covers/  │  │
│  └────────────────┘  └────────────────┘  └──────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────┐                       │
│  │  Edge Functions (Deno)               │                       │
│  │  supabase/functions/invite-user/     │                       │
│  └──────────────────────────────────────┘                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Data Model

### 4.1 Entity Relationships

```
auth.users (Supabase managed)
    │ 1:1
    ▼
user_profiles
    ├── role: admin | manager | user
    ├── access_level: account | location
    ├── client_id ──────────────────────► clients
    └── location_id ────────────────────► locations

clients (companies / restaurants)
    ├── playback_mode: independent | shared_playlist | synchronized
    │
    └── 1:N
        ▼
    locations (venues / branches)

playlists ◄──────── M:N ──────────► songs
    (via playlist_songs junction table with position ordering)

play_history
    ├── user_id ──► auth.users
    ├── song_id ──► songs
    ├── playlist_id ──► playlists
    ├── location_id ──► locations
    └── client_id ──► clients

playback_sessions (one per client, UNIQUE on client_id)
    ├── client_id ──► clients
    ├── current_song_id ──► songs
    ├── controlled_by ──► user_profiles
    └── sequence_number (for realtime ordering)

stream_analytics_monthly
    └── pre-aggregated from play_history (nightly job)
```

### 4.2 Core Tables

**`clients`** — Companies / restaurant groups
```
id, name, contact_email, contact_phone, tax_id, is_active
playback_mode (independent | shared_playlist | synchronized)
```

**`locations`** — Individual venues / branches
```
id, client_id, name, address, city, country_code, is_active, manager_id
```

**`user_profiles`** — Extended user info (mirrors auth.users)
```
id, email, full_name
role: admin | manager | user
access_level: account | location
client_id, location_id
is_active, created_at
```

**`songs`** — Music catalog with royalty metadata
```
id, title, performer, author, album
duration (seconds — critical for royalty calculations)
file_url, cover_image_url (storage paths)
isrc, iswc, ipi, code (royalty identifiers)
genre, release_year, label, version
```

**`playlists`** — Music collections
```
id, name, description, cover_image_url, is_public
```

**`playlist_songs`** — Playlist ↔ Song junction
```
playlist_id, song_id, position (ordering)
```

**`play_history`** — Royalty tracking log (every play event)
```
id, user_id, song_id, playlist_id, location_id, client_id
stream_duration (INTEGER — seconds played)
valid_for_royalties (stream_duration > 30)
completed (stream_duration > 50% of song duration)
country_code, played_at
```

**`playback_sessions`** — DJ Mode sync state (one per client)
```
id, client_id (UNIQUE)
playback_mode, is_centralized
current_song_id, current_playlist_id
playback_state (playing | paused | stopped)
playback_position, volume
controlled_by, sequence_number, updated_at
```

**`stream_analytics_monthly`** — Pre-aggregated reporting
```
song_id, year, month
total_streams, total_valid_streams, total_completed_streams
total_seconds_played, unique_listeners
seconds_by_country (JSONB)
```

---

## 5. Frontend Architecture

### 5.1 Component Tree

```
App.jsx (router + auth state)
│
├── /  →  HomePage
│         ├── Header (logo, settings, queue indicator)
│         ├── PlaylistSidebar (slide-in)
│         │   └── PlaylistCard × N
│         ├── Center (cover art, now playing)
│         ├── Queue Panel (upcoming songs)
│         ├── MusicPlayer (footer)
│         │   ├── Seek bar + time display
│         │   ├── Play/Pause/Prev/Next controls
│         │   ├── Volume slider
│         │   ├── EQ Spectrum Visualizer (canvas, RAF)
│         │   └── SyncStatusIndicator (DJ Mode)
│         └── DJModePanel (fixed, synchronized mode only)
│
├── /password-reset  →  PasswordReset (2-step flow)
│
└── /admin/*  →  AdminLayout (ProtectedAdminRoute guard)
               ├── /admin           →  AdminDashboard
               ├── /admin/playlists →  PlaylistManager
               ├── /admin/songs     →  SongManager
               ├── /admin/users     →  UserManager
               ├── /admin/accounts  →  AccountManager
               ├── /admin/venues    →  VenueManager
               └── /admin/analytics →  AnalyticsDashboard
```

### 5.2 State Management

Two React Contexts with `useReducer`:

**`PlayerContext`** — Local audio playback state
```javascript
{
  currentSong: { id, title, performer, url, coverImage, duration, playlistId },
  isPlaying: boolean,
  currentPlaylist: { playlist: Song[], songIndex: number },
  audio: HTMLAudioElement  // singleton, survives re-renders
}
```
Key responsibilities:
- Signed URL resolution and in-memory caching (Map, 1-hour TTL)
- Auto-renewal of signed URLs at 50-minute mark
- Next song prefetch (signed URL + audio preload at 10s into playback)
- Batch cover signing in background (non-blocking, 1.5s delay)
- Clear state on auth logout

**`SyncPlaybackContext`** — DJ Mode real-time state
```javascript
{
  playbackMode: 'independent' | 'shared_playlist' | 'synchronized',
  isController: boolean,
  controllerName: string,
  canControl: boolean,
  syncSession: { sequence_number, current_song_id, playback_state, ... },
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error',
  lastSequenceNumber: number
}
```

---

## 6. Real-Time Synchronization (DJ Mode)

### 6.1 Architecture

```
DJ (Controller)                     Venue B             Venue C
─────────────────                   ──────────          ──────────
User plays song
    │
    ▼
SyncPlaybackContext
  .broadcast()
    │
    ▼
broadcastPlaybackState()
  UPDATE playback_sessions
  SET sequence_number++
    │
    ▼
PostgreSQL UPDATE event
    │
    ▼ (Supabase Realtime WebSocket)
    ├──────────────────────────────► SyncPlaybackContext listener
    │                                   applyRemoteState()
    │                                   PlayerContext dispatch SYNC_APPLY_SONG
    │                                   audio.src = new signed URL
    │                                   audio.play()
    │
    └──────────────────────────────► (same on Venue C)
```

### 6.2 Deduplication Mechanisms

| Mechanism | Purpose |
|-----------|---------|
| `isBroadcastingRef` | Controller ignores its own Realtime events (prevents feedback loop) |
| `sequence_number` | Subscribers reject events with `seq ≤ lastSeq` (prevents out-of-order updates) |
| Song ID check | Only applies song change if `newSongId !== currentSongId` |
| Seek threshold | Only applies seek if position difference > 3 seconds |

### 6.3 Connection Lifecycle
1. `SyncPlaybackContext` mounts → dispatches `SET_CONNECTION_STATUS('connecting')`
2. Subscribes to `playback_sessions` filtered by `client_id`
3. On `SUBSCRIBED` → `SET_CONNECTION_STATUS('connected')`
4. On unmount / mode change → `channel.unsubscribe()`

---

## 7. Audio Streaming Architecture

### 7.1 File Storage

```
Supabase Storage (private buckets)
├── songs/
│   └── {songId}/audio.mp3
└── covers/
    └── {songId}/cover.jpg
```

All files are stored as **private** — no direct public access. Audio is served exclusively via time-limited signed URLs.

### 7.2 Signed URL Flow

```
1. PlayerContext.setupAndPlay(song)
   │
   ├── Is URL a storage path? (no 'http')
   │   YES → getSignedUrl(path, 3600 seconds)
   │         Returns: https://xxx.supabase.co/storage/v1/...?token=JWT
   │         Cache result in signedUrlCache Map
   │
   └── Is URL already cached?
       YES → Use cached URL
       NO  → Generate new signed URL

2. Audio element: audio.src = signedUrl → streams via CDN

3. At T+50min: auto-renew signed URL (before 60-min expiry)

4. Cover images: batch-signed in background (5 at a time, 1.5s delay)

5. Next song: URL pre-signed at T+10s of current playback
              Audio element pre-loaded at T+10s (hidden)
```

---

## 8. Authentication & Authorization

### 8.1 Auth Flow

```
Login → Supabase Auth (email + password)
     → JWT issued (session token)
     → getCurrentUserProfile() fetches role + access_level
     → React Router guards enforce admin/manager for /admin/*

Password Reset:
1. User submits email → token created in password_reset_tokens
2. Email sent with link containing token (TTL 24h)
3. User clicks link → token validated (must be unused, not expired)
4. New password set → token marked used_at = NOW()
```

### 8.2 RBAC Matrix

| Permission | Admin | Manager (account) | Manager (location) | User |
|-----------|-------|-------------------|-------------------|------|
| View all users | ✓ | — | — | — |
| Create/delete users | ✓ | — | — | — |
| Manage accounts/clients | ✓ | view only | — | — |
| Manage venues/locations | ✓ | view only | — | — |
| Create playlists | ✓ | ✓ | — | — |
| Delete playlists | ✓ | — | — | — |
| Upload songs | ✓ | ✓ | ✓ (assigned) | — |
| Delete songs | ✓ | ✓ | — | — |
| View analytics | ✓ | ✓ | ✓ (own location) | — |
| Stream music | ✓ | ✓ | ✓ | ✓ |
| Take DJ control | ✓ | ✓ | — | — |

### 8.3 Row-Level Security (RLS)

Every table has RLS enabled. Key policies:

```sql
-- user_profiles: admins see all, others only self
-- playlists: filtered by user access_level (account or location)
-- songs: accessible via playlist membership
-- play_history: users see own records; admins see all
-- playback_sessions: filtered by client_id membership

-- Helper functions (SECURITY DEFINER — avoids RLS recursion):
public.is_admin()               → checks role = 'admin'
public.is_manager_or_admin()    → checks role IN ('admin', 'manager')
```

---

## 9. Edge Functions

**`supabase/functions/invite-user/index.ts`** (Deno + TypeScript)

Handles user lifecycle operations that require the Supabase service role (never exposed in the frontend):

| Action | Description |
|--------|------------|
| `invite` | Creates auth user, waits for profile trigger, updates access_level, sends invitation email via Resend API |
| `resend` | Generates recovery link, sends custom HTML email with invitation |
| `delete` | Cleans up foreign keys, deletes auth user (cascades to user_profiles) |

Authorization: caller must be admin or manager (verified via JWT before executing).

Email delivery: **Resend** API (`RESEND_API_KEY` environment variable on Supabase).

---

## 10. Analytics & Royalty Tracking

### 10.1 Data Collection

Every audio play event records to `play_history`:

```
MusicPlayer.onEnded() / onPause()
    → recordPlay(userId, songId, playlistId, secondsPlayed, countryCode)
    → INSERT play_history {
        stream_duration,
        valid_for_royalties = (stream_duration > 30),
        completed = (stream_duration > 0.5 × song.duration),
        country_code,
        location_id  (from user profile),
        client_id    (from user profile),
        played_at: NOW()
      }
```

Admin users and managers do not record plays (avoids test data pollution).

### 10.2 Royalty Calculation Fields

| Field | Meaning |
|-------|---------|
| `stream_duration` | Exact seconds played |
| `valid_for_royalties` | `duration > 30s` (industry minimum threshold) |
| `completed` | `duration > 50%` of full song |
| `isrc` | Identifies the recording (links to royalty databases) |
| `iswc` | Identifies the musical composition |
| `ipi` | Links to composer / publisher |

### 10.3 Reporting

- **Real-time**: query `play_history` with filters (date, song, location, client)
- **Monthly aggregates**: `stream_analytics_monthly` pre-computed nightly
  - Includes `seconds_by_country` (JSONB) for geographic royalty splits
  - Enables fast dashboard queries without scanning the full history table

---

## 11. Performance Optimizations

| Optimization | Location | Impact |
|-------------|----------|--------|
| Signed URL in-memory cache | `PlayerContext` | Eliminates repeated signing API calls |
| Next song URL prefetch at T+10s | `PlayerContext` | Zero-latency song transition |
| Next song audio preload at T+10s | `PlayerContext` | Audio buffered before playback starts |
| Cover images batch-signed (5 at a time) | `PlayerContext` | Non-blocking, doesn't delay playback |
| RAF loop for EQ visualizer | `MusicPlayer` | 60fps without React re-renders |
| Singleton `AudioContext` | `MusicPlayer` | Survives React remounts |
| `getPlaylistSongsFast()` | `supabase-api.js` | Returns raw paths; covers signed lazily |
| `stream_analytics_monthly` | Database | Pre-aggregated — fast dashboard queries |
| Database indexes on `play_history` | Database | Fast analytics filtering |
| Unique index on `playback_sessions.client_id` | Database | O(1) session lookup |

---

## 12. Security Architecture

```
Layer               Mechanism
─────────────────   ─────────────────────────────────────────────────
Network             HTTPS only (Vercel + Supabase)
                    Strict CSP headers (vercel.json)
                    X-Frame-Options: DENY
                    Referrer-Policy: strict-origin-when-cross-origin

Authentication      Supabase Auth JWT tokens
                    Password reset: single-use tokens, 24h TTL
                    Email-based invitation with temporary credentials

Authorization       PostgreSQL RLS on every table
                    Helper functions: is_admin(), is_manager_or_admin()
                    React route guards (ProtectedAdminRoute)

File Access         Private storage buckets
                    Signed URLs (1-hour TTL, JWT-embedded)
                    No public storage paths exposed to frontend

API Security        Frontend uses anon key only (respects RLS)
                    Service role key only in Edge Functions
                    Edge Functions validate caller role before action

Data Isolation      Multi-tenant RLS policies
                    client_id scoping on all tenant-specific tables
```

---

## 13. Deployment Architecture

```
Developer → git push → GitHub
                           │
                           ▼
                       Vercel CI/CD
                           │
                    ┌──────┴──────┐
                    │  npm build  │  (Vite → dist/)
                    └──────┬──────┘
                           │
                    ┌──────┴──────────────────┐
                    │  Vercel Edge Network    │  (global CDN)
                    │  Static assets + SPA    │
                    │  SPA rewrites (/*→index)│
                    │  Security headers       │
                    └─────────────────────────┘

Environment Variables (Vercel project settings):
  VITE_SUPABASE_URL
  VITE_SUPABASE_ANON_KEY

Supabase Project (managed):
  - PostgreSQL database
  - Auth service
  - Realtime server
  - Storage (songs + covers buckets)
  - Edge Functions runtime (Deno)
  - Environment: RESEND_API_KEY (for email delivery)
```

---

## 14. Project File Structure

```
ayau-app-streaming/
├── src/
│   ├── App.jsx                        # Router + auth session management
│   ├── main.jsx                       # React root + context providers
│   ├── pages/
│   │   ├── HomePage.jsx               # Main streaming interface
│   │   └── PasswordReset.jsx          # Two-step password recovery
│   ├── components/
│   │   ├── MusicPlayer.jsx            # Audio engine + EQ visualizer
│   │   ├── DJModePanel.jsx            # DJ control panel (sync mode)
│   │   ├── SyncStatusIndicator.jsx    # Sync status badge
│   │   ├── PlaylistSidebar.jsx        # Playlist browser
│   │   ├── Login.jsx                  # Auth form
│   │   ├── ErrorBoundary.jsx          # React error boundary
│   │   └── admin/                     # Admin panel components
│   │       ├── AdminLayout.jsx
│   │       ├── AdminDashboard.jsx
│   │       ├── AccountManager.jsx
│   │       ├── VenueManager.jsx
│   │       ├── PlaylistManager.jsx
│   │       ├── SongManager.jsx        # ID3 extraction + bulk upload
│   │       ├── UserManager.jsx
│   │       ├── AnalyticsDashboard.jsx
│   │       └── ProtectedAdminRoute.jsx
│   ├── context/
│   │   ├── PlayerContext.jsx          # Audio state + prefetch logic
│   │   └── SyncPlaybackContext.jsx    # DJ Mode realtime state
│   ├── services/
│   │   └── supabase-api.js            # All Supabase API calls
│   ├── lib/
│   │   └── supabase.js                # Supabase client initialization
│   └── utils/
│       ├── musicPlayer.js             # formatTime(), formatDuration()
│       └── logger.js                  # Logging utilities
├── supabase/
│   └── functions/
│       └── invite-user/index.ts       # Edge Function (invite/resend/delete)
├── database/                          # SQL migrations (50+ scripts)
├── docs/
│   ├── technical/                     # System specs and diagrams
│   └── guides/                        # Deployment, testing, onboarding
├── vercel.json                        # Deployment + security headers
├── vite.config.js                     # Vite + Vitest configuration
└── package.json
```

---

## 15. Key Architectural Decisions

**Why Supabase Realtime instead of custom WebSocket server?**
Supabase Realtime uses PostgreSQL logical replication — state is authoritative in the database, not in memory. Any server restart, network drop, or new subscriber automatically gets current state from the database. No message broker needed.

**Why PlayerContext + SyncPlaybackContext as separate contexts?**
`PlayerContext` manages local audio state (single source of truth for the `<audio>` element). `SyncPlaybackContext` manages remote state (who controls, what the session says). Separating them allows non-synchronized users to use the full player without any sync overhead, and lets synchronized users layer remote state on top of local state cleanly.

**Why signed URLs instead of public storage?**
Audio files are commercially licensed content. Public URLs would allow anyone with a link to download and redistribute files without authentication. Signed URLs expire in 1 hour and embed the requester's JWT, ensuring only authenticated users with playlist access can stream content.

**Why `RAF` loop for the EQ visualizer instead of React state?**
Web Audio API's `AnalyserNode` data changes 60 times per second. Updating React state 60 times per second would trigger 60 re-renders per second of the entire player component. Using `requestAnimationFrame` + direct canvas API calls keeps the visualizer at 60fps with zero React overhead.

**Why pre-aggregate analytics into `stream_analytics_monthly`?**
The `play_history` table grows unboundedly — every play event adds a row. For a platform with 100 venues × 10 hours/day × ~15 songs/hour, that's 15,000 rows/day. Monthly aggregates allow dashboard queries that would scan millions of rows to instead scan a few hundred pre-computed rows.
