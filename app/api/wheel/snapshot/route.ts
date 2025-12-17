import { NextRequest, NextResponse } from 'next/server'
import { getLatestSnapshot, getSnapshotByVersion, hasNewerSnapshot } from '@/lib/storage'

/**
 * GET /api/wheel/snapshot
 * 
 * CRITICAL: Returns ONLY published snapshots (immutable)
 * Wheel NEVER sees admin draft state
 * 
 * Query params:
 * - version: Optional - get specific version
 * - currentVersion: Optional - check if newer version exists
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const requestedVersion = searchParams.get('version')
    const currentVersion = searchParams.get('currentVersion')

    // If checking for updates
    if (currentVersion) {
      const hasUpdate = hasNewerSnapshot(currentVersion)
      const latest = getLatestSnapshot()
      return NextResponse.json({
        hasUpdate,
        latestVersion: latest?.version || null,
      })
    }

    // If requesting specific version
    if (requestedVersion) {
      const snapshot = getSnapshotByVersion(requestedVersion)
      if (!snapshot) {
        // Fallback to latest
        const latest = getLatestSnapshot()
        if (!latest) {
          return NextResponse.json({
            entries: [],
            totalEntries: 0,
            version: null,
            spinConfig: {
              mode: 'natural',
              fallbackToNatural: true,
            },
          })
        }
        const displayNames = latest.entries.map((entry) => entry.displayName)
        const ticketNumbers = latest.entries.map((entry) => entry.ticketNumber)
        const nameToTicketMap: Record<string, string> = {}
        latest.entries.forEach((entry) => {
          nameToTicketMap[entry.displayName] = entry.ticketNumber
        })
        
        return NextResponse.json({
          entries: displayNames,
          ticketNumbers: ticketNumbers,
          nameToTicketMap: nameToTicketMap,
          totalEntries: latest.entries.length,
          version: latest.version,
          spinConfig: latest.spinConfig,
          metadata: latest.metadata,
        })
      }
      const displayNames = snapshot.entries.map((entry) => entry.displayName)
      const ticketNumbers = snapshot.entries.map((entry) => entry.ticketNumber)
      const nameToTicketMap: Record<string, string> = {}
      snapshot.entries.forEach((entry) => {
        nameToTicketMap[entry.displayName] = entry.ticketNumber
      })
      
      return NextResponse.json({
        entries: displayNames,
        ticketNumbers: ticketNumbers,
        nameToTicketMap: nameToTicketMap,
        totalEntries: snapshot.entries.length,
        version: snapshot.version,
        spinConfig: snapshot.spinConfig,
        metadata: snapshot.metadata,
      })
    }

    // Get latest snapshot
    const snapshot = getLatestSnapshot()

    // If no snapshot exists, return defaults (fail-safe)
    if (!snapshot) {
      console.log('No snapshot found, returning empty state')
      return NextResponse.json({
        entries: [],
        totalEntries: 0,
        version: null,
        spinConfig: {
          mode: 'natural',
          fallbackToNatural: true,
        },
      })
    }

    // Validate snapshot has entries
    if (!snapshot.entries || !Array.isArray(snapshot.entries) || snapshot.entries.length === 0) {
      console.warn('Snapshot exists but has no entries:', snapshot)
      return NextResponse.json({
        entries: [],
        totalEntries: 0,
        version: snapshot.version,
        spinConfig: snapshot.spinConfig,
        metadata: snapshot.metadata,
      })
    }

    // Return latest snapshot (read-only)
    const displayNames = snapshot.entries.map((entry) => entry.displayName)
    // Also return ticket numbers for fixed spin by ticket number
    const ticketNumbers = snapshot.entries.map((entry) => entry.ticketNumber)
    // Create mapping: displayName -> ticketNumber for easy lookup
    const nameToTicketMap: Record<string, string> = {}
    snapshot.entries.forEach((entry) => {
      nameToTicketMap[entry.displayName] = entry.ticketNumber
    })
    
    console.log('Returning snapshot:', {
      version: snapshot.version,
      entryCount: displayNames.length,
      firstFew: displayNames.slice(0, 3)
    })
    
    return NextResponse.json({
      entries: displayNames,
      ticketNumbers: ticketNumbers, // Include ticket numbers
      nameToTicketMap: nameToTicketMap, // Mapping for lookup
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

