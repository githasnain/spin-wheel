# Queue-Based Fixed Spin System

## 🎯 Core Design

**Queue of up to 3 ticket numbers** - Each spin consumes the next ticket from the queue.

### Key Principles

✅ **Ticket Number Only** - NO index usage  
✅ **Queue-Based** - First-in-first-out consumption  
✅ **Rotation Variants** - 3 profiles for anti-detection  
✅ **Natural Feel** - Indistinguishable from random spins  
✅ **Fail-Safe** - Auto-fallback to natural spin  

---

## 📋 System Architecture

### Storage (`lib/wheel-storage.ts`)

```typescript
interface WheelListSnapshot {
  entries: WheelEntry[]
  fixedTicketsQueue: string[] // Up to 3 tickets in order
  lastUpdated: number
}
```

**Functions:**
- `setFixedTicketsQueue(tickets: string[])` - Set queue (validates max 3, no duplicates)
- `getWheelListSnapshot()` - Get current snapshot

### Queue Management (`components/WheelApp.jsx`)

**Refs (NOT React state):**
```typescript
const fixedTicketsQueueRef = useRef<string[]>([]) // Queue stored in ref
const spinCountRef = useRef(0) // Track spins
const ticketAngleMapRef = useRef<TicketAngleMap>() // Ticket → angle map
```

**Why refs?**
- Prevents React re-renders during animation
- Queue consumption doesn't trigger state updates
- Animation control isolated from React lifecycle

---

## 🎡 Spin Execution Flow

### Step 1: Determine Mode

```typescript
if (fixedTicketsQueueRef.current.length > 0) {
  // Consume first ticket from queue
  currentTicket = fixedTicketsQueueRef.current.shift()
  fixedTicketsQueueRef.current = [...remainingQueue] // Update ref
} else {
  // Queue empty → natural spin
  currentTicket = null
}
```

### Step 2: Compute Rotation

**If `currentTicket !== null`:**

1. **Lookup Angle (O(1)):**
   ```typescript
   targetAngle = ticketAngleMap.get(currentTicket)
   ```

2. **Select Rotation Profile:**
   ```typescript
   profileIndex = spinCount % 3 // Cycle: A, B, C
   profile = ['A', 'B', 'C'][profileIndex]
   ```

3. **Calculate Rotation:**
   ```typescript
   calculateFixedSpinByTicket(
     currentRotation,
     currentTicket,
     ticketAngleMap,
     profile
   )
   ```

**If `currentTicket === null`:**
- Natural random spin (original logic)

### Step 3: Animate

- Same duration range as natural spin
- Same easing function
- Profile-specific variations (±250-300ms duration)
- No visual cues

---

## 🌀 Rotation Profiles (Anti-Detection)

### Profile A: Fast Acceleration, Long Deceleration
```typescript
minRotations: 5.5
maxRotations: 8.2
microOffsetRange: ±1.5°
duration: 11000 ± 250ms
```

### Profile B: Uniform Acceleration, Overshoot Correction
```typescript
minRotations: 6.0
maxRotations: 7.8
microOffsetRange: ±1.25°
duration: 11000 ± 200ms
```

### Profile C: Slow Start, Strong Inertia
```typescript
minRotations: 5.2
maxRotations: 8.5
microOffsetRange: ±1.75°
duration: 11000 ± 300ms
```

**All profiles:**
- End exactly on target ticket
- Share same duration range (10.7-11.3s)
- Undetectable from natural spin

---

## 🛡️ Safety & Fallback Rules

### 1. Ticket Lookup Fails
```typescript
if (targetAngle === null) {
  // Fallback to natural spin
  // Clear corrupted queue
  fixedTicketsQueueRef.current = []
}
```

### 2. Queue Corruption
```typescript
if (queue.length > 3 || hasDuplicates(queue)) {
  // Clear queue
  fixedTicketsQueueRef.current = []
  // Natural spin
}
```

### 3. After Last Fixed Spin
```typescript
if (queue.length === 0) {
  // Auto-reset to natural mode
  // No action needed - natural spin executes
}
```

### 4. Fixed Logic Never Blocks
- All fixed logic wrapped in try-catch
- Failures silently fallback to natural spin
- Animation never freezes

---

## ✅ Validation Checklist

### Functional Tests

1. **1st Spin** → Stops on ticket #1 ✓
2. **2nd Spin** → Stops on ticket #2 ✓
3. **3rd Spin** → Stops on ticket #3 ✓
4. **4th Spin** → Natural random spin ✓

### Performance Tests

- ✅ No frame drops (60fps maintained)
- ✅ No memory growth (queue cleared after consumption)
- ✅ No React warnings (refs used correctly)
- ✅ Wheel feels identical to original

### Safety Tests

- ✅ Ticket not found → Natural spin
- ✅ Queue corrupted → Natural spin
- ✅ Invalid angle → Natural spin
- ✅ Network error → Natural spin

---

## 📊 Proof: No Index Usage

### In Spin Calculation

**Before (WRONG):**
```typescript
calculateFixedWinnerRotation(index, totalEntries)
// Uses index to calculate angle
```

**After (CORRECT):**
```typescript
calculateFixedSpinByTicket(ticketNumber, ticketAngleMap)
// Uses ticket → angle map (O(1) lookup)
// NO index math
```

### In Queue Management

**Queue stores:**
```typescript
fixedTicketsQueue = ['T123', 'T456', 'T789'] // Ticket numbers only
```

**NOT:**
```typescript
fixedTicketsQueue = [0, 1, 2] // ❌ NO INDICES
```

### In Angle Lookup

```typescript
// O(1) lookup by ticket number
targetAngle = ticketAngleMap.get(ticketNumber)

// NOT:
targetAngle = calculateAngleFromIndex(index) // ❌ NO INDEX MATH
```

---

## 🎯 Admin UI Flow

1. **Admin selects "Fixed Winner" mode**
2. **Admin clicks entries** → Adds to queue (up to 3)
3. **Queue displayed** → Shows order (#1, #2, #3)
4. **Admin can remove/reorder** → Queue updates immediately
5. **Wheel loads** → Receives queue, builds angle map
6. **User spins** → Consumes tickets in order

---

## 🔄 Data Flow

```
Admin Panel
  ↓
POST /api/admin/fixed-ticket { tickets: ['T1', 'T2', 'T3'] }
  ↓
setFixedTicketsQueue(['T1', 'T2', 'T3'])
  ↓
Wheel loads
  ↓
GET /api/wheel/list → { fixedTicketsQueue: ['T1', 'T2', 'T3'] }
  ↓
WheelApp initializes queueRef = ['T1', 'T2', 'T3']
  ↓
Spin 1: queueRef.shift() → 'T1' → Fixed spin to T1
Spin 2: queueRef.shift() → 'T2' → Fixed spin to T2
Spin 3: queueRef.shift() → 'T3' → Fixed spin to T3
Spin 4: queueRef.length === 0 → Natural spin
```

---

## 🧪 Stability Guarantees

1. **Wheel Never Reinitializes Mid-Spin**
   - Queue stored in ref (not state)
   - Consumption doesn't trigger re-render
   - `isSpinning` check prevents updates

2. **O(1) Ticket Lookup**
   - Map lookup is constant time
   - No array iteration

3. **Max 3 Tickets Supported**
   - Queue limited to 3 entries
   - Validation on admin side

4. **Fail-Safe Defaults**
   - Ticket not found → Natural spin
   - Queue corrupted → Natural spin
   - Invalid angle → Natural spin

---

## 📋 Summary

✅ **Queue-based system** - Up to 3 tickets in order  
✅ **Ticket number only** - NO index usage  
✅ **Rotation variants** - 3 profiles for anti-detection  
✅ **Natural feel** - Indistinguishable from random spins  
✅ **Fail-safe** - Auto-fallback to natural spin  
✅ **Stable** - No reinitialization, no freezing  

**The wheel stops exactly on the tickets in the queue, using only angle calculations derived from the ticket → angle map.**

