import { NextRequest, NextResponse } from 'next/server'
import { getLatestSnapshot } from '@/lib/storage'

/**
 * GET /api/wheel/snapshot
 * GET /api/wheel/entries (legacy compatibility)
 * 
 * CRITICAL: Returns ONLY published snapshots (immutable)
 * Wheel NEVER sees admin draft state
 * 
 * Query params:
 * - version: Optional - check for specific version
 * - currentVersion: Optional - check if newer version exists
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const requestedVersion = searchParams.get('version')
    const currentVersion = searchParams.get('currentVersion')

    // Get latest snapshot
    const snapshot = getLatestSnapshot()

    // If no snapshot exists, return defaults (fail-safe)
    if (!snapshot) {
      return NextResponse.json({
        entries: [],
        totalEntries: 0,
        version: null,
        spinConfig: {
          mode: 'natural',
          fallbackToNatural: true,
        },
        hasUpdate: false,
      })
    }

    // If checking for updates
    if (currentVersion) {
      const hasUpdate = parseInt(snapshot.version) > parseInt(currentVersion)
      return NextResponse.json({
        hasUpdate,
        latestVersion: snapshot.version,
      })
    }

    // If requesting specific version
    if (requestedVersion && requestedVersion !== snapshot.version) {
      // In production, fetch specific version from storage
      // For now, return latest if requested version doesn't match
      return NextResponse.json({
        entries: snapshot.entries.map((entry) => entry.displayName),
        totalEntries: snapshot.entries.length,
        version: snapshot.version,
        spinConfig: snapshot.spinConfig,
        metadata: snapshot.metadata,
      })
    }

    // Return latest snapshot (read-only)
    return NextResponse.json({
      entries: snapshot.entries.map((entry) => entry.displayName),
      totalEntries: snapshot.entries.length,
      version: snapshot.version,
      spinConfig: snapshot.spinConfig,
      metadata: snapshot.metadata,
    })
  } catch (error) {
    console.error('Snapshot fetch error:', error)
    // FAIL-SAFE: Return empty state instead of error
    return NextResponse.json({
      entries: [],
      totalEntries: 0,
      version: null,
      spinConfig: {
        mode: 'natural',
        fallbackToNatural: true,
      },
      error: 'Failed to load snapshot',
    })
  }
}

