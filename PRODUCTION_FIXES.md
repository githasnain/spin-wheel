# Production Fixes Implementation Guide

## Priority 1: CRITICAL Fixes

### Fix 1: Add Snapshot Polling & Update Queue

**File:** `app/page.tsx`

**Current Issue:** Wheel doesn't poll for snapshot updates, so it never knows when admin publishes new data.

**Fix:**
```typescript
// Add to app/page.tsx
const queuedSnapshotRef = useRef<string | null>(null)

useEffect(() => {
  if (!snapshotVersion || loading) return
  
  const pollInterval = setInterval(async () => {
    // Don't poll during spin
    if (isSpinning) return
    
    try {
      const res = await fetch(`/api/wheel/snapshot?currentVersion=${snapshotVersion}`)
      if (!res.ok) return
      
      const data = await res.json()
      
      if (data.hasUpdate && data.latestVersion) {
        // Queue update for after spin completes
        queuedSnapshotRef.current = data.latestVersion
        console.log('New snapshot available, will update after spin completes')
      }
    } catch (error) {
      console.error('Polling error:', error)
      // Don't show error to user, just log
    }
  }, 5000) // Poll every 5 seconds
  
  return () => clearInterval(pollInterval)
}, [snapshotVersion, loading])

// Apply queued update when spin completes
useEffect(() => {
  if (!isSpinning && queuedSnapshotRef.current) {
    const queuedVersion = queuedSnapshotRef.current
    queuedSnapshotRef.current = null
    
    // Load new snapshot
    const loadNewSnapshot = async () => {
      try {
        const res = await fetch(`/api/wheel/snapshot?version=${queuedVersion}`)
        if (!res.ok) throw new Error('Failed to fetch snapshot')
        
        const data = await res.json()
        
        if (data.entries && data.entries.length > 0) {
          setNames(data.entries)
        }
        
        if (data.spinConfig) {
          setSpinConfig(data.spinConfig)
        }
        
        if (data.version) {
          setSnapshotVersion(data.version)
        }
      } catch (error) {
        console.error('Failed to load queued snapshot:', error)
      }
    }
    
    loadNewSnapshot()
  }
}, [isSpinning])
```

### Fix 2: Add Network Failure Handling

**File:** `app/page.tsx`

**Current Issue:** No timeout or error handling for network failures.

**Fix:**
```typescript
// Update loadSnapshot function
const loadSnapshot = async () => {
  try {
    // Add timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5s timeout
    
    const res = await fetch('/api/wheel/snapshot', {
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }
    
    const data = await res.json()
    
    // ... existing processing ...
    
  } catch (error) {
    if (cancelled) return
    
    // Handle different error types
    if (error.name === 'AbortError') {
      console.warn('Snapshot fetch timeout, using defaults')
    } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
      console.warn('Network error, using defaults')
    } else {
      console.error('Failed to load snapshot:', error)
    }
    
    // FAIL-SAFE: Use defaults
    setNames(DEFAULT_NAMES)
    setSpinConfig({ mode: 'natural', fallbackToNatural: true })
    setLoading(false)
    initializedRef.current = true
  }
}
```

### Fix 3: Add Snapshot Corruption Recovery

**File:** `lib/storage.ts`

**Current Issue:** If checksum fails, returns null without trying previous version.

**Fix:**
```typescript
// Update getLatestSnapshot function
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
    console.error('Snapshot checksum mismatch - trying previous version')
    
    // Try previous version
    if (snapshot.metadata.previousVersion) {
      const previousSnapshot = getSnapshotByVersion(snapshot.metadata.previousVersion)
      if (previousSnapshot) {
        // Verify previous snapshot checksum
        const prevExpectedChecksum = calculateChecksum(previousSnapshot)
        if (previousSnapshot.checksum === prevExpectedChecksum) {
          console.warn('Using previous snapshot due to corruption')
          return previousSnapshot
        }
      }
    }
    
    // No valid previous version, return null
    return null
  }
  
  return snapshot
}
```

### Fix 4: Add isSpinning State to WheelApp Props

**File:** `components/WheelApp.jsx` & `app/page.tsx`

**Current Issue:** `app/page.tsx` doesn't know if wheel is spinning.

**Fix:**
```typescript
// In components/WheelApp.jsx - Add callback prop
export default function WheelApp({ 
  initialNames = [],
  onSpinComplete,
  onSpinStateChange, // NEW: Callback for spin state
  targetWinnerIndex = null,
  spinMode = 'random',
  snapshotVersion = null
}) {
  // ... existing code ...
  
  // Update setIsSpinning to call callback
  useEffect(() => {
    if (onSpinStateChange) {
      onSpinStateChange(isSpinning)
    }
  }, [isSpinning, onSpinStateChange])
  
  // ... rest of component ...
}

// In app/page.tsx
const [isSpinning, setIsSpinning] = useState(false)

return (
  <WheelApp
    initialNames={names}
    spinConfig={spinConfig}
    snapshotVersion={snapshotVersion}
    onSpinStateChange={setIsSpinning} // NEW
    // ... other props ...
  />
)
```

---

## Priority 2: HIGH Priority Fixes

### Fix 5: Verify Micro Jitter Implementation

**Status:** ✅ **ALREADY IMPLEMENTED**

The micro jitter is already in `lib/wheel-physics.ts` line 71:
```typescript
const microOffset = (Math.random() - 0.5) * 4 // ±2 degrees
```

No fix needed.

### Fix 6: Add Duration Verification

**File:** `components/WheelApp.jsx`

**Current Issue:** No verification that actual animation duration matches expected 11000ms.

**Fix:**
```typescript
// In spinWheel function, after animation completes
const animate = () => {
  // ... existing animation code ...
  
  if (progress >= 1) {
    animationCompletedRef.current = true
    
    // Verify duration
    const actualDuration = performance.now() - startTime
    const expectedDuration = 11000
    const durationDiff = Math.abs(actualDuration - expectedDuration)
    
    if (durationDiff > 100) { // More than 100ms difference
      console.warn(`Animation duration mismatch: expected ${expectedDuration}ms, got ${actualDuration}ms`)
    }
    
    // ... rest of completion logic ...
  }
}
```

---

## Testing Checklist

After implementing fixes, verify:

- [ ] Snapshot polling works (publish new snapshot, verify wheel updates)
- [ ] Update queue works (publish during spin, verify update after spin)
- [ ] Network failure handling (disconnect network, verify defaults)
- [ ] Snapshot corruption recovery (manually corrupt checksum, verify fallback)
- [ ] Duration verification (check console for warnings)
- [ ] No memory leaks (100 spins, check memory)
- [ ] Frame rate stable (monitor during 3000-entry render)

---

## Implementation Order

1. **Fix 4** (isSpinning state) - Required for Fix 1
2. **Fix 1** (Polling & Queue) - Critical for production
3. **Fix 2** (Network handling) - Critical for reliability
4. **Fix 3** (Corruption recovery) - Important for stability
5. **Fix 6** (Duration verification) - Nice to have for monitoring

---

## Estimated Time

- Fix 4: 30 minutes
- Fix 1: 1-2 hours
- Fix 2: 30 minutes
- Fix 3: 30 minutes
- Fix 6: 15 minutes
- Testing: 2-3 hours

**Total: 5-7 hours**

