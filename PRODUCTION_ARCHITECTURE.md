# Production Architecture: Spin Wheel System
## Principal Engineer & SRE Design Document

---

## 🎯 Executive Summary

This document defines a **production-ready, stable, predictable** architecture for the spin wheel system. The design enforces strict separation between admin operations and wheel execution, ensuring:

- **Zero unexpected reinitializations**
- **Deterministic behavior under load (3000 entries)**
- **Animation stability**
- **Fail-safe defaults**
- **Single source of truth**

---

## 🧱 System Principles (NON-NEGOTIABLE)

### 1. Single Source of Truth
- **Admin panel** is the ONLY source of truth for data
- **Wheel NEVER mutates admin data**
- **Wheel NEVER reads live admin state**

### 2. Explicit State Transitions
- Every action has a defined **before state** and **after state**
- No implicit side effects
- State transitions are **atomic** and **versioned**

### 3. Immutable Data Snapshots
- Wheel consumes **read-only snapshots**
- Snapshots are **versioned** and **immutable**
- No live bindings to admin state

### 4. Isolation of Animation Loop
- Wheel animation **fully isolated** from React re-renders
- Animation state stored in **refs**, not React state
- No React state updates during animation

### 5. Fail-Safe Defaults
- If snapshot fetch fails → use **last known snapshot** or **default entries**
- If fixed spin fails → **fallback to natural spin**
- If validation fails → **disable spin**, show error

---

## 📊 End-to-End Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    ADMIN FLOW (AUTHORITATIVE)                   │
└─────────────────────────────────────────────────────────────────┘

Step 1: Admin Login
  └─> POST /api/admin/login
      └─> Verify credentials (env vars)
      └─> Create session cookie
      └─> Redirect to /admin

Step 2: List Management (DRAFT STATE)
  └─> Admin uploads Excel files
      └─> POST /api/admin/upload
          └─> Parse & validate Excel
          └─> Store in DRAFT_STATE (mutable)
          └─> Return preview
      └─> Admin can:
          • Upload multiple files
          • Preview entries
          • Search/filter
          • Select active lists
          ⚠️ WHEEL NOT UPDATED YET

Step 3: Fix Configuration (DRAFT STATE)
  └─> Admin configures spin strategy:
      • Natural spin (default)
      • Fixed winner (select ticket/person)
      • Mixed sequence (Natural → Fixed → Natural)
  └─> Configuration stored in DRAFT_STATE
      ⚠️ NOT APPLIED TO WHEEL YET

Step 4: Publish State (CRITICAL TRANSITION)
  └─> Admin clicks "Publish to Wheel"
      └─> POST /api/admin/publish
          └─> Validate draft state:
              • Max 3000 entries
              • Unique ticket numbers
              • Valid fix configuration (if any)
          └─> Create IMMUTABLE SNAPSHOT:
              {
                version: timestamp,
                entries: [...], // Final wheel entries
                spinConfig: {
                  mode: 'natural' | 'fixed' | 'mixed',
                  fixedWinnerIndex?: number,
                  sequence?: SpinSequenceConfig[]
                },
                metadata: {
                  createdAt: timestamp,
                  createdBy: username,
                  entryCount: number
                }
              }
          └─> Store snapshot (versioned)
          └─> Mark as LATEST_SNAPSHOT
          └─> Return success

Step 5: Admin Decision Point
  └─> Option A: "Go to Wheel"
      └─> Redirect to /wheel
      └─> Wheel auto-loads latest snapshot
      └─> Admin can click "Go Spin"
  
  └─> Option B: "Do Not Go to Wheel"
      └─> Admin exits
      └─> Another user can open /wheel
      └─> Wheel loads latest snapshot automatically
      └─> ✔ No dependency on admin presence


┌─────────────────────────────────────────────────────────────────┐
│                    WHEEL FLOW (STRICT)                          │
└─────────────────────────────────────────────────────────────────┘

On Load (/wheel)
  └─> GET /api/wheel/snapshot
      └─> Fetch LATEST_SNAPSHOT (read-only)
      └─> Validate snapshot integrity
      └─> Return snapshot data
  └─> WheelApp component:
      └─> Initialize wheel ONCE with snapshot.entries
      └─> Store snapshot.spinConfig
      └─> Set initialized flag (prevents reinit)
      └─> ⚠️ Wheel NEVER reinitializes on admin changes

On Spin Button Click
  └─> Read snapshot.spinConfig (read-only)
  └─> Determine spin mode:
      • natural → random endRotation
      • fixed → calculateFixedWinnerRotation()
      • mixed → execute sequence
  └─> Execute spin:
      └─> Animation runs FULLY ISOLATED
      └─> Uses refs for state (no React re-renders)
      └─> Final result emitted
      └─> ⚠️ Wheel NEVER:
          • Re-parses Excel
          • Re-renders segments mid-spin
          • Reads live admin state
          • Mutates snapshot

On Snapshot Update (Polling/Optional)
  └─> Wheel polls /api/wheel/snapshot?version=<current>
      └─> If new version exists:
          └─> Check if wheel is idle (not spinning)
          └─> If idle:
              └─> Fetch new snapshot
              └─> Reinitialize wheel (ONLY if idle)
          └─> If spinning:
              └─> Queue update for after spin completes
      └─> ⚠️ NEVER interrupt active animation
```

---

## 🗄️ State Ownership & Data Structures

### Admin Draft State (Mutable)
```typescript
interface AdminDraftState {
  entries: WheelEntry[]           // Can be modified
  spinConfig: SpinConfiguration   // Can be modified
  lastModified: number            // Track changes
  validationErrors: string[]      // Track issues
}
```

**Ownership:** Admin panel only  
**Location:** Server-side (lib/storage.ts)  
**Mutability:** Mutable (admin can change)  
**Access:** Admin routes only (`/api/admin/*`)

### Published Snapshot (Immutable)
```typescript
interface WheelSnapshot {
  version: string                  // Unique version ID (timestamp)
  entries: WheelEntry[]           // Final entries (immutable)
  spinConfig: SpinConfiguration   // Final config (immutable)
  metadata: SnapshotMetadata      // Creation info
  checksum: string                // Integrity check
}

interface SpinConfiguration {
  mode: 'natural' | 'fixed' | 'mixed'
  fixedWinnerIndex?: number       // Only if mode === 'fixed'
  sequence?: SpinSequenceConfig[] // Only if mode === 'mixed'
  fallbackToNatural: boolean      // Fail-safe flag
}

interface SnapshotMetadata {
  createdAt: number
  createdBy: string
  entryCount: number
  previousVersion?: string        // Link to previous snapshot
}
```

**Ownership:** System (created by publish action)  
**Location:** Server-side (lib/storage.ts)  
**Mutability:** Immutable (never modified after creation)  
**Access:** Wheel routes only (`/api/wheel/*`)

### Wheel Runtime State (Isolated)
```typescript
interface WheelRuntimeState {
  snapshot: WheelSnapshot | null   // Current snapshot (read-only)
  isInitialized: boolean           // Prevents reinit
  isSpinning: boolean              // Animation state
  currentRotation: number          // Animation state (ref)
  spinQueue: SpinRequest[]         // Queued spins
}

interface SpinRequest {
  mode: 'natural' | 'fixed'
  fixedWinnerIndex?: number
  timestamp: number
}
```

**Ownership:** Wheel component only  
**Location:** Client-side (WheelApp component refs)  
**Mutability:** Mutable (wheel runtime only)  
**Access:** Wheel component internal

---

## 📦 Snapshot Schema

### Snapshot Structure
```typescript
{
  version: "1734567890123",           // Timestamp as version ID
  entries: [
    {
      displayName: "John Doe",
      ticketNumber: "T12345",
      participant: { ... }
    },
    // ... up to 3000 entries
  ],
  spinConfig: {
    mode: "fixed",                     // or "natural" or "mixed"
    fixedWinnerIndex: 42,              // Only if mode === "fixed"
    sequence: [                        // Only if mode === "mixed"
      { mode: "natural" },
      { mode: "fixed", fixedWinnerIndex: 10 },
      { mode: "natural" }
    ],
    fallbackToNatural: true            // Always true (fail-safe)
  },
  metadata: {
    createdAt: 1734567890123,
    createdBy: "admin",
    entryCount: 1500,
    previousVersion: "1734567800000"   // Optional: link to previous
  },
  checksum: "sha256:abc123..."         // Integrity verification
}
```

### Snapshot Validation Rules
1. **Version:** Must be unique, monotonically increasing
2. **Entries:** Must be 1-3000 entries, unique ticket numbers
3. **Spin Config:** Must match mode (fixed requires index, mixed requires sequence)
4. **Checksum:** Must match computed checksum
5. **Metadata:** Must have valid timestamps and creator

---

## 🎯 Fixed Spin Safety Guarantees

### Safety Rules (NON-NEGOTIABLE)

1. **Precomputation**
   - Target angle calculated BEFORE animation starts
   - No runtime angle adjustments
   - Calculation validated before spin

2. **Randomization**
   - Always 5-8 full rotations (same as natural)
   - Micro jitter (±2°) applied
   - Duration always 11000ms (same as natural)

3. **Easing Preservation**
   - Same easing function as natural spin
   - No shortcuts or snap-to-target
   - Smooth deceleration maintained

4. **Failure Handling**
   ```typescript
   try {
     const result = calculateFixedWinnerRotation(...)
     if (result.endRotation === undefined || isNaN(result.endRotation)) {
       throw new Error('Invalid calculation')
     }
     // Use fixed rotation
   } catch (error) {
     // FAIL-SAFE: Fallback to natural spin
     console.warn('Fixed spin failed, using natural spin', error)
     return calculateNaturalRotation()
   }
   ```

5. **Visual Indistinguishability**
   - Fixed spins MUST look identical to natural spins
   - No detectable patterns
   - No shortened durations
   - No visible snapping

---

## 🧪 Load Test Strategy

### Test Scenarios

#### Scenario 1: Maximum Load (3000 entries)
```
1. Admin uploads Excel with 3000 entries
2. Admin publishes snapshot
3. Wheel loads snapshot
4. Perform 10 consecutive spins
5. Measure:
   - Initial load time
   - Memory usage
   - Frame rate during spins
   - Time between spins
```

**Success Criteria:**
- Initial load < 2 seconds
- Memory stable (no growth after spins)
- Frame rate ≥ 55 FPS during animation
- No UI freeze

#### Scenario 2: Rapid Admin Updates
```
1. Admin publishes snapshot A (1000 entries)
2. Wheel loads snapshot A
3. Admin publishes snapshot B (2000 entries) immediately
4. Wheel polls for updates
5. Verify wheel updates ONLY when idle
```

**Success Criteria:**
- Wheel does NOT interrupt active spin
- Update happens after spin completes
- No memory leaks
- No React render loops

#### Scenario 3: Fixed Spin After Natural Spins
```
1. Load snapshot with fixed winner config
2. Perform 5 natural spins
3. Perform 1 fixed spin
4. Verify fixed spin lands on target
5. Verify animation smoothness
```

**Success Criteria:**
- Fixed spin lands on correct winner
- Animation smooth (no jitter)
- Duration matches natural spins
- No visual artifacts

#### Scenario 4: Snapshot Corruption Handling
```
1. Simulate corrupted snapshot (invalid checksum)
2. Wheel attempts to load
3. Verify fallback behavior
```

**Success Criteria:**
- Error displayed to user
- Fallback to last known snapshot
- Wheel remains functional
- Admin notified

#### Scenario 5: Network Failure During Load
```
1. Disconnect network
2. Wheel attempts to load snapshot
3. Verify graceful degradation
```

**Success Criteria:**
- Error message displayed
- Fallback to default entries
- Wheel remains usable
- Retry mechanism available

---

## 🚨 Failure Modes & Handling

### Failure Mode Matrix

| Failure Mode | Detection | Handling | User Impact |
|-------------|-----------|----------|-------------|
| Invalid Excel | Upload validation | Reject upload, show errors | Admin sees errors, can fix |
| Duplicate tickets | Upload validation | Reject duplicates, show errors | Admin sees errors, can fix |
| > 3000 entries | Upload validation | Trim to 3000, warn admin | Admin notified, can review |
| Missing snapshot | Snapshot fetch | Use last known or defaults | Wheel shows defaults |
| Corrupted snapshot | Checksum validation | Reject, use previous | Wheel uses previous snapshot |
| Fixed calc failure | Try-catch in calc | Fallback to natural spin | Spin continues naturally |
| Network failure | Fetch error | Use cached snapshot | Wheel uses cached data |
| Animation interruption | React re-render check | Block updates during spin | Animation completes smoothly |
| Memory leak | Memory profiling | Fix ref cleanup | No memory growth |

### Fallback Chain

```
1. Try to load latest snapshot
   └─> Success: Use snapshot
   └─> Failure: Try cached snapshot
       └─> Success: Use cached snapshot
       └─> Failure: Use default entries
           └─> Always succeeds (hardcoded defaults)
```

---

## ✅ Stability Checklist

### Pre-Production Checklist

#### Data Flow
- [ ] Admin draft state separate from published snapshots
- [ ] Wheel only reads published snapshots
- [ ] No live bindings between admin and wheel
- [ ] Snapshot versioning implemented
- [ ] Checksum validation implemented

#### State Management
- [ ] Wheel initialization happens ONCE per snapshot
- [ ] No reinitialization during active spin
- [ ] Animation state in refs (not React state)
- [ ] State transitions are atomic
- [ ] No race conditions in state updates

#### Fixed Spin Safety
- [ ] Precomputation before animation
- [ ] Fail-safe fallback to natural spin
- [ ] Visual indistinguishability verified
- [ ] Duration matches natural spins
- [ ] Easing preserved

#### Performance
- [ ] 3000 entries load in < 2 seconds
- [ ] Memory stable after multiple spins
- [ ] Frame rate ≥ 55 FPS during animation
- [ ] No UI freeze on publish
- [ ] Excel parsing doesn't block UI

#### Error Handling
- [ ] All failure modes handled
- [ ] User-friendly error messages
- [ ] Fallback chain implemented
- [ ] No silent failures
- [ ] Admin notified of critical errors

#### Load Testing
- [ ] 3000 entries tested
- [ ] Rapid updates tested
- [ ] Fixed spin after natural tested
- [ ] Network failure tested
- [ ] Snapshot corruption tested

---

## 🎯 Production Readiness Verdict

### Current State Assessment

**CRITICAL ISSUES:**
1. ❌ No snapshot/publish mechanism
2. ❌ Wheel reads live admin state
3. ❌ No versioning or immutability
4. ❌ Wheel can reinitialize unexpectedly
5. ❌ Fixed spin config passed as props (not in snapshot)

**MODERATE ISSUES:**
1. ⚠️ Animation isolation needs improvement
2. ⚠️ Error handling incomplete
3. ⚠️ No polling/update mechanism

**POSITIVE ASPECTS:**
1. ✅ Fixed spin calculation is sound
2. ✅ Excel parsing is robust
3. ✅ Authentication is secure
4. ✅ Basic structure is good

### Verdict: **NOT PRODUCTION READY**

**Required Changes:**
1. Implement snapshot/publish system
2. Separate admin draft from published state
3. Add versioning and immutability
4. Prevent wheel reinitialization
5. Store spin config in snapshot
6. Improve animation isolation
7. Add comprehensive error handling
8. Implement polling/update mechanism

**Estimated Effort:** 2-3 days of focused development

---

## 📋 Implementation Plan

### Phase 1: Core Snapshot System (Day 1)
1. Create snapshot storage structure
2. Implement publish endpoint
3. Create snapshot fetch endpoint
4. Add versioning and checksums

### Phase 2: State Separation (Day 1-2)
1. Separate admin draft state
2. Update admin panel to use draft state
3. Update wheel to use snapshots only
4. Remove live bindings

### Phase 3: Wheel Stability (Day 2)
1. Prevent reinitialization
2. Improve animation isolation
3. Add update polling (optional)
4. Implement update queue

### Phase 4: Error Handling & Testing (Day 3)
1. Add comprehensive error handling
2. Implement fallback chain
3. Load testing
4. Fix any issues found

---

## 🔐 Security Considerations

1. **Snapshot Integrity:** Checksums prevent tampering
2. **Access Control:** Admin routes protected, wheel routes public
3. **Data Validation:** All inputs validated before snapshot creation
4. **Session Security:** HttpOnly cookies, secure in production
5. **Rate Limiting:** Consider rate limits on publish endpoint

---

## 📈 Monitoring & Observability

### Key Metrics to Track
1. Snapshot creation rate
2. Snapshot fetch latency
3. Wheel initialization time
4. Spin completion rate
5. Error rates by type
6. Memory usage over time
7. Frame rate during animation

### Logging Requirements
1. All snapshot creations (with version)
2. All snapshot fetches (with version)
3. All spin executions (mode, result)
4. All errors (with context)
5. Performance metrics (load times, frame rates)

---

## 🎓 Conclusion

This architecture provides a **stable, predictable, production-ready** foundation for the spin wheel system. By enforcing strict separation between admin operations and wheel execution, we ensure:

- **Zero unexpected behavior**
- **Deterministic performance**
- **Fail-safe operation**
- **Maintainable codebase**

The implementation plan provides a clear path to production readiness.

