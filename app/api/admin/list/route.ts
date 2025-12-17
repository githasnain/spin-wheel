import { NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { getWheelListSnapshot } from '@/lib/wheel-storage'

// Mark route as dynamic (uses cookies)
export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/list
 * 
 * Returns current wheel list for admin panel
 * Admin can see what's currently on the wheel
 */
export async function GET() {
  try {
    // Check authentication
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const snapshot = getWheelListSnapshot()

    return NextResponse.json({
      entries: snapshot.entries,
      fixedTicketNumber: snapshot.fixedTicketNumber, // Legacy support
      fixedTicketsQueue: snapshot.fixedTicketsQueue || [], // NEW: Queue of up to 3 tickets
      totalEntries: snapshot.entries.length,
      lastUpdated: snapshot.lastUpdated,
    })
  } catch (error) {
    console.error('List fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

