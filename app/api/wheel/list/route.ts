import { NextResponse } from 'next/server'
import { getWheelListSnapshot } from '@/lib/wheel-storage'

// Mark route as dynamic
export const dynamic = 'force-dynamic'

/**
 * GET /api/wheel/list
 * 
 * Returns current wheel list for wheel page
 * Wheel reads this ONCE on load
 * 
 * NO AUTHENTICATION - Public endpoint
 */
export async function GET() {
  try {
    const snapshot = getWheelListSnapshot()

    return NextResponse.json({
      entries: snapshot.entries,
      fixedTicketNumber: snapshot.fixedTicketNumber, // Legacy support
      fixedTicketsQueue: snapshot.fixedTicketsQueue || [], // NEW: Queue of up to 3 tickets
      totalEntries: snapshot.entries.length,
      lastUpdated: snapshot.lastUpdated,
    })
  } catch (error) {
    console.error('Wheel list fetch error:', error)
    // FAIL-SAFE: Return empty state
    return NextResponse.json({
      entries: [],
      fixedTicketNumber: null,
      totalEntries: 0,
      lastUpdated: Date.now(),
    })
  }
}

