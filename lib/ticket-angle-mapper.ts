/**
 * Ticket Number → Angle Mapping System
 * 
 * CRITICAL: This is the ONLY way to resolve fixed spins
 * NO INDEX USAGE - Only ticket numbers
 * 
 * Builds a deterministic map: ticketNumber → segmentAngle
 * Used once on wheel load, stored in ref (not state)
 */

export interface TicketAngleMap {
  ticketToAngle: Map<string, number> // ticketNumber → center angle (degrees)
  ticketToIndex: Map<string, number> // ticketNumber → index (for reference only, not used in spin)
}

/**
 * Build ticket number → angle mapping
 * Called ONCE when wheel loads
 * 
 * @param entries - Array of wheel entries (order matters for angle calculation)
 * @returns Map of ticketNumber → segment center angle
 */
export function buildTicketAngleMap(entries: Array<{ ticketNumber: string; label: string }>): TicketAngleMap {
  const ticketToAngle = new Map<string, number>()
  const ticketToIndex = new Map<string, number>()

  if (entries.length === 0) {
    return { ticketToAngle, ticketToIndex }
  }

  const sliceAngle = 360 / entries.length

  entries.forEach((entry, index) => {
    // Calculate segment center angle
    // Slices start at -90° (top), so slice i's center is at:
    // (i * sliceAngle - 90 + sliceAngle / 2) degrees
    const sliceStart = index * sliceAngle - 90
    const segmentCenterAngle = sliceStart + sliceAngle / 2

    // Normalize to 0-360 range
    const normalizedAngle = ((segmentCenterAngle % 360) + 360) % 360

    ticketToAngle.set(entry.ticketNumber, normalizedAngle)
    ticketToIndex.set(entry.ticketNumber, index) // For reference only
  })

  return { ticketToAngle, ticketToIndex }
}

/**
 * Get angle for a specific ticket number
 * O(1) lookup - no index math needed
 */
export function getAngleForTicket(
  ticketNumber: string,
  ticketAngleMap: TicketAngleMap
): number | null {
  return ticketAngleMap.ticketToAngle.get(ticketNumber) ?? null
}

