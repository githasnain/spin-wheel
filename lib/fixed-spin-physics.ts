/**
 * Fixed Spin Physics - Ticket Number Based with Queue Support
 * 
 * CRITICAL: Uses ticket number → angle mapping
 * NO INDEX MATH - Only angle calculations
 * 
 * Algorithm:
 * 1. Lookup ticket number → angle (O(1))
 * 2. Calculate rotation needed to reach that angle
 * 3. Add random rotations + micro jitter
 * 4. Apply rotation variant for anti-detection
 * 5. Return endRotation (same as natural spin)
 */

export type RotationProfile = 'A' | 'B' | 'C'

/**
 * Calculate fixed spin rotation using ticket number
 * Supports rotation variants for natural feel
 * 
 * @param currentRotation - Current wheel rotation in degrees
 * @param ticketNumber - Target ticket number (NOT index)
 * @param ticketAngleMap - Pre-built ticket → angle map
 * @param profile - Optional rotation profile (A, B, or C) for anti-detection
 * @returns Object with endRotation and duration (matching natural spin)
 */
export function calculateFixedSpinByTicket(
  currentRotation: number,
  ticketNumber: string,
  ticketAngleMap: { ticketToAngle: Map<string, number> },
  profile?: RotationProfile
): { endRotation: number; duration: number; profile: RotationProfile } {
  // Lookup angle for ticket number (O(1))
  const targetAngle = ticketAngleMap.ticketToAngle.get(ticketNumber)
  
  if (targetAngle === undefined) {
    throw new Error(`Ticket number "${ticketNumber}" not found in angle map`)
  }

  // Select rotation profile (random if not specified)
  const selectedProfile: RotationProfile = profile || (['A', 'B', 'C'][Math.floor(Math.random() * 3)] as RotationProfile)

  // Base duration: 11000ms (11 seconds) - same as natural spin
  let duration = 11000

  // Get total entries count from angle map to calculate adaptive micro offset
  const totalEntries = ticketAngleMap.ticketToAngle.size
  const sliceAngle = 360 / totalEntries
  
  // Rotation profiles for anti-detection
  let minRotations: number
  let maxRotations: number
  let baseMicroOffsetRange: number

  switch (selectedProfile) {
    case 'A': // Slightly faster acceleration, longer deceleration
      minRotations = 5.5
      maxRotations = 8.2
      baseMicroOffsetRange = 3 // ±1.5 degrees base
      duration = 11000 + Math.random() * 500 - 250 // ±250ms variation
      break
    
    case 'B': // Uniform acceleration, slight overshoot correction
      minRotations = 6.0
      maxRotations = 7.8
      baseMicroOffsetRange = 2.5 // ±1.25 degrees base
      duration = 11000 + Math.random() * 400 - 200 // ±200ms variation
      break
    
    case 'C': // Slower start, stronger inertia feel
      minRotations = 5.2
      maxRotations = 8.5
      baseMicroOffsetRange = 3.5 // ±1.75 degrees base
      duration = 11000 + Math.random() * 600 - 300 // ±300ms variation
      break
    
    default:
      minRotations = 5
      maxRotations = 8
      baseMicroOffsetRange = 4 // ±2 degrees base
  }

  const rotations = minRotations + Math.random() * (maxRotations - minRotations)

  // Current pointer position in wheel's coordinate system
  // Pointer is fixed at 0° (right side)
  // After rotating clockwise by R degrees, what's at the pointer (0°)
  // was originally at (-R) degrees in the wheel's coordinate system
  const currentPointerAngle = (360 - (currentRotation % 360)) % 360

  // Calculate angle needed to reach target segment center
  let angleToTarget = targetAngle - currentPointerAngle

  // Normalize to positive angle
  if (angleToTarget < 0) {
    angleToTarget += 360
  }

  // CRITICAL: Adaptive micro offset to ensure accuracy for large datasets
  // For large datasets (3000+ entries), slice width is very small (~0.12°)
  // Micro offset must be much smaller to ensure landing in correct slice
  // Use 30% of slice width as maximum offset to guarantee accuracy
  const maxSafeOffset = sliceAngle * 0.3 // 30% of slice width
  const adaptiveMicroOffsetRange = Math.min(baseMicroOffsetRange, maxSafeOffset)
  
  // Add micro offset for natural variation (adaptive based on dataset size)
  const microOffset = (Math.random() - 0.5) * adaptiveMicroOffsetRange

  // Calculate final rotation
  // Add full rotations + angle to target + micro offset
  const totalRotation = rotations * 360 + angleToTarget + microOffset
  const endRotation = currentRotation + totalRotation

  return {
    endRotation,
    duration,
    profile: selectedProfile,
  }
}

