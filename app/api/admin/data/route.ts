import { NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { getAdminDraftState, getLatestSnapshot } from '@/lib/storage'

/**
 * GET /api/admin/data
 * 
 * Returns admin draft state (mutable) for admin panel
 * This is NOT what the wheel sees - wheel sees published snapshots only
 */
export async function GET() {
  try {
    // Check authentication
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const draftState = getAdminDraftState()
    const latestSnapshot = getLatestSnapshot()

    return NextResponse.json({
      // Draft state (what admin is editing)
      entries: draftState.entries,
      spinConfig: draftState.spinConfig,
      lastModified: draftState.lastModified,
      validationErrors: draftState.validationErrors,
      totalEntries: draftState.entries.length,
      // Latest published snapshot info (for reference)
      latestSnapshot: latestSnapshot ? {
        version: latestSnapshot.version,
        entryCount: latestSnapshot.entries.length,
        createdAt: latestSnapshot.metadata.createdAt,
      } : null,
    })
  } catch (error) {
    console.error('Data fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

