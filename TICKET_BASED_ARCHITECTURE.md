# Ticket-Based Fixed Spin Architecture

## 🎯 Core Design Principle

**Ticket Number is the ONLY source of truth. NO INDEX USAGE.**

The wheel resolves stop positions exclusively via `Ticket Number → Angle` mapping.

---

## 📂 Storage Strategy (Conflict-Free)

### Single Source of Truth: `lib/wheel-storage.ts`

```typescript
let currentListSnapshot: WheelListSnapshot = {
  entries: WheelEntry[],      // { ticketNumber, label }
  fixedTicketNumber: string | null,
  lastUpdated: number
}
```

### Atomic Operations

1. **`replaceWheelList(participants)`** - Admin uploads → Entire list replaced atomically
2. **`setFixedTicketNumber(ticket)`** - Admin selects winner → Only fixed ticket changes
3. **`getWheelListSnapshot()`** - Wheel reads → Returns immutable copy

**Rules:**
- ✅ Entire list replaced atomically (no partial updates)
- ✅ No publish workflow (immediate availability)
- ✅ No version conflicts (single source)
- ✅ No index dependencies

---

## 🎡 Ticket → Angle Mapping

### System: `lib/ticket-angle-mapper.ts`

**Builds map ONCE on wheel load:**

```typescript
buildTicketAngleMap(entries) → {
  ticketToAngle: Map<ticketNumber, segmentCenterAngle>,
  ticketToIndex: Map<ticketNumber, index> // Reference only, NOT used in spin
}
```

**Algorithm:**
1. Calculate `sliceAngle = 360 / entries.length`
2. For each entry at index `i`:
   - `sliceStart = i * sliceAngle - 90`
   - `segmentCenterAngle = sliceStart + sliceAngle / 2`
   - Normalize to 0-360 range
   - Store: `ticketToAngle.set(ticketNumber, angle)`

**Storage:** Stored in `useRef` (not state) to prevent re-renders

**Lookup:** O(1) - `ticketAngleMap.get(ticketNumber)`

---

## 🎯 Fixed Spin Physics

### System: `lib/fixed-spin-physics.ts`

**Algorithm (NO INDEX MATH):**

```typescript
calculateFixedSpinByTicket(currentRotation, ticketNumber, ticketAngleMap) {
  // 1. Lookup angle (O(1))
  targetAngle = ticketAngleMap.get(ticketNumber)
  
  // 2. Calculate rotation needed
  currentPointerAngle = (360 - (currentRotation % 360)) % 360
  angleToTarget = targetAngle - currentPointerAngle
  if (angleToTarget < 0) angleToTarget += 360
  
  // 3. Add random rotations + micro jitter
  rotations = 5-8 (random)
  microOffset = ±2° (random)
  
  // 4. Final rotation
  endRotation = currentRotation + (rotations * 360) + angleToTarget + microOffset
  
  return { endRotation, duration: 11000 }
}
```

**Key Points:**
- ✅ Uses ticket number → angle lookup (NO index)
- ✅ Same duration/easing as natural spin
- ✅ Undetectable from natural spin
- ✅ Fail-safe: Falls back to natural if ticket not found

---

## 🔄 Data Flow

### Admin Flow

1. **Upload Excel** → `POST /api/admin/upload`
   - Parses Excel
   - Validates ticket numbers (unique)
   - Calls `replaceWheelList()` → **Atomic replacement**
   - ✅ List immediately available to wheel

2. **Select Fixed Ticket** → `POST /api/admin/fixed-ticket`
   - Admin enters ticket number
   - Validates ticket exists
   - Calls `setFixedTicketNumber()` → **Only fixed ticket changes**
   - ✅ Fixed ticket immediately available to wheel

3. **Go to Wheel** → Admin navigates to `/wheel`
   - Wheel loads list ONCE
   - Builds ticket → angle map ONCE
   - Ready to spin

### Wheel Flow

1. **On Load** → `GET /api/wheel/list`
   - Fetches current list snapshot
   - Extracts names + ticket numbers
   - Builds `ticketAngleMap` ONCE (stored in ref)
   - Sets `fixedTicketNumber` from snapshot

2. **On Spin Click**
   - If `fixedTicketNumber` exists:
     - Lookup angle: `ticketAngleMap.get(fixedTicketNumber)`
     - Calculate rotation using angle (NO index)
     - Spin to that angle
   - Else:
     - Natural random spin

---

## 🛡️ Conflict Prevention

### Rules Enforced

1. **Atomic List Replacement**
   - Admin upload → Entire list replaced (no merge)
   - No partial updates possible

2. **Single Source of Truth**
   - One storage location (`lib/wheel-storage.ts`)
   - No version conflicts
   - No publish workflow

3. **Wheel Isolation**
   - Wheel reads snapshot ONCE on load
   - Builds angle map ONCE
   - Never reinitializes mid-spin
   - No dependency on admin state

4. **Ticket Number Validation**
   - Upload validates uniqueness
   - Fixed ticket validates existence
   - Fail-safe: Falls back to natural spin

---

## ✅ Proof: No Index Usage

### In Fixed Spin Calculation

**Before (WRONG):**
```typescript
calculateFixedWinnerRotation(currentRotation, targetIndex, totalEntries)
// Uses index to calculate angle
```

**After (CORRECT):**
```typescript
calculateFixedSpinByTicket(currentRotation, ticketNumber, ticketAngleMap)
// Uses ticket → angle map (O(1) lookup)
// NO index math
```

### In Wheel Component

**Before (WRONG):**
```typescript
if (targetWinnerIndex !== null) {
  spinWheel(targetWinnerIndex) // Uses index
}
```

**After (CORRECT):**
```typescript
if (fixedTicketNumber !== null) {
  const angle = ticketAngleMap.get(fixedTicketNumber) // Uses ticket → angle
  calculateFixedSpinByTicket(..., fixedTicketNumber, ticketAngleMap)
}
```

### Index Map (Reference Only)

The `ticketToIndex` map exists ONLY for:
- Admin UI display (showing which entry is selected)
- NOT used in spin calculation
- NOT used in angle lookup

---

## 🧪 Stability Guarantees

1. **Wheel Never Reinitializes Mid-Spin**
   - `isSpinning` check prevents updates
   - Angle map stored in ref (not state)
   - Names memoized with spin check

2. **O(1) Ticket Lookup**
   - Map lookup is constant time
   - No array iteration needed

3. **Max 3000 Entries Supported**
   - Map handles 3000 entries efficiently
   - No performance degradation

4. **Fail-Safe Defaults**
   - Ticket not found → Natural spin
   - Invalid angle → Natural spin
   - Network error → Default entries

---

## 📋 API Endpoints

### Admin Endpoints

- `POST /api/admin/upload` - Upload Excel, replace list atomically
- `GET /api/admin/list` - Get current list (admin view)
- `POST /api/admin/fixed-ticket` - Set fixed ticket number

### Wheel Endpoints

- `GET /api/wheel/list` - Get current list (public, no auth)

---

## 🎯 Summary

✅ **Ticket Number → Angle mapping** (NO index)  
✅ **Atomic list replacement** (no conflicts)  
✅ **No publish workflow** (immediate availability)  
✅ **O(1) lookup** (performance guaranteed)  
✅ **Fail-safe defaults** (always works)  
✅ **Zero reinitialization bugs** (stable)  

**The wheel stops exactly on the ticket number specified, using only angle calculations derived from the ticket → angle map.**

