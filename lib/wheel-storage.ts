/**
 * Conflict-Free Wheel Storage System
 * 
 * DESIGN PRINCIPLES:
 * - Ticket Number is the ONLY source of truth
 * - Atomic list replacement (no partial updates)
 * - No index dependencies
 * - No publish workflow
 * - Admin overwrites entire list atomically
 * - Wheel reads snapshot once on load
 */

import { Participant } from './excel-parser'

export interface WheelEntry {
  ticketNumber: string // PRIMARY KEY - Only identifier
  label: string // Display name: "FirstName LastName"
  firstName: string // First name
  lastName: string // Last name
}

export interface WheelListSnapshot {
  entries: WheelEntry[] // Immutable snapshot
  fixedTicketNumber: string | null // Optional fixed winner ticket (legacy - use fixedTicketsQueue)
  fixedTicketsQueue: string[] // Queue of up to 3 fixed tickets (in order)
  lastUpdated: number // Timestamp
}

// ============================================================================
// SINGLE SOURCE OF TRUTH (In-Memory)
// ============================================================================

let currentListSnapshot: WheelListSnapshot = {
  entries: [],
  fixedTicketNumber: null, // Legacy - kept for backward compatibility
  fixedTicketsQueue: [], // Queue of up to 3 fixed tickets
  lastUpdated: Date.now(),
}

/**
 * Replace entire list atomically
 * Admin calls this after upload - replaces everything
 */
export function replaceWheelList(participants: Participant[]): void {
  const entries: WheelEntry[] = participants.map((participant) => ({
    ticketNumber: participant.ticketNumber,
    label: `${participant.firstName} ${participant.lastName}`.trim(),
    firstName: participant.firstName,
    lastName: participant.lastName,
  }))

  // ATOMIC REPLACEMENT - No partial updates
  currentListSnapshot = {
    entries,
    fixedTicketNumber: currentListSnapshot.fixedTicketNumber, // Preserve fixed ticket if set (legacy)
    fixedTicketsQueue: currentListSnapshot.fixedTicketsQueue, // Preserve queue if set
    lastUpdated: Date.now(),
  }
}

/**
 * Set fixed ticket number (legacy - single ticket)
 * Admin sets this when selecting a winner
 */
export function setFixedTicketNumber(ticketNumber: string | null): void {
  // Validate ticket exists if provided
  if (ticketNumber !== null) {
    const exists = currentListSnapshot.entries.some(e => e.ticketNumber === ticketNumber)
    if (!exists) {
      throw new Error(`Ticket number "${ticketNumber}" not found in current list`)
    }
  }

  // ATOMIC UPDATE - Only fixed ticket changes
  currentListSnapshot = {
    ...currentListSnapshot,
    fixedTicketNumber: ticketNumber,
    lastUpdated: Date.now(),
  }
}

/**
 * Set fixed tickets queue (up to 3 tickets in order)
 * Admin sets this when selecting multiple winners
 */
export function setFixedTicketsQueue(tickets: string[]): void {
  // Validate: max 3 tickets
  if (tickets.length > 3) {
    throw new Error(`Maximum 3 fixed tickets allowed. Received ${tickets.length}`)
  }

  // Validate: no duplicates
  const uniqueTickets = new Set(tickets)
  if (uniqueTickets.size !== tickets.length) {
    throw new Error('Duplicate tickets not allowed in fixed tickets queue')
  }

  // Validate: all tickets exist
  for (const ticket of tickets) {
    const exists = currentListSnapshot.entries.some(e => e.ticketNumber === ticket)
    if (!exists) {
      throw new Error(`Ticket number "${ticket}" not found in current list`)
    }
  }

  // ATOMIC UPDATE - Replace entire queue
  currentListSnapshot = {
    ...currentListSnapshot,
    fixedTicketsQueue: [...tickets], // Copy array
    lastUpdated: Date.now(),
  }
}

/**
 * Clear fixed tickets queue
 */
export function clearFixedTicketsQueue(): void {
  currentListSnapshot = {
    ...currentListSnapshot,
    fixedTicketsQueue: [],
    lastUpdated: Date.now(),
  }
}

/**
 * Get current list snapshot (read-only)
 * Wheel calls this once on load
 */
export function getWheelListSnapshot(): WheelListSnapshot {
  return { ...currentListSnapshot } // Return copy
}

/**
 * Clear fixed ticket (optional - after spin completes)
 */
export function clearFixedTicket(): void {
  currentListSnapshot = {
    ...currentListSnapshot,
    fixedTicketNumber: null,
    lastUpdated: Date.now(),
  }
}

/**
 * Get next fixed ticket from queue (consumes ticket)
 * Returns null if queue is empty
 */
export function getNextFixedTicket(): string | null {
  if (currentListSnapshot.fixedTicketsQueue.length === 0) {
    return null
  }
  
  // Get first ticket (don't remove yet - wheel will handle consumption)
  return currentListSnapshot.fixedTicketsQueue[0]
}

/**
 * Validate ticket number exists
 */
export function validateTicketNumber(ticketNumber: string): boolean {
  return currentListSnapshot.entries.some(e => e.ticketNumber === ticketNumber)
}

/**
 * Get entry by ticket number
 */
export function getEntryByTicket(ticketNumber: string): WheelEntry | undefined {
  return currentListSnapshot.entries.find(e => e.ticketNumber === ticketNumber)
}

