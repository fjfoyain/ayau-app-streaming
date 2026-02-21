import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.mock is hoisted to top of file by Vitest, so mock functions must be
// declared with vi.hoisted() to be available inside the factory.
const {
  mockSingle,
  mockOrder,
  mockNot,
  mockEq,
  mockSelect,
  mockInsert,
  mockFrom,
  mockCreateSignedUrl,
  mockStorageFrom,
  mockGetUser,
} = vi.hoisted(() => ({
  mockSingle: vi.fn(),
  mockOrder: vi.fn(),
  mockNot: vi.fn(),
  mockEq: vi.fn(),
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockFrom: vi.fn(),
  mockCreateSignedUrl: vi.fn(),
  mockStorageFrom: vi.fn(),
  mockGetUser: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getUser: mockGetUser },
    from: mockFrom,
    storage: { from: mockStorageFrom },
  },
}))

import {
  isAdmin,
  isManagerOrAdmin,
  getUserRole,
  getAllUsers,
  getSignedUrl,
  createPlaylist,
  recordPlay,
} from '../services/supabase-api'

// ── Helpers ────────────────────────────────────────────────────────────────

function mockUser(id = 'user-123') {
  mockGetUser.mockResolvedValue({ data: { user: { id } } })
}

function mockNoUser() {
  mockGetUser.mockResolvedValue({ data: { user: null } })
}

/** Wire up the full Supabase fluent chain */
function mockChain({ data = null, error = null } = {}) {
  mockSingle.mockResolvedValue({ data, error })
  mockEq.mockReturnValue({ single: mockSingle })
  mockOrder.mockResolvedValue({ data, error })
  mockNot.mockReturnValue({ order: mockOrder })
  mockSelect.mockReturnValue({ eq: mockEq, single: mockSingle, order: mockOrder, not: mockNot })
  mockInsert.mockReturnValue({ select: mockSelect })
  mockFrom.mockReturnValue({
    select: mockSelect,
    insert: mockInsert,
    update: vi.fn().mockReturnValue({ eq: mockEq }),
  })
}

// ── Tests: isAdmin ─────────────────────────────────────────────────────────

describe('isAdmin', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns true when user has admin role', async () => {
    mockUser()
    mockChain({ data: { role: 'admin' } })
    expect(await isAdmin()).toBe(true)
  })

  it('returns false when user has non-admin role', async () => {
    mockUser()
    mockChain({ data: { role: 'user' } })
    expect(await isAdmin()).toBe(false)
  })

  it('returns false when no authenticated user', async () => {
    mockNoUser()
    expect(await isAdmin()).toBe(false)
  })

  it('returns false when DB query errors', async () => {
    mockUser()
    mockChain({ data: null, error: new Error('DB error') })
    expect(await isAdmin()).toBe(false)
  })
})

// ── Tests: isManagerOrAdmin ────────────────────────────────────────────────

describe('isManagerOrAdmin', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns true for admin role', async () => {
    mockUser()
    mockChain({ data: { role: 'admin' } })
    expect(await isManagerOrAdmin()).toBe(true)
  })

  it('returns true for manager role', async () => {
    mockUser()
    mockChain({ data: { role: 'manager' } })
    expect(await isManagerOrAdmin()).toBe(true)
  })

  it('returns false for regular user role', async () => {
    mockUser()
    mockChain({ data: { role: 'user' } })
    expect(await isManagerOrAdmin()).toBe(false)
  })

  it('returns false when no authenticated user', async () => {
    mockNoUser()
    expect(await isManagerOrAdmin()).toBe(false)
  })
})

// ── Tests: getUserRole ─────────────────────────────────────────────────────

describe('getUserRole', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the role string', async () => {
    mockUser()
    mockChain({ data: { role: 'manager' } })
    expect(await getUserRole()).toBe('manager')
  })

  it('returns null when not logged in', async () => {
    mockNoUser()
    expect(await getUserRole()).toBeNull()
  })

  it('returns null on DB error', async () => {
    mockUser()
    mockChain({ data: null, error: new Error('fail') })
    expect(await getUserRole()).toBeNull()
  })
})

// ── Tests: getAllUsers ─────────────────────────────────────────────────────

describe('getAllUsers', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns user list on success', async () => {
    const users = [
      { id: '1', full_name: 'Alice', email: 'alice@test.com' },
      { id: '2', full_name: 'Bob', email: 'bob@test.com' },
    ]
    mockChain({ data: users })
    const result = await getAllUsers()
    expect(result).toEqual(users)
  })

  it('throws on DB error', async () => {
    mockChain({ data: null, error: new Error('permission denied') })
    await expect(getAllUsers()).rejects.toThrow('permission denied')
  })

  it('calls .not() to exclude deleted users', async () => {
    mockChain({ data: [] })
    await getAllUsers()
    expect(mockNot).toHaveBeenCalledWith('email', 'like', '%.deleted.%')
  })
})

// ── Tests: getSignedUrl ────────────────────────────────────────────────────

describe('getSignedUrl', () => {
  beforeEach(() => vi.clearAllMocks())

  it('parses bucket and path from filePath correctly', async () => {
    mockStorageFrom.mockReturnValue({ createSignedUrl: mockCreateSignedUrl })
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://cdn.example.com/signed' },
      error: null,
    })

    const result = await getSignedUrl('songs/track01.mp3', 3600)

    expect(mockStorageFrom).toHaveBeenCalledWith('songs')
    expect(mockCreateSignedUrl).toHaveBeenCalledWith('track01.mp3', 3600)
    expect(result).toBe('https://cdn.example.com/signed')
  })

  it('uses "songs" as default bucket when path has no slash', async () => {
    mockStorageFrom.mockReturnValue({ createSignedUrl: mockCreateSignedUrl })
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://cdn.example.com/signed2' },
      error: null,
    })

    await getSignedUrl('track.mp3')
    expect(mockStorageFrom).toHaveBeenCalledWith('songs')
  })

  it('throws when filePath is empty', async () => {
    await expect(getSignedUrl('')).rejects.toThrow('filePath required')
  })

  it('throws on storage error', async () => {
    mockStorageFrom.mockReturnValue({ createSignedUrl: mockCreateSignedUrl })
    mockCreateSignedUrl.mockResolvedValue({
      data: null,
      error: new Error('storage error'),
    })

    await expect(getSignedUrl('covers/img.jpg')).rejects.toThrow('storage error')
  })
})

// ── Tests: createPlaylist ──────────────────────────────────────────────────

describe('createPlaylist', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the created playlist', async () => {
    const playlist = { id: 'pl-1', name: 'Chill Vibes', is_public: false }
    mockSingle.mockResolvedValue({ data: playlist, error: null })
    mockSelect.mockReturnValue({ single: mockSingle })
    mockFrom.mockReturnValue({ insert: vi.fn().mockReturnValue({ select: mockSelect }) })

    const result = await createPlaylist({ name: 'Chill Vibes', is_public: false })
    expect(result).toEqual(playlist)
  })

  it('throws on error', async () => {
    mockSingle.mockResolvedValue({ data: null, error: new Error('insert fail') })
    mockSelect.mockReturnValue({ single: mockSingle })
    mockFrom.mockReturnValue({ insert: vi.fn().mockReturnValue({ select: mockSelect }) })

    await expect(createPlaylist({ name: 'Test' })).rejects.toThrow('insert fail')
  })
})

// ── Tests: recordPlay ─────────────────────────────────────────────────────

describe('recordPlay', () => {
  beforeEach(() => vi.clearAllMocks())

  it('resolves without error on success', async () => {
    mockInsert.mockResolvedValue({ error: null })
    mockFrom.mockReturnValue({ insert: mockInsert })

    await expect(
      recordPlay('user-1', 'song-1', 'playlist-1', 180, 'GT')
    ).resolves.toBeUndefined()
  })

  it('throws on insert error', async () => {
    mockInsert.mockResolvedValue({ error: new Error('insert error') })
    mockFrom.mockReturnValue({ insert: mockInsert })

    await expect(
      recordPlay('user-1', 'song-1', 'playlist-1', 180)
    ).rejects.toThrow('insert error')
  })
})
