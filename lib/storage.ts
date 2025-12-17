/**
 * Production-ready storage system with snapshot/publish architecture
 * 
 * CRITICAL DESIGN:
 * - Admin draft state (mutable) - only admin can modify
 * - Published snapshots (immutable) - wheel only reads these
 * - Versioning and checksums for integrity
 * - Fail-safe defaults
 */

import { Participant } from './excel-parser'
import crypto from 'crypto'

export interface WheelEntry {
  displayName: string // First Name + Last Name (for wheel display)
  ticketNumber: string // Unique identifier
  participant: Participant // Full participant data
}

export type SpinMode = 'natural' | 'fixed' | 'mixed'

export interface SpinSequenceConfig {
  mode: SpinMode
  fixedWinnerIndex?: number
}

export interface SpinConfiguration {
  mode: SpinMode
  fixedWinnerIndex?: number // Only if mode === 'fixed' (legacy - use fixedWinnerTicketNumber)
  fixedWinnerTicketNumber?: string // Only if mode === 'fixed' - ticket number to win
  sequence?: SpinSequenceConfig[] // Only if mode === 'mixed'
  fallbackToNatural: boolean // Always true (fail-safe)
}

export interface SnapshotMetadata {
  createdAt: number
  createdBy: string
  entryCount: number
  previousVersion?: string // Link to previous snapshot
}

/**
 * IMMUTABLE SNAPSHOT - Wheel only reads these
 */
export interface WheelSnapshot {
  version: string // Unique version ID (timestamp)
  entries: WheelEntry[] // Final entries (immutable)
  spinConfig: SpinConfiguration // Final config (immutable)
  metadata: SnapshotMetadata // Creation info
  checksum: string // Integrity check (SHA-256)
}

/**
 * ADMIN DRAFT STATE - Mutable, only admin can modify
 */
export interface AdminDraftState {
  entries: WheelEntry[] // Can be modified
  spinConfig: SpinConfiguration // Can be modified
  lastModified: number // Track changes
  validationErrors: string[] // Track issues
}

// ============================================================================
// ADMIN DRAFT STATE (Mutable)
// ============================================================================

let adminDraftState: AdminDraftState = {
  entries: [],
  spinConfig: {
    mode: 'natural',
    fallbackToNatural: true,
  },
  lastModified: Date.now(),
  validationErrors: [],
}

/**
 * Get admin draft state (mutable)
 */
export function getAdminDraftState(): AdminDraftState {
  return { ...adminDraftState } // Return copy to prevent external mutation
}

/**
 * Set admin draft entries from participants
 */
export function setAdminDraftEntries(participants: Participant[]): void {
  const entries: WheelEntry[] = participants.map((participant) => ({
    displayName: `${participant.firstName} ${participant.lastName}`.trim(),
    ticketNumber: participant.ticketNumber,
    participant,
  }))

  adminDraftState = {
    ...adminDraftState,
    entries,
    lastModified: Date.now(),
    validationErrors: [],
  }
}

/**
 * Set admin draft spin configuration
 */
export function setAdminDraftSpinConfig(config: SpinConfiguration): void {
  adminDraftState = {
    ...adminDraftState,
    spinConfig: config,
    lastModified: Date.now(),
  }
}

/**
 * Validate admin draft state before publishing
 */
export function validateAdminDraftState(): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Validate entries
  if (adminDraftState.entries.length === 0) {
    errors.push('No entries to publish')
  }

  if (adminDraftState.entries.length > 3000) {
    errors.push(`Too many entries: ${adminDraftState.entries.length}. Maximum is 3000.`)
  }

  // Check for duplicate ticket numbers
  const ticketNumbers = new Set<string>()
  for (const entry of adminDraftState.entries) {
    if (ticketNumbers.has(entry.ticketNumber)) {
      errors.push(`Duplicate ticket number: ${entry.ticketNumber}`)
    }
    ticketNumbers.add(entry.ticketNumber)
  }

  // Validate spin config
  if (adminDraftState.spinConfig.mode === 'fixed') {
    const ticketNumber = adminDraftState.spinConfig.fixedWinnerTicketNumber
    const index = adminDraftState.spinConfig.fixedWinnerIndex
    
    if (!ticketNumber && index === undefined) {
      errors.push('Fixed mode requires selecting a winner (by ticket number or index)')
    } else if (ticketNumber) {
      // Validate ticket number exists
      const entryIndex = adminDraftState.entries.findIndex(e => e.ticketNumber === ticketNumber)
      if (entryIndex === -1) {
        errors.push(`Ticket number "${ticketNumber}" not found in entries`)
      }
    } else if (index !== undefined) {
      // Validate index
      if (index < 0 || index >= adminDraftState.entries.length) {
        errors.push(`Invalid fixedWinnerIndex: ${index}. Must be between 0 and ${adminDraftState.entries.length - 1}`)
      }
    }
  }

  if (adminDraftState.spinConfig.mode === 'mixed') {
    if (!adminDraftState.spinConfig.sequence || adminDraftState.spinConfig.sequence.length === 0) {
      errors.push('Mixed mode requires sequence')
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Calculate checksum for snapshot integrity
 */
function calculateChecksum(snapshot: Omit<WheelSnapshot, 'checksum'>): string {
  const data = JSON.stringify({
    version: snapshot.version,
    entries: snapshot.entries,
    spinConfig: snapshot.spinConfig,
    metadata: snapshot.metadata,
  })
  return crypto.createHash('sha256').update(data).digest('hex')
}

// ============================================================================
// PUBLISHED SNAPSHOTS (Immutable)
// ============================================================================

let publishedSnapshots: Map<string, WheelSnapshot> = new Map()
let latestSnapshotVersion: string | null = null

/**
 * Create and publish a snapshot from admin draft state
 */
export function publishSnapshot(createdBy: string): { success: boolean; snapshot?: WheelSnapshot; errors: string[] } {
  // Validate draft state
  const validation = validateAdminDraftState()
  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors,
    }
  }

  // Create immutable snapshot
  const version = Date.now().toString()
  
  // Validate entries before creating snapshot
  if (!adminDraftState.entries || adminDraftState.entries.length === 0) {
    return {
      success: false,
      errors: ['Cannot create snapshot: No entries in draft state'],
    }
  }
  
  const snapshot: Omit<WheelSnapshot, 'checksum'> = {
    version,
    entries: [...adminDraftState.entries], // Deep copy
    spinConfig: { ...adminDraftState.spinConfig }, // Copy config
    metadata: {
      createdAt: Date.now(),
      createdBy,
      entryCount: adminDraftState.entries.length,
      previousVersion: latestSnapshotVersion || undefined,
    },
  }

  // Calculate checksum
  const checksum = calculateChecksum(snapshot)
  const finalSnapshot: WheelSnapshot = {
    ...snapshot,
    checksum,
  }

  // Store snapshot (immutable)
  publishedSnapshots.set(version, finalSnapshot)
  latestSnapshotVersion = version
  
  console.log('Snapshot published successfully:', {
    version,
    entryCount: finalSnapshot.entries.length,
    firstFewEntries: finalSnapshot.entries.slice(0, 3).map(e => e.displayName)
  })

  // Keep only last 10 snapshots (prevent memory leak)
  if (publishedSnapshots.size > 10) {
    const versions = Array.from(publishedSnapshots.keys()).sort((a, b) => parseInt(a) - parseInt(b))
    for (let i = 0; i < versions.length - 10; i++) {
      publishedSnapshots.delete(versions[i])
    }
  }

  return {
    success: true,
    snapshot: finalSnapshot,
    errors: [],
  }
}

/**
 * Get latest published snapshot (read-only)
 */
export function getLatestSnapshot(): WheelSnapshot | null {
  if (!latestSnapshotVersion) {
    return null
  }
  const snapshot = publishedSnapshots.get(latestSnapshotVersion)
  if (!snapshot) {
    return null
  }

  // Verify checksum
  const expectedChecksum = calculateChecksum(snapshot)
  if (snapshot.checksum !== expectedChecksum) {
    console.error('Snapshot checksum mismatch - possible corruption')
    return null
  }

  return snapshot
}

/**
 * Get snapshot by version (read-only)
 */
export function getSnapshotByVersion(version: string): WheelSnapshot | null {
  const snapshot = publishedSnapshots.get(version)
  if (!snapshot) {
    return null
  }

  // Verify checksum
  const expectedChecksum = calculateChecksum(snapshot)
  if (snapshot.checksum !== expectedChecksum) {
    console.error('Snapshot checksum mismatch - possible corruption')
    return null
  }

  return snapshot
}

/**
 * Check if newer snapshot exists
 */
export function hasNewerSnapshot(currentVersion: string): boolean {
  if (!latestSnapshotVersion) {
    return false
  }
  return parseInt(latestSnapshotVersion) > parseInt(currentVersion)
}

// ============================================================================
// LEGACY COMPATIBILITY (for backward compatibility during migration)
// ============================================================================

/**
 * Get current wheel entries (legacy - returns latest snapshot entries)
 */
export function getWheelEntries(): WheelEntry[] {
  const snapshot = getLatestSnapshot()
  return snapshot ? snapshot.entries : []
}

/**
 * Set wheel entries from participants (legacy - updates admin draft)
 */
export function setWheelEntries(participants: Participant[]): void {
  setAdminDraftEntries(participants)
}

/**
 * Get wheel state (legacy - returns latest snapshot state)
 */
export function getWheelState(): { entries: WheelEntry[]; lastUpdated: number } {
  const snapshot = getLatestSnapshot()
  return {
    entries: snapshot ? snapshot.entries : [],
    lastUpdated: snapshot ? parseInt(snapshot.version) : Date.now(),
  }
}

/**
 * Clear wheel entries (legacy - clears admin draft)
 */
export function clearWheelEntries(): void {
  adminDraftState = {
    entries: [],
    spinConfig: {
      mode: 'natural',
      fallbackToNatural: true,
    },
    lastModified: Date.now(),
    validationErrors: [],
  }
}

/**
 * Get entry count (legacy - returns latest snapshot count)
 */
export function getEntryCount(): number {
  const snapshot = getLatestSnapshot()
  return snapshot ? snapshot.entries.length : 0
}

/**
 * Find entry index by ticket number (legacy - searches latest snapshot)
 */
export function findEntryIndexByTicket(ticketNumber: string): number {
  const snapshot = getLatestSnapshot()
  if (!snapshot) {
    return -1
  }
  return snapshot.entries.findIndex(entry => entry.ticketNumber === ticketNumber)
}

/**
 * Find entry index by display name (legacy - searches latest snapshot)
 */
export function findEntryIndexByName(displayName: string): number {
  const snapshot = getLatestSnapshot()
  if (!snapshot) {
    return -1
  }
  return snapshot.entries.findIndex(entry => entry.displayName === displayName)
}

