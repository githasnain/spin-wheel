import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { publishSnapshot, getAdminDraftState, setAdminDraftSpinConfig } from '@/lib/storage'

// Mark route as dynamic (uses cookies)
export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/publish
 * 
 * CRITICAL ENDPOINT: Creates immutable snapshot from admin draft state
 * 
 * Flow:
 * 1. Verify admin authentication
 * 2. Validate draft state
 * 3. Create immutable snapshot
 * 4. Store snapshot (versioned)
 * 5. Mark as latest snapshot
 * 
 * Wheel will ONLY consume published snapshots.
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get admin username from session (simplified - in production, extract from session)
    const adminUsername = 'admin' // TODO: Extract from session

    // Parse request body (may contain spin config)
    let spinConfigOverride = null
    try {
      const body = await request.json()
      if (body.spinConfig) {
        spinConfigOverride = body.spinConfig
      }
    } catch {
      // No body or invalid JSON - use draft state config
    }

    // Get current draft state
    const draftState = getAdminDraftState()
    console.log('Publishing snapshot - Draft state:', {
      entryCount: draftState.entries.length,
      spinConfig: draftState.spinConfig,
      firstFewEntries: draftState.entries.slice(0, 3).map(e => e.displayName)
    })

    // Override spin config if provided
    if (spinConfigOverride) {
      setAdminDraftSpinConfig(spinConfigOverride)
    }

    // Publish snapshot
    const result = publishSnapshot(adminUsername)
    
    console.log('Publish result:', {
      success: result.success,
      entryCount: result.snapshot?.entries.length || 0,
      errors: result.errors
    })

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Publish failed',
          errors: result.errors,
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      snapshot: {
        version: result.snapshot!.version,
        entryCount: result.snapshot!.entries.length,
        spinConfig: result.snapshot!.spinConfig,
        metadata: result.snapshot!.metadata,
      },
    })
  } catch (error) {
    console.error('Publish error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

