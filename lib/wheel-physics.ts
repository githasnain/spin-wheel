/**
 * Wheel Physics Extension
 * 
 * This module extends the existing spin logic to support fixed winners
 * WITHOUT changing the core animation behavior.
 * 
 * KEY DESIGN DECISION:
 * - We only modify the endRotation calculation
 * - All existing easing, duration, and animation logic remains unchanged
 * - This ensures the spin looks identical whether random or fixed
 */

/**
 * Calculate the target rotation angle to land on a specific winner index
 * This is used to inject into the existing spinWheel function
 * 
 * @param currentRotation - Current wheel rotation in degrees
 * @param targetWinnerIndex - Index of the desired winner (0-based)
 * @param totalEntries - Total number of entries on the wheel
 * @returns Object with endRotation and duration (matching existing random spin)
 */
export function calculateFixedWinnerRotation(
  currentRotation: number,
  targetWinnerIndex: number,
  totalEntries: number
): { endRotation: number; duration: number } {
  if (totalEntries === 0) {
    throw new Error('Cannot calculate fixed winner with no entries')
  }

  if (targetWinnerIndex < 0 || targetWinnerIndex >= totalEntries) {
    throw new Error(`Invalid winner index: ${targetWinnerIndex}`)
  }

  // Match existing random spin duration: 11000ms (11 seconds)
  const duration = 11000

  // Match existing random rotations: 5-8 full rotations
  const minRotations = 5
  const maxRotations = 8
  const rotations = minRotations + Math.random() * (maxRotations - minRotations)

  // Calculate slice angle
  const sliceAngle = 360 / totalEntries

  // Calculate target slice center angle
  // Slices start at -90° (top), so slice i's center is at:
  // (i * sliceAngle - 90 + sliceAngle / 2) degrees
  const targetSliceStart = targetWinnerIndex * sliceAngle - 90
  const targetSliceCenter = targetSliceStart + sliceAngle / 2

  // Normalize target slice center to 0-360 range
  const normalizedTargetCenter = ((targetSliceCenter % 360) + 360) % 360

  // Current pointer position in wheel's coordinate system
  // Pointer is fixed at 0° (right side)
  // After rotating clockwise by R degrees, what's at the pointer (0°)
  // was originally at (-R) degrees in the wheel's coordinate system
  const currentPointerAngle = (360 - (currentRotation % 360)) % 360

  // Calculate angle needed to reach target slice center
  let angleToTarget = normalizedTargetCenter - currentPointerAngle

  // Normalize to positive angle
  if (angleToTarget < 0) {
    angleToTarget += 360
  }

  // Add micro offset (±1-2°) for natural variation
  // This ensures fixed spins don't look identical
  const microOffset = (Math.random() - 0.5) * 4 // ±2 degrees

  // Calculate final rotation
  // Add full rotations + angle to target + micro offset
  const totalRotation = rotations * 360 + angleToTarget + microOffset
  const endRotation = currentRotation + totalRotation

  return {
    endRotation,
    duration,
  }
}

/**
 * Generate mixed spin sequence configuration
 * Returns array of spin configurations for sequential spins
 */
export type SpinMode = 'random' | 'fixed'

export interface SpinSequenceConfig {
  mode: SpinMode
  fixedWinnerIndex?: number
}

/**
 * Generate multiple spin configurations for mixed sequences
 * Example: ['random', 'fixed', 'random'] with fixed winner indices
 */
export function generateMixedSequence(
  sequence: SpinMode[],
  totalEntries: number,
  fixedWinnerIndices?: number[]
): SpinSequenceConfig[] {
  const configs: SpinSequenceConfig[] = []
  let fixedIndex = 0

  for (const mode of sequence) {
    if (mode === 'fixed') {
      const winnerIndex =
        fixedWinnerIndices && fixedWinnerIndices[fixedIndex] !== undefined
          ? fixedWinnerIndices[fixedIndex]
          : 0

      configs.push({
        mode: 'fixed',
        fixedWinnerIndex: winnerIndex,
      })
      fixedIndex++
    } else {
      configs.push({ mode: 'random' })
    }
  }

  return configs
}

