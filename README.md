# Wheel Spinner Application - Extended with Admin Panel

## Overview

This application extends an existing wheel spinner (`spin-wheel` folder) with:
- Secure admin panel for Excel data management
- Fixed winner spin capability (undetectable)
- Mixed spin sequences
- In-memory data storage

## Architecture Decisions

### 1. **Preservation of Existing Wheel Logic**

**What was preserved:**
- All existing animation logic (`spinWheel` function)
- Original easing function (piecewise acceleration/deceleration)
- Duration calculation (11000ms)
- Winner calculation algorithm
- Canvas rendering (`CanvasWheel` component)
- All visual styling and responsive behavior

**What was extended:**
- `spinWheel()` function now accepts optional `targetWinnerIndex` parameter
- When `targetWinnerIndex` is provided, `endRotation` is calculated using `calculateFixedWinnerRotation()`
- All other logic (easing, duration, animation frames) remains identical

**Why this approach:**
- Minimal code changes reduce risk of breaking existing behavior
- Fixed spins look identical to random spins (same easing, duration, visual effects)
- Easy to verify correctness by comparing spin animations

### 2. **Data Flow**

```
Excel Files → Admin Upload → Parse & Validate → In-Memory Storage → Public Wheel Display
```

**Storage Strategy:**
- In-memory storage (`lib/storage.ts`) for simplicity
- No database required (as per requirements)
- Data persists during server runtime
- For production persistence, see comments in `lib/storage.ts`

**Why in-memory:**
- Meets requirement: "No database required"
- Simple deployment on Vercel
- Can be upgraded to PostgreSQL/MongoDB later if needed

### 3. **Authentication**

**Implementation:**
- Cookie-based sessions (httpOnly, secure in production)
- Environment variable credentials (`ADMIN_USERNAME`, `ADMIN_PASSWORD`)
- Session expiration: 24 hours

**Why this approach:**
- Simple and secure for single-admin use case
- No external dependencies
- Can be upgraded to JWT or OAuth if needed

### 4. **Excel Parsing**

**Features:**
- Flexible column detection (case-insensitive)
- Validates required columns: First Name, Last Name, Ticket Number
- Handles duplicate ticket numbers
- Enforces 3000 entry limit with random trimming
- Returns detailed error messages

**Why this approach:**
- Handles various Excel formats
- Clear error messages for debugging
- Fair random trimming if files exceed limit

## File Structure

```
/
├── app/
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Public wheel page
│   ├── admin/
│   │   ├── page.tsx            # Admin panel (protected)
│   │   ├── AdminPanel.tsx      # Admin UI component
│   │   └── login/
│   │       ├── page.tsx        # Login page
│   │       └── login.css       # Login styles
│   └── api/
│       ├── admin/
│       │   ├── login/route.ts   # Login endpoint
│       │   ├── logout/route.ts  # Logout endpoint
│       │   ├── upload/route.ts  # Excel upload
│       │   └── data/route.ts    # Get wheel data
│       └── wheel/
│           └── entries/route.ts # Public entries endpoint
├── components/
│   ├── CanvasWheel.jsx         # Existing wheel component (unchanged)
│   └── WheelApp.jsx            # Extended wheel app with fixed winner support
├── lib/
│   ├── auth.ts                 # Authentication utilities
│   ├── excel-parser.ts         # Excel parsing logic
│   ├── storage.ts              # In-memory data storage
│   └── wheel-physics.ts        # Fixed winner calculation
├── styles/
│   └── globals.css             # Global styles (imports existing App.css)
└── spin-wheel/                 # Original wheel (preserved)
    └── src/
        ├── App.jsx             # Original app logic
        └── App.css             # Original styles
```

## Key Code Changes

### 1. Extended `spinWheel` Function

**Location:** `components/WheelApp.jsx`

**Change:**
```javascript
// BEFORE (original):
const spinWheel = useCallback(() => {
  // ... setup code ...
  const endRotation = startRotation + totalRotationDegrees + randomAngle
  // ... animation code ...
})

// AFTER (extended):
const spinWheel = useCallback((fixedWinnerIndex = null) => {
  // ... setup code ...
  
  let endRotation
  if (fixedWinnerIndex !== null && typeof fixedWinnerIndex === 'number') {
    // Calculate fixed winner rotation
    const fixedResult = calculateFixedWinnerRotation(
      startRotation,
      fixedWinnerIndex,
      names.length
    )
    endRotation = fixedResult.endRotation
  } else {
    // Original random logic - UNCHANGED
    const minRotations = 5
    const maxRotations = 8
    const spins = minRotations + Math.random() * (maxRotations - minRotations)
    const totalRotationDegrees = spins * 360
    const randomAngle = Math.random() * 360
    endRotation = startRotation + totalRotationDegrees + randomAngle
  }
  
  // ... animation code (unchanged) ...
})
```

**Why:**
- Only changes `endRotation` calculation
- All animation, easing, duration logic preserved
- Fixed spins are visually indistinguishable from random

### 2. Fixed Winner Calculation

**Location:** `lib/wheel-physics.ts`

**Algorithm:**
1. Calculate target slice center angle
2. Calculate current pointer position
3. Calculate angle needed to reach target
4. Add random rotations (5-8) + micro offset (±2°) for variation
5. Return `endRotation` that lands on target winner

**Why:**
- Matches existing random spin characteristics
- Micro offset ensures spins don't look identical
- Uses same duration and rotation count as random spins

## Deployment to Vercel

### 1. Environment Variables

Set in Vercel dashboard:
```
ADMIN_USERNAME=your_admin_username
ADMIN_PASSWORD=your_secure_password
NODE_ENV=production
```

### 2. Build Configuration

Vercel automatically detects Next.js. No special configuration needed.

### 3. Deploy Steps

```bash
# Install dependencies
npm install

# Build locally (optional)
npm run build

# Deploy to Vercel
vercel

# Or connect GitHub repo for automatic deployments
```

### 4. Post-Deployment

1. Set environment variables in Vercel dashboard
2. Access admin panel at: `https://your-domain.com/admin`
3. Upload Excel files via admin panel
4. Public wheel available at: `https://your-domain.com`

## Performance Considerations

1. **In-Memory Storage:**
   - Fast reads/writes
   - Data lost on server restart
   - Suitable for temporary events

2. **Excel Parsing:**
   - Parsed server-side (prevents client memory issues)
   - 3000 entry limit enforced
   - Efficient streaming for large files

3. **Wheel Animation:**
   - Client-side rendering (60fps)
   - Uses `requestAnimationFrame`
   - No performance impact from fixed winner logic

## Security Considerations

1. **Admin Authentication:**
   - HttpOnly cookies prevent XSS
   - Secure flag in production (HTTPS only)
   - Session expiration (24 hours)

2. **API Routes:**
   - Admin routes check authentication
   - Public routes only return display names (no sensitive data)

3. **File Upload:**
   - Server-side validation
   - File type checking (.xlsx, .xls)
   - Size limits enforced by Next.js

## Future Enhancements

1. **Persistence:**
   - Add PostgreSQL for long-term storage
   - See comments in `lib/storage.ts` for implementation

2. **Mixed Sequences:**
   - UI for defining spin sequences
   - Store sequences in admin panel
   - Execute sequences automatically

3. **Analytics:**
   - Track spin history
   - Winner statistics
   - Entry distribution

## Testing the Fixed Winner Feature

1. Login to admin panel
2. Upload Excel file with entries
3. Select "Fixed Winner" mode
4. Enter winner index (0-based)
5. Click wheel to spin
6. Verify wheel lands on selected winner
7. Compare animation to random spin (should be identical)

## Troubleshooting

**Wheel not spinning:**
- Check browser console for errors
- Verify entries are loaded (`/api/wheel/entries`)
- Ensure `names` array is not empty

**Fixed winner not working:**
- Verify `targetWinnerIndex` is valid (0 to entries.length - 1)
- Check `calculateFixedWinnerRotation` is called correctly
- Ensure `spinMode === 'fixed'`

**Excel upload fails:**
- Check file format (.xlsx or .xls)
- Verify required columns exist
- Check file size (Next.js limit: 10MB)

## License

MIT License - See LICENSE file for details

