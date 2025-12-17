import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { setFixedTicketNumber, setFixedTicketsQueue, validateTicketNumber } from '@/lib/wheel-storage'

// Mark route as dynamic (uses cookies)
export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/fixed-ticket
 * 
 * Set fixed ticket number(s) for next spin(s)
 * Supports single ticket (legacy) or queue of up to 3 tickets
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    
    // Support both single ticket (legacy) and queue (new)
    if (body.tickets && Array.isArray(body.tickets)) {
      // New: Queue of tickets (up to 3)
      try {
        setFixedTicketsQueue(body.tickets)
        return NextResponse.json({
          success: true,
          fixedTicketsQueue: body.tickets,
        })
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Invalid tickets queue' },
          { status: 400 }
        )
      }
    } else {
      // Legacy: Single ticket
      const ticketNumber = body.ticketNumber || null

      // Validate ticket exists if provided
      if (ticketNumber !== null && !validateTicketNumber(ticketNumber)) {
        return NextResponse.json(
          { error: `Ticket number "${ticketNumber}" not found in current list` },
          { status: 400 }
        )
      }

      // Set fixed ticket
      setFixedTicketNumber(ticketNumber)

      return NextResponse.json({
        success: true,
        fixedTicketNumber: ticketNumber,
      })
    }
  } catch (error) {
    console.error('Fixed ticket error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

