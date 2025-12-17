'use client'

/**
 * EXTENDED WHEEL APP COMPONENT
 * 
 * This component extends the existing spin-wheel App.jsx with:
 * 1. Support for fixed winner spins (via optional targetWinnerIndex prop)
 * 2. Data loading from API instead of manual textarea input
 * 3. Preserves ALL existing animation, easing, and visual behavior
 * 
 * KEY CHANGES:
 * - spinWheel() now accepts optional targetWinnerIndex parameter
 * - When targetWinnerIndex is provided, endRotation is calculated to land on that winner
 * - All other logic (easing, duration, animation) remains identical
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import confetti from 'canvas-confetti'
import { FiSettings, FiFile, FiFolder, FiSave, FiShare2, FiSearch, FiMaximize, FiChevronDown, FiGlobe, FiShuffle, FiArrowUp, FiArrowDown, FiPlay, FiSquare, FiHelpCircle, FiImage, FiDroplet } from 'react-icons/fi'
import CanvasWheel from './CanvasWheel'
import { buildTicketAngleMap, getAngleForTicket } from '@/lib/ticket-angle-mapper'
import { calculateFixedSpinByTicket } from '@/lib/fixed-spin-physics'

export default function WheelApp({ 
  initialNames = [],
  initialTicketNumbers = [], // Ticket numbers in same order as names
  onSpinComplete = null, // Optional callback
  fixedTicketNumber = null, // Legacy: Single fixed ticket (deprecated)
  fixedTicketsQueue = [], // NEW: Queue of up to 3 fixed tickets (in order)
  snapshotVersion = null // For tracking (optional)
}) {
  // CRITICAL: Track initialization state to prevent reinit during spin
  const isInitializedRef = useRef(false)
  const isInitialMountRef = useRef(true)
  const previousNamesRef = useRef([])
  const previousTicketNumbersRef = useRef([])
  const currentSnapshotVersionRef = useRef(snapshotVersion) // Track snapshot version
  const [isSpinning, setIsSpinning] = useState(false) // Declare early for use in memo
  
  // CRITICAL: Build ticket → angle map ONCE on load
  // Stored in ref (not state) to prevent re-renders
  const ticketAngleMapRef = useRef(null)
  
  // CRITICAL: Fixed tickets queue (NOT React state - animation control)
  // Queue is consumed on each spin, stored in ref to prevent re-renders
  const fixedTicketsQueueRef = useRef([])
  const spinCountRef = useRef(0) // Track number of spins
  
  // CRITICAL FIX: Memoize names to prevent unnecessary updates during animation
  // ONLY update if:
  // 1. Initial mount, OR
  // 2. Names changed AND wheel is idle (not spinning)
  const stableNames = useMemo(() => {
    // If spinning, NEVER update names
    if (isSpinning && isInitializedRef.current) {
      return previousNamesRef.current
    }
    
    // Only update if names actually changed (deep comparison)
    const namesChanged = 
      previousNamesRef.current.length !== initialNames.length ||
      previousNamesRef.current.some((name, idx) => name !== initialNames[idx])
    
    const ticketNumbersChanged =
      previousTicketNumbersRef.current.length !== initialTicketNumbers.length ||
      previousTicketNumbersRef.current.some((ticket, idx) => ticket !== initialTicketNumbers[idx])
    
    if ((namesChanged || ticketNumbersChanged || isInitialMountRef.current) && !isSpinning) {
      previousNamesRef.current = [...initialNames]
      previousTicketNumbersRef.current = [...initialTicketNumbers]
      isInitialMountRef.current = false
      isInitializedRef.current = true
      
      // Build ticket → angle map ONCE when names change
      if (initialNames.length > 0 && initialTicketNumbers.length === initialNames.length) {
        const entries = initialNames.map((name, idx) => ({
          ticketNumber: initialTicketNumbers[idx],
          label: name
        }))
        ticketAngleMapRef.current = buildTicketAngleMap(entries)
        console.log('Ticket angle map built:', {
          entryCount: entries.length,
          sampleTickets: Array.from(ticketAngleMapRef.current.ticketToAngle.keys()).slice(0, 3)
        })
      }
      
      // Initialize fixed tickets queue from props
      // Support both legacy single ticket and new queue system
      if (fixedTicketsQueue && fixedTicketsQueue.length > 0) {
        fixedTicketsQueueRef.current = [...fixedTicketsQueue] // Copy array
        console.log('Fixed tickets queue initialized:', fixedTicketsQueueRef.current)
      } else if (fixedTicketNumber) {
        // Legacy: Single ticket → convert to queue
        fixedTicketsQueueRef.current = [fixedTicketNumber]
        console.log('Legacy fixed ticket converted to queue:', fixedTicketsQueueRef.current)
      } else {
        fixedTicketsQueueRef.current = []
      }
      
      spinCountRef.current = 0 // Reset spin count
      
      return [...initialNames]
    }
    return previousNamesRef.current
  }, [initialNames, initialTicketNumbers, fixedTicketsQueue, fixedTicketNumber, isSpinning])
  
  const [names, setNames] = useState(stableNames)
  const [results, setResults] = useState([])
  const [activeTab, setActiveTab] = useState('entries')
  const [namesText, setNamesText] = useState(initialNames.join('\n'))
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [finalRotation, setFinalRotation] = useState(0) // Single rotation value - the only source of truth
  const [isSidebarHidden, setIsSidebarHidden] = useState(false)
  const [showWinner, setShowWinner] = useState(false)
  const [winner, setWinner] = useState(null)
  const [showCustomize, setShowCustomize] = useState(false)
  const [customizeTab, setCustomizeTab] = useState('during-spin')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [settings, setSettings] = useState({
    sound: 'Ticking sound',
    volume: 50,
    displayDuplicates: true,
    spinSlowly: false,
    showTitle: true,
    spinTime: 3,
    maxNamesVisible: 1000,
    afterSpinSound: 'Subdued applause',
    afterSpinVolume: 50,
    animateWinningEntry: false,
    launchConfetti: true,
    autoRemoveWinner: false,
    displayPopup: true,
    popupMessage: 'We have a winner!',
    displayRemoveButton: true,
    playClickSoundOnRemove: false,
    oneColorPerSection: true,
    wheelBackgroundImage: false,
    selectedTheme: '',
    colorPalettes: [true, true, true, true, true, false, false, false],
    centerImage: '',
    imageSize: 'S',
    pageBackgroundColor: false,
    displayColorGradient: true,
    contours: false,
    wheelShadow: true,
    pointerChangesColor: true
  })
  const wheelRef = useRef(null)
  const winnerProcessedRef = useRef(false)
  const animationFrameRef = useRef(null)
  const animationCompletedRef = useRef(false)
  const isFrozenRef = useRef(false)

  // Audio Context for zero-latency synthetic sounds
  const audioContextRef = useRef(null)

  // Initialize Audio Context on user interaction
  useEffect(() => {
    const initAudio = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
      }
    }
    window.addEventListener('click', initAudio)
    window.addEventListener('keydown', initAudio)
    return () => {
      window.removeEventListener('click', initAudio)
      window.removeEventListener('keydown', initAudio)
      if (audioContextRef.current) audioContextRef.current.close()
    }
  }, [])

  // CRITICAL: Update names ONLY when idle and snapshot changed
  // NEVER update during active spin
  useEffect(() => {
    // Skip update if currently spinning (preserve animation state)
    if (isSpinning) {
      return
    }
    
    // Skip if already initialized with same version
    if (isInitializedRef.current && snapshotVersion === currentSnapshotVersionRef.current) {
      return
    }
    
    // Only update if names actually changed
    const namesChanged = 
      names.length !== stableNames.length ||
      names.some((name, idx) => name !== stableNames[idx])
    
    const versionChanged = snapshotVersion !== currentSnapshotVersionRef.current
    
    if ((namesChanged || versionChanged) && stableNames.length > 0 && !isSpinning) {
      // Use requestIdleCallback for non-blocking update (fallback to setTimeout)
      const updateNames = () => {
        if (isSpinning) return // Double-check spin state
        
        setNames([...stableNames])
        currentSnapshotVersionRef.current = snapshotVersion
        isInitializedRef.current = true
        
        // CRITICAL FIX: Defer expensive string operation
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(() => {
            setNamesText(stableNames.join('\n'))
          }, { timeout: 100 })
        } else {
          setTimeout(() => {
            setNamesText(stableNames.join('\n'))
          }, 0)
        }
      }
      
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(updateNames, { timeout: 100 })
      } else {
        setTimeout(updateNames, 0)
      }
    }
  }, [stableNames, snapshotVersion, isSpinning]) // Include snapshotVersion

  // Synthetic "Click" Sound
  const playClickSound = useCallback(() => {
    const ctx = audioContextRef.current
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume()

    const t = ctx.currentTime
    const bufferSize = ctx.sampleRate * 0.01
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1
    }
    const noise = ctx.createBufferSource()
    noise.buffer = buffer
    const noiseGain = ctx.createGain()
    noiseGain.gain.setValueAtTime(0.5, t)
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.01)
    noise.connect(noiseGain)
    noiseGain.connect(ctx.destination)
    noise.start(t)

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.setValueAtTime(800, t)
    osc.frequency.exponentialRampToValueAtTime(0.01, t + 0.05)
    gain.gain.setValueAtTime(0.3, t)
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 0.05)
  }, [])

  // Synthetic "Fanfare" Sound
  const playFanfare = useCallback(() => {
    const ctx = audioContextRef.current
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume()

    const t = ctx.currentTime
    const freqs = [523.25, 659.25, 783.99, 1046.50]

    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.value = f
      const start = t + i * 0.1
      const dur = 0.8
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.2, start + 0.05)
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(start)
      osc.stop(start + dur)
    })
  }, [])

  // Continuous slow rotation
  useEffect(() => {
    if (isSpinning || winner || showWinner || isFrozenRef.current) {
      return
    }

    let lastTime = performance.now()
    const slowRotationFrameRef = { current: null }

    const animateSlow = (currentTime) => {
      if (isSpinning || winner || showWinner || isFrozenRef.current) {
        slowRotationFrameRef.current = null
        return
      }

      const delta = currentTime - lastTime
      lastTime = currentTime
      setFinalRotation(prev => (prev + (1.5 * delta / 50)) % 360)
      slowRotationFrameRef.current = requestAnimationFrame(animateSlow)
    }

    slowRotationFrameRef.current = requestAnimationFrame(animateSlow)
    return () => {
      if (slowRotationFrameRef.current) {
        cancelAnimationFrame(slowRotationFrameRef.current)
        slowRotationFrameRef.current = null
      }
    }
  }, [isSpinning, winner, showWinner])

  /**
   * EXTENDED SPIN WHEEL FUNCTION
   * 
   * CHANGE: Added optional targetWinnerIndex parameter
   * When provided, calculates endRotation to land on that winner
   * All other logic (easing, duration, animation) remains identical
   */
  // CRITICAL FIX: Use ref for names in animation to prevent dependency issues
  const namesRef = useRef(stableNames)
  useEffect(() => {
    namesRef.current = stableNames // Update ref when stable names change
  }, [stableNames])
  
  // CRITICAL: Use ref for ticket numbers in animation to prevent dependency issues
  const ticketNumbersRef = useRef(initialTicketNumbers)
  useEffect(() => {
    ticketNumbersRef.current = initialTicketNumbers // Update ref when ticket numbers change
  }, [initialTicketNumbers])
  
  const spinWheel = useCallback(() => {
    const currentNames = namesRef.current // Use ref instead of state
    const currentTicketAngleMap = ticketAngleMapRef.current
    const currentQueue = fixedTicketsQueueRef.current
    
    if (isSpinning || currentNames.length === 0) return

    // Cancel any existing animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    // Clear frozen state when starting new spin
    isFrozenRef.current = false
    animationCompletedRef.current = false
    winnerProcessedRef.current = false

    setIsSpinning(true)

    // Get current rotation - this is the ONLY rotation value
    const startRotation = finalRotation
    let lastTickRotation = startRotation

    // Duration: 11000ms (11s) - PRESERVED from original
    let duration = 11000

    let endRotation
    let currentFixedTicket = null

    // STEP 1: Determine Mode - Get next ticket from queue
    console.log('🎡 Spin started. Current queue:', currentQueue, 'Queue length:', currentQueue.length)
    
    if (currentQueue.length > 0) {
      // CRITICAL: Create a copy before shifting to avoid mutation issues
      const queueCopy = [...currentQueue]
      // Consume first ticket from queue
      currentFixedTicket = queueCopy.shift() || null
      fixedTicketsQueueRef.current = queueCopy // Update ref with remaining queue
      spinCountRef.current += 1
      
      console.log('✅ Fixed spin mode activated:', {
        ticket: currentFixedTicket,
        remainingInQueue: queueCopy.length,
        spinCount: spinCountRef.current,
        fullQueueBefore: currentQueue,
        queueAfter: queueCopy
      })
    } else {
      // Queue empty → natural spin
      currentFixedTicket = null
      spinCountRef.current += 1
      console.log('🎲 Natural spin mode (queue empty), spin count:', spinCountRef.current)
    }

    // STEP 2: Compute Rotation
    if (currentFixedTicket !== null && currentTicketAngleMap) {
      // FIXED SPIN: Use ticket number → angle mapping (NO INDEX)
      try {
        // Lookup angle for ticket number (O(1))
        const targetAngle = getAngleForTicket(currentFixedTicket, currentTicketAngleMap)
        
        if (targetAngle === null) {
          throw new Error(`Ticket number "${currentFixedTicket}" not found in angle map`)
        }
        
        // Select rotation profile for anti-detection (A, B, or C)
        const profileIndex = spinCountRef.current % 3 // Cycle through profiles
        const profiles = ['A', 'B', 'C']
        const selectedProfile = profiles[profileIndex]
        
        // Calculate fixed spin rotation using ticket number → angle
        const fixedResult = calculateFixedSpinByTicket(
          startRotation,
          currentFixedTicket,
          currentTicketAngleMap,
          selectedProfile
        )
        
        // Validate result
        if (fixedResult.endRotation === undefined || isNaN(fixedResult.endRotation)) {
          throw new Error('Invalid fixed rotation calculation')
        }
        
        endRotation = fixedResult.endRotation
        duration = fixedResult.duration // Use profile-specific duration
        
        console.log('Fixed spin by ticket:', {
          ticketNumber: currentFixedTicket,
          targetAngle,
          endRotation,
          duration,
          profile: fixedResult.profile,
          remainingInQueue: currentQueue.length
        })
      } catch (error) {
        // FAIL-SAFE: Fallback to natural spin
        console.warn('Fixed spin by ticket failed, using natural spin:', error)
        // Clear corrupted queue
        fixedTicketsQueueRef.current = []
        // Fall through to natural spin logic below
        const minRotations = 5
        const maxRotations = 8
        const spins = minRotations + Math.random() * (maxRotations - minRotations)
        const totalRotationDegrees = spins * 360
        const randomAngle = Math.random() * 360
        endRotation = startRotation + totalRotationDegrees + randomAngle
      }
    } else {
      // NATURAL SPIN: Original random logic - UNCHANGED
      const minRotations = 5
      const maxRotations = 8
      const spins = minRotations + Math.random() * (maxRotations - minRotations)
      const totalRotationDegrees = spins * 360
      const randomAngle = Math.random() * 360
      endRotation = startRotation + totalRotationDegrees + randomAngle
    }

    const startTime = performance.now()

    // ORIGINAL EASING FUNCTION - UNCHANGED
    const ease = (t) => {
      const t1 = 0.20
      const p1 = 3
      const p2 = 5
      const Y = (p1 * (1 - t1)) / (p2 * t1 + p1 * (1 - t1))
      const x_split = 1 - Y
      const k = x_split / Math.pow(t1, p1)
      const A = Y / Math.pow(1 - t1, p2)

      if (t < t1) {
        return k * Math.pow(t, p1)
      } else {
        return 1 - A * Math.pow(1 - t, p2)
      }
    }

    // ORIGINAL ANIMATION LOGIC - UNCHANGED
    const animate = () => {
      if (animationCompletedRef.current) {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
          animationFrameRef.current = null
        }
        return
      }

      const elapsed = performance.now() - startTime
      const progress = Math.min(elapsed / duration, 1)

      if (progress < 1) {
        if (animationCompletedRef.current) {
          return
        }
        const easedProgress = ease(progress)
        const current = startRotation + (endRotation - startRotation) * easedProgress
        if (Math.abs(current - lastTickRotation) >= 25) {
          playClickSound()
          lastTickRotation = current
        }
        setFinalRotation(current)
        animationFrameRef.current = requestAnimationFrame(animate)
      } else {
        animationCompletedRef.current = true

        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
          animationFrameRef.current = null
        }

        setFinalRotation(endRotation)
        isFrozenRef.current = true

        if (!winnerProcessedRef.current) {
          winnerProcessedRef.current = true

          // ORIGINAL WINNER CALCULATION - UNCHANGED
          const frozenRot = endRotation
          const sliceAngle = 360 / currentNames.length // Use ref value
          const R = ((frozenRot % 360) + 360) % 360
          const pointerAngleInOriginal = (360 - R) % 360

          let selectedIndex = 0
          let found = false

          for (let i = 0; i < currentNames.length; i++) { // Use ref value
            const sliceStart = (i * sliceAngle - 90 + 360) % 360
            const sliceEnd = ((i + 1) * sliceAngle - 90 + 360) % 360
            let inSlice = false

            if (sliceStart < sliceEnd) {
              inSlice = pointerAngleInOriginal >= sliceStart && pointerAngleInOriginal < sliceEnd
            } else {
              inSlice = pointerAngleInOriginal >= sliceStart || pointerAngleInOriginal < sliceEnd
            }

            if (inSlice) {
              selectedIndex = i
              found = true
              break
            }
          }

          if (!found) {
            let minDist = Infinity
            for (let i = 0; i < currentNames.length; i++) { // Use ref value
              const sliceCenter = (i * sliceAngle - 90 + sliceAngle / 2 + 360) % 360
              let dist = Math.abs(pointerAngleInOriginal - sliceCenter)
              if (dist > 180) dist = 360 - dist
              if (dist < minDist) {
                minDist = dist
                selectedIndex = i
              }
            }
          }

          selectedIndex = selectedIndex % currentNames.length // Use ref value
          if (selectedIndex < 0) {
            selectedIndex = (selectedIndex + currentNames.length) % currentNames.length // Use ref value
          }

          let winnerName = currentNames[selectedIndex] // Use ref value
          // CRITICAL: Strip any ticket number from the name (e.g., "John Doe - T001" -> "John Doe")
          // Remove ticket number patterns like "- T001", " (T001)", etc.
          winnerName = winnerName.replace(/\s*[-–—]\s*T\d+/i, '').replace(/\s*\(T\d+\)/i, '').replace(/\s*T\d+\s*/i, '').trim()
          const winnerColor = colors[selectedIndex % colors.length]
          
          // Get ticket number for winner
          const currentTicketNumbers = ticketNumbersRef.current
          const winnerTicketNumber = currentTicketNumbers && currentTicketNumbers.length > selectedIndex 
            ? currentTicketNumbers[selectedIndex] 
            : null

          setWinner({ name: winnerName, ticketNumber: winnerTicketNumber, color: winnerColor, index: selectedIndex })
          setIsSpinning(false)
          winnerProcessedRef.current = false

          // Confetti
          const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 2000 }
          confetti({ ...defaults, particleCount: 100, origin: { y: 0.6 } })
          setTimeout(() => confetti({ ...defaults, particleCount: 50, angle: 60, origin: { x: 0, y: 0.7 } }), 200)
          setTimeout(() => confetti({ ...defaults, particleCount: 50, angle: 120, origin: { x: 1, y: 0.7 } }), 400)

          playFanfare()

          setTimeout(() => {
            setShowWinner(true)
          }, 1000)

          // Call external callback if provided
          if (onSpinComplete) {
            onSpinComplete(selectedIndex, winnerName)
          }
        }
      }
    }

    animationFrameRef.current = requestAnimationFrame(animate)
  }, [isSpinning, finalRotation, playClickSound, playFanfare, onSpinComplete]) // CRITICAL FIX: Removed names from deps - use ref instead

  const handleWheelClick = () => {
    if (!showWinner && !isSpinning) {
      // Spin wheel - fixedTicketNumber is already set in props
      spinWheel()
    }
  }

  const handleCloseWinner = () => {
    setShowWinner(false)
    isFrozenRef.current = false
    setWinner(null)
  }

  const handleRemoveWinner = () => {
    if (winner) {
      const lines = namesText.split('\n').filter(line => line.trim() !== winner.name)
      setNamesText(lines.join('\n'))
      setNames(names.filter(name => name !== winner.name))
      setShowWinner(false)
      isFrozenRef.current = false
      setWinner(null)
    }
  }

  // CRITICAL FIX: Memoize colors array to prevent recreation
  const colors = useMemo(() => ['#efb71d', '#24a643', '#4d7ceb', '#d82135'], [])

  const getTextColor = (bgColor) => {
    if (bgColor === '#efb71d' || bgColor === '#24a643') return 'black'
    return 'white'
  }

  // CRITICAL FIX: Memoize pointer color calculation using ref
  const getCurrentPointerColor = useCallback(() => {
    const currentNames = namesRef.current // Use ref instead of state
    if (currentNames.length === 0) return '#ffd700'
    const sliceAngle = 360 / currentNames.length
    const R = ((finalRotation % 360) + 360) % 360
    const pointerAngle = (360 - R) % 360
    const adjustedAngle = (pointerAngle + 90) % 360
    const index = Math.floor(adjustedAngle / sliceAngle)
    const safeIndex = index % currentNames.length
    return colors[safeIndex % colors.length]
  }, [finalRotation, colors])

  // CRITICAL FIX: Memoize pointer color to prevent recalculation
  const pointerColor = useMemo(() => getCurrentPointerColor(), [getCurrentPointerColor])

  // Import existing CSS - this will be handled by globals.css importing App.css
  return (
    <div className="app">
      {/* Header Navigation Bar */}
      <header className="header">
        <div className="header-right">
          <button className="header-btn" title="Customize" onClick={() => setShowCustomize(true)}>
            <FiSettings className="icon" />
            <span>Customize</span>
          </button>
          <button className="header-btn" title="New" onClick={() => {
            setNames([])
            setNamesText('')
            setResults([])
            setFinalRotation(0)
            setIsSpinning(false)
            setShowWinner(false)
            setWinner(null)
          }}>
            <FiFile className="icon" />
            <span>New</span>
          </button>
          <button className="header-btn" title="Fullscreen" onClick={() => setIsFullscreen(true)}>
            <FiMaximize className="icon" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="main-content">
        {/* Center - Wheel */}
        <div className="wheel-container">
          <div className="wheel-wrapper" onClick={handleWheelClick} style={{ cursor: (isSpinning || showWinner) ? 'not-allowed' : 'pointer' }}>
            <div style={{ width: '100%', height: '100%' }}>
              <CanvasWheel
                names={names}
                colors={colors}
                rotation={finalRotation}
                width={750}
                height={750}
              />
            </div>

            {/* Fixed arc text overlay */}
            {!isSpinning && !showWinner && !winner && (
              <svg
                className="wheel-text-overlay"
                viewBox="0 0 750 750"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none',
                  zIndex: 5
                }}
              >
                <defs>
                  <path id="arcPath1" d="M 295 295 A 80 80 0 0 1 455 295" fill="none" />
                  <path id="arcPath2" d="M 280 470 Q 375 590 470 470" fill="none" />
                </defs>
                <text
                  fill="white"
                  fontSize="42"
                  fontWeight="bold"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{
                    textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
                    pointerEvents: 'none'
                  }}
                >
                  <textPath href="#arcPath1" startOffset="50%">
                    Click to spin
                  </textPath>
                </text>
                <text
                  fill="white"
                  fontSize="28"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{
                    textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
                    pointerEvents: 'none'
                  }}
                >
                  <textPath href="#arcPath2" startOffset="50%">
                    or press ctrl+enter
                  </textPath>
                </text>
              </svg>
            )}

            {/* Golden 3D Pointer */}
            <svg
              className="wheel-pointer"
              viewBox="0 0 100 100"
              xmlns="http://www.w3.org/2000/svg"
              style={{
                pointerEvents: 'none'
              }}
            >
              <defs>
                <linearGradient id="dynamicGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={pointerColor} style={{ filter: 'brightness(1.5)' }} />
                  <stop offset="50%" stopColor={pointerColor} />
                  <stop offset="100%" stopColor={pointerColor} style={{ filter: 'brightness(0.7)' }} />
                </linearGradient>
                <filter id="bevel" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur" />
                  <feOffset in="blur" dx="2" dy="2" result="offsetBlur" />
                  <feSpecularLighting in="blur" surfaceScale="5" specularConstant=".75" specularExponent="20" lightingColor="#bbbbbb" result="specOut">
                    <fePointLight x="-5000" y="-10000" z="20000" />
                  </feSpecularLighting>
                  <feComposite in="specOut" in2="SourceAlpha" operator="in" result="specOut" />
                  <feComposite in="SourceGraphic" in2="specOut" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="litPaint" />
                  <feMerge>
                    <feMergeNode in="offsetBlur" />
                    <feMergeNode in="litPaint" />
                  </feMerge>
                </filter>
              </defs>
              <path
                d="M 10 50 L 90 20 L 90 80 Z"
                fill="url(#dynamicGradient)"
                stroke={pointerColor}
                strokeWidth="2"
                filter="url(#bevel)"
              />
              <path
                d="M 15 50 L 85 24 L 85 76 Z"
                fill="none"
                stroke="rgba(255,255,255,0.4)"
                strokeWidth="2"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Winner Pop-up */}
      {showWinner && winner && (
        <div className="winner-overlay" onClick={handleCloseWinner}>
          <div className="winner-popup" onClick={(e) => e.stopPropagation()}>
            <div className="winner-header" style={{ backgroundColor: winner.color }}>
              <h2>We have a winner!</h2>
              <button className="winner-close-btn" onClick={handleCloseWinner}>×</button>
            </div>
            <div className="winner-content">
              <div className="winner-name">{winner.name}</div>
              {winner.ticketNumber && (
                <div className="winner-ticket" style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '24px', marginTop: '10px', fontWeight: '400' }}>
                  Ticket: {winner.ticketNumber}
                </div>
              )}
              <div className="winner-buttons">
                <button className="winner-btn close-btn" onClick={handleCloseWinner}>Close</button>
                <button className="winner-btn remove-btn" onClick={handleRemoveWinner}>Remove</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

