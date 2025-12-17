# Architecture Documentation

## System Overview

This application extends an existing wheel spinner with admin capabilities while preserving all original animation behavior.

## Key Design Decisions

### 1. Minimal Refactoring Approach

**Decision:** Extend existing code rather than rebuild

**Rationale:**
- Preserves proven animation logic
- Reduces risk of introducing bugs
- Faster development time
- Easier to verify correctness

**Implementation:**
- Only modified `spinWheel()` function signature
- Added optional `targetWinnerIndex` parameter
- All other logic remains unchanged

### 2. Fixed Winner Calculation

**Decision:** Calculate `endRotation` to land on target winner

**Algorithm:**
1. Calculate target slice center angle
2. Calculate current pointer position
3. Calculate angle needed to reach target
4. Add random rotations (5-8) + micro offset (±2°)
5. Return `endRotation` matching existing random spin characteristics

**Why this works:**
- Uses same duration (11000ms)
- Uses same rotation count (5-8)
- Uses same easing function
- Only `endRotation` differs, making spins visually identical

### 3. Data Storage Strategy

**Decision:** In-memory storage with upgrade path

**Current Implementation:**
- Simple JavaScript object in `lib/storage.ts`
- Fast reads/writes
- Data lost on server restart

**Upgrade Path:**
- Comments in `lib/storage.ts` show PostgreSQL implementation
- Can be swapped without changing other code
- Maintains same API interface

**Why:**
- Meets requirement: "No database required"
- Simple deployment
- Easy to upgrade later

### 4. Authentication Strategy

**Decision:** Cookie-based sessions with environment variables

**Implementation:**
- HttpOnly cookies (XSS protection)
- Secure flag in production (HTTPS only)
- Session expiration (24 hours)
- Environment variable credentials

**Why:**
- Simple for single-admin use case
- No external dependencies
- Secure enough for most use cases
- Can upgrade to JWT/OAuth if needed

## Code Flow

### Admin Upload Flow

```
1. Admin selects Excel files
2. Files sent to /api/admin/upload
3. Server validates authentication
4. Parse Excel files (lib/excel-parser.ts)
5. Combine and validate entries
6. Store in memory (lib/storage.ts)
7. Return success/errors to admin
8. Admin panel refreshes data
```

### Public Wheel Flow

```
1. User visits public page (/)
2. Page loads entries from /api/wheel/entries
3. WheelApp component renders with entries
4. User clicks wheel
5. spinWheel() called (random or fixed)
6. Animation runs (preserved from original)
7. Winner calculated and displayed
```

### Fixed Winner Flow

```
1. Admin selects "Fixed Winner" mode
2. Admin enters winner index
3. Admin clicks wheel
4. spinWheel(fixedWinnerIndex) called
5. calculateFixedWinnerRotation() calculates endRotation
6. Animation runs (identical to random)
7. Wheel lands on selected winner
```

## File Organization

### Preserved Files

- `spin-wheel/src/App.jsx` - Original app logic (reference)
- `spin-wheel/src/App.css` - Original styles (imported)
- `spin-wheel/src/components/CanvasWheel.jsx` - Wheel component (copied)

### New Files

**Core Logic:**
- `lib/wheel-physics.ts` - Fixed winner calculation
- `lib/excel-parser.ts` - Excel parsing
- `lib/storage.ts` - Data storage
- `lib/auth.ts` - Authentication

**Components:**
- `components/CanvasWheel.jsx` - Wheel component (from original)
- `components/WheelApp.jsx` - Extended app component

**Pages:**
- `app/page.tsx` - Public wheel page
- `app/admin/page.tsx` - Admin panel (protected)
- `app/admin/login/page.tsx` - Login page

**API Routes:**
- `app/api/admin/login/route.ts` - Login endpoint
- `app/api/admin/logout/route.ts` - Logout endpoint
- `app/api/admin/upload/route.ts` - Excel upload
- `app/api/admin/data/route.ts` - Get wheel data
- `app/api/wheel/entries/route.ts` - Public entries

## Extension Points

### Adding New Spin Modes

To add a new spin mode:

1. Add mode to `SpinMode` type in `lib/wheel-physics.ts`
2. Add calculation function similar to `calculateFixedWinnerRotation()`
3. Update `spinWheel()` in `WheelApp.jsx` to handle new mode
4. Update admin UI to select new mode

### Adding Persistence

To add database persistence:

1. Install database client (e.g., `@vercel/postgres`)
2. Update `lib/storage.ts` functions to use database
3. Keep same function signatures
4. No other code changes needed

### Adding Mixed Sequences

To implement mixed sequences:

1. Create UI for sequence definition
2. Use `generateMixedSequence()` from `lib/wheel-physics.ts`
3. Store sequence in admin state
4. Execute spins sequentially with appropriate modes

## Testing Strategy

### Unit Tests (Recommended)

Test fixed winner calculation:
```javascript
test('calculateFixedWinnerRotation lands on correct winner', () => {
  const result = calculateFixedWinnerRotation(0, 5, 10)
  const winnerIndex = calculateWinnerIndex(result.endRotation, 10)
  expect(winnerIndex).toBe(5)
})
```

### Integration Tests (Recommended)

Test full flow:
1. Upload Excel file
2. Verify entries loaded
3. Select fixed winner
4. Spin wheel
5. Verify correct winner

### Manual Testing

1. **Random Spin:**
   - Click wheel multiple times
   - Verify different winners
   - Verify animation smoothness

2. **Fixed Winner:**
   - Select winner index
   - Spin wheel
   - Verify lands on selected winner
   - Compare animation to random spin

3. **Excel Upload:**
   - Upload valid file
   - Upload invalid file
   - Upload multiple files
   - Verify error handling

## Performance Characteristics

### Excel Parsing

- **Time Complexity:** O(n) where n = number of rows
- **Space Complexity:** O(n) for participant storage
- **Typical Performance:** < 1 second for 1000 rows

### Wheel Animation

- **Frame Rate:** 60 FPS (browser-dependent)
- **Memory:** Minimal (canvas rendering)
- **CPU:** Low (easing calculations are simple)

### Fixed Winner Calculation

- **Time Complexity:** O(1)
- **Space Complexity:** O(1)
- **Performance:** < 1ms

## Security Considerations

### Authentication

- HttpOnly cookies prevent XSS attacks
- Secure flag ensures HTTPS-only transmission
- Session expiration limits exposure window

### File Upload

- Server-side validation prevents malicious files
- File type checking (.xlsx, .xls only)
- Size limits enforced by Next.js

### API Routes

- Admin routes require authentication
- Public routes only return display names
- No sensitive data exposed

## Future Enhancements

### Short Term

1. Add loading states for better UX
2. Add error boundaries for error handling
3. Add success/error notifications

### Medium Term

1. Add database persistence
2. Add spin history tracking
3. Add analytics dashboard

### Long Term

1. Add multi-admin support
2. Add role-based permissions
3. Add API for external integrations

## Migration Guide

### From Vite to Next.js

If migrating from existing Vite app:

1. Copy `spin-wheel` folder to preserve original
2. Create Next.js structure
3. Copy components to `components/`
4. Import styles in `styles/globals.css`
5. Create pages using components
6. Test thoroughly

### Upgrading to Database

To add database persistence:

1. Install database client
2. Create migration scripts
3. Update `lib/storage.ts`
4. Test data migration
5. Deploy with database connection

## Conclusion

This architecture successfully extends the existing wheel spinner with minimal changes while adding powerful admin capabilities. The fixed winner feature is undetectable and maintains the natural feel of random spins.

