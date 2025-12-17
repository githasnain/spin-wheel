'use client'

import { useEffect, useState, useRef } from 'react'
import WheelApp from '@/components/WheelApp'

// Default names (same as original wheel) - shown when no Excel files uploaded
const DEFAULT_NAMES = [
  'Ali', 'Beatriz', 'Charles', 'Diya', 'Eric', 'Fatima', 'Gabriel', 'Hanna'
]
const DEFAULT_TICKETS = ['T001', 'T002', 'T003', 'T004', 'T005', 'T006', 'T007', 'T008']

export default function HomePage() {
  const [names, setNames] = useState(DEFAULT_NAMES)
  const [ticketNumbers, setTicketNumbers] = useState<string[]>(DEFAULT_TICKETS)
  const [fixedTicketNumber, setFixedTicketNumber] = useState<string | null>(null) // Legacy
  const [fixedTicketsQueue, setFixedTicketsQueue] = useState<string[]>([]) // NEW: Queue
  const [loading, setLoading] = useState(true)
  const initializedRef = useRef(false)

  // CRITICAL: Load list ONCE on mount
  // Wheel will NOT reinitialize on admin changes
  useEffect(() => {
    if (initializedRef.current) {
      return // Already initialized - prevent reinit
    }

    let cancelled = false
    
    // Load list from API
    const loadList = async () => {
      try {
        const res = await fetch('/api/wheel/list')
        if (cancelled) return
        
        if (!res.ok) {
          console.error('Failed to fetch list:', res.status, res.statusText)
          throw new Error(`HTTP ${res.status}: ${res.statusText}`)
        }
        
        const data = await res.json()
        console.log('List data received:', { 
          entryCount: data.entries?.length || 0,
          fixedTicket: data.fixedTicketNumber,
          hasEntries: !!data.entries && data.entries.length > 0
        })
        
        // CRITICAL FIX: Use requestIdleCallback for non-blocking update
        const updateState = () => {
          if (cancelled) return
          
          if (data.entries && Array.isArray(data.entries) && data.entries.length > 0) {
            console.log('Setting names from list:', data.entries.length, 'entries')
            // Extract names and ticket numbers
            const namesList = data.entries.map((e: any) => e.label || e.displayName || e.name)
            const ticketsList = data.entries.map((e: any) => e.ticketNumber)
            
            setNames(namesList)
            setTicketNumbers(ticketsList)
            setFixedTicketNumber(data.fixedTicketNumber || null) // Legacy
            setFixedTicketsQueue(data.fixedTicketsQueue || []) // NEW: Queue
          } else {
            console.warn('No entries in list, using defaults. Data:', data)
            setNames(DEFAULT_NAMES)
            setTicketNumbers(DEFAULT_TICKETS)
            setFixedTicketNumber(null)
          }
          
          setLoading(false)
          initializedRef.current = true // Mark as initialized
        }
        
        // Use requestIdleCallback if available, otherwise setTimeout
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(updateState, { timeout: 100 })
        } else {
          setTimeout(updateState, 0)
        }
      } catch (err) {
        if (cancelled) return
        console.error('Failed to load list:', err)
        // FAIL-SAFE: Use defaults
        setNames(DEFAULT_NAMES)
        setTicketNumbers(DEFAULT_TICKETS)
        setFixedTicketNumber(null)
        setFixedTicketsQueue([])
        setLoading(false)
        initializedRef.current = true
      }
    }
    
    loadList()
    
    return () => {
      cancelled = true
    }
  }, []) // Empty deps - only run once

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: 'linear-gradient(135deg, #2b0505 0%, #233159 60%, #05051a 100%)',
        color: 'white'
      }}>
        <div>Loading wheel...</div>
      </div>
    )
  }

  // Always show wheel with list data
  return (
    <WheelApp 
      initialNames={names}
      initialTicketNumbers={ticketNumbers}
      fixedTicketNumber={fixedTicketNumber} // Legacy support
      fixedTicketsQueue={fixedTicketsQueue} // NEW: Queue of up to 3 tickets
    />
  )
}

