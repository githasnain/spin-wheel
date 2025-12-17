import React, { useRef, useEffect, useMemo } from 'react'

const CanvasWheel = ({ names, colors, rotation, width = 800, height = 800 }) => {
    const canvasRef = useRef(null)
    // CRITICAL FIX: Store previous values to prevent unnecessary redraws
    const previousNamesRef = useRef([])
    const previousRotationRef = useRef(rotation)
    const isDrawingRef = useRef(false)
    // PERFORMANCE: Offscreen canvas for caching static wheel (without rotation)
    const offscreenCanvasRef = useRef(null)
    const offscreenCtxRef = useRef(null)
    const cachedWheelRef = useRef(false)

    // CRITICAL FIX: Memoize names to prevent array recreation on every render
    const stableNames = useMemo(() => {
        const changed = 
            previousNamesRef.current.length !== names.length ||
            previousNamesRef.current.some((name, idx) => name !== names[idx])
        
        if (changed) {
            previousNamesRef.current = [...names]
            // PERFORMANCE: Invalidate cache when names change
            cachedWheelRef.current = false
        }
        return previousNamesRef.current
    }, [names])

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        
        const dpr = window.devicePixelRatio || 1

        const handleResize = () => {
            if (isDrawingRef.current) return // Prevent concurrent draws
            
            const displayWidth = canvas.clientWidth || width
            const displayHeight = canvas.clientHeight || height

            // Set actual size in memory (scaled to account for extra pixel density)
            canvas.width = displayWidth * dpr
            canvas.height = displayHeight * dpr

            // Normalize coordinate system to use css pixels
            ctx.scale(dpr, dpr)

            const centerX = displayWidth / 2
            const centerY = displayHeight / 2
            // FIXED 20px padding (Matches App.css)
            const radius = Math.min(centerX, centerY) - 20

            drawWheel(centerX, centerY, radius, displayWidth, displayHeight)
        }

        // CRITICAL FIX: Throttled resize handler
        let resizeTimeout = null
        const throttledResize = () => {
            if (resizeTimeout) return
            resizeTimeout = setTimeout(() => {
                handleResize()
                resizeTimeout = null
            }, 16) // ~60fps throttle
        }

        const resizeObserver = new ResizeObserver(throttledResize)
        resizeObserver.observe(canvas)

        // Initial Draw
        handleResize()

        // PERFORMANCE: Draw static wheel to offscreen canvas (cached)
        function drawStaticWheel(centerX, centerY, radius, displayWidth, displayHeight) {
            const numSegments = stableNames.length
            if (numSegments === 0) return
            
            // Create offscreen canvas if needed
            if (!offscreenCanvasRef.current) {
                offscreenCanvasRef.current = document.createElement('canvas')
                offscreenCanvasRef.current.width = displayWidth * (window.devicePixelRatio || 1)
                offscreenCanvasRef.current.height = displayHeight * (window.devicePixelRatio || 1)
                offscreenCtxRef.current = offscreenCanvasRef.current.getContext('2d')
                if (!offscreenCtxRef.current) return
                const dpr = window.devicePixelRatio || 1
                offscreenCtxRef.current.scale(dpr, dpr)
            }
            
            const offCtx = offscreenCtxRef.current
            const offCanvas = offscreenCanvasRef.current
            
            // Resize offscreen canvas if needed
            const dpr = window.devicePixelRatio || 1
            if (offCanvas.width !== displayWidth * dpr || offCanvas.height !== displayHeight * dpr) {
                offCanvas.width = displayWidth * dpr
                offCanvas.height = displayHeight * dpr
                offCtx.scale(dpr, dpr)
            }
            
            // Clear offscreen canvas
            offCtx.clearRect(0, 0, displayWidth, displayHeight)
            
            const sliceAngle = (2 * Math.PI) / numSegments
            
            // Draw wheel segments WITHOUT rotation (static)
            stableNames.forEach((name, index) => {
                const startAngle = index * sliceAngle - Math.PI / 2
                const endAngle = startAngle + sliceAngle

                // Draw Segment
                offCtx.beginPath()
                offCtx.moveTo(centerX, centerY)
                offCtx.arc(centerX, centerY, radius, startAngle, endAngle)
                offCtx.closePath()

                offCtx.fillStyle = colors[index % colors.length]
                offCtx.fill()

                // Add "Shine" / Gradient Depth
                const gradient = offCtx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius)
                gradient.addColorStop(0, 'rgba(255, 255, 255, 0.1)')
                gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0)')
                gradient.addColorStop(1, 'rgba(0, 0, 0, 0.1)')

                offCtx.fillStyle = gradient
                offCtx.fill()

                offCtx.lineWidth = 1
                offCtx.strokeStyle = 'rgba(0,0,0,0.1)'
                offCtx.stroke()

                // Draw Text (static, no rotation) with clipping
                offCtx.save()
                
                // CRITICAL: Create clipping path for this segment to prevent text overflow
                offCtx.beginPath()
                offCtx.moveTo(centerX, centerY)
                offCtx.arc(centerX, centerY, radius, startAngle, endAngle)
                offCtx.closePath()
                offCtx.clip() // Clip all drawing to this segment
                
                const midAngle = startAngle + sliceAngle / 2
                offCtx.translate(centerX, centerY)
                offCtx.rotate(midAngle)

                offCtx.textAlign = 'right'
                offCtx.textBaseline = 'middle'

                const bgColor = colors[index % colors.length]
                if (bgColor === '#efb71d' || bgColor === '#24a643') {
                    offCtx.fillStyle = '#000000'
                } else {
                    offCtx.fillStyle = '#FFFFFF'
                }

                const entryCount = stableNames.length
                const isMobile = window.innerWidth < 768
                const textRadius = radius - 15
                const arcLength = textRadius * sliceAngle
                
                let computedSize = arcLength / (isMobile ? 6 : 8)
                let entryScaleFactor = 1
                
                if (entryCount > 500) {
                    entryScaleFactor = Math.max(0.2, 200 / entryCount)
                } else if (entryCount > 200) {
                    entryScaleFactor = Math.max(0.25, 150 / entryCount)
                } else if (entryCount > 100) {
                    entryScaleFactor = Math.max(0.35, 80 / entryCount)
                } else if (entryCount > 50) {
                    entryScaleFactor = Math.max(0.5, 40 / entryCount)
                } else if (entryCount > 20) {
                    entryScaleFactor = Math.max(0.7, 20 / entryCount)
                }
                
                computedSize = computedSize * entryScaleFactor
                
                let minSize, maxSize
                if (entryCount > 500) {
                    minSize = isMobile ? 6 : 8
                    maxSize = isMobile ? 10 : 12
                } else if (entryCount > 200) {
                    minSize = isMobile ? 8 : 10
                    maxSize = isMobile ? 14 : 16
                } else if (entryCount > 100) {
                    minSize = isMobile ? 10 : 12
                    maxSize = isMobile ? 18 : 20
                } else if (entryCount > 50) {
                    minSize = isMobile ? 12 : 14
                    maxSize = isMobile ? 24 : 26
                } else if (entryCount > 20) {
                    minSize = isMobile ? 16 : 18
                    maxSize = isMobile ? 30 : 32
                } else {
                    minSize = isMobile ? 18 : 20
                    maxSize = isMobile ? 36 : 38
                }
                
                let fontSize = Math.max(minSize, Math.min(maxSize, computedSize))
                
                // Truncate name
                let displayName = name
                const maxChars = entryCount > 500 ? 3 : entryCount > 200 ? 4 : entryCount > 100 ? 5 : entryCount > 50 ? 6 : 8
                if (displayName.length > maxChars) {
                    displayName = displayName.substring(0, maxChars) + '...'
                }
                
                offCtx.font = `500 ${fontSize}px "Montserrat", sans-serif`
                const textMetrics = offCtx.measureText(displayName)
                const textWidth = textMetrics.width
                const maxTextWidth = arcLength * 0.85
                
                if (textWidth > maxTextWidth && fontSize > minSize) {
                    fontSize = Math.max(minSize, fontSize * (maxTextWidth / textWidth))
                    offCtx.font = `500 ${fontSize}px "Montserrat", sans-serif`
                }

                const textX = textRadius - 10
                
                offCtx.shadowColor = 'rgba(0,0,0,0.3)'
                offCtx.shadowBlur = 1.5
                offCtx.shadowOffsetX = 0.5
                offCtx.shadowOffsetY = 0.5

                offCtx.fillText(displayName, textX, 0)
                offCtx.restore()
            })
            
            // Draw Center Hub (static)
            offCtx.save()
            const isMobileHub = window.innerWidth < 768
            const hubRadius = isMobileHub ? 25 : 50
            offCtx.beginPath()
            offCtx.arc(centerX, centerY, hubRadius, 0, 2 * Math.PI)
            offCtx.fillStyle = 'white'
            offCtx.shadowColor = 'rgba(0,0,0,0.2)'
            offCtx.shadowBlur = 5
            offCtx.fill()
            offCtx.restore()
            
            cachedWheelRef.current = true
        }

        // Helper to draw the wheel (extracted for reuse)
        function drawWheel(centerX, centerY, radius, displayWidth, displayHeight) {
            if (isDrawingRef.current) return
            isDrawingRef.current = true
            
            // CRITICAL FIX: Use requestAnimationFrame for non-blocking draw
            requestAnimationFrame(() => {
                try {
                    // Clear canvas
                    ctx.clearRect(0, 0, displayWidth, displayHeight)

                    // CRITICAL FIX: Use stableNames instead of names prop
                    const numSegments = stableNames.length
                    if (numSegments === 0) {
                        isDrawingRef.current = false
                        return
                    }
                    
                    // PERFORMANCE: For large datasets (>500), use cached offscreen canvas
                    // Only redraw static wheel if names changed
                    const needsCacheRebuild = !cachedWheelRef.current || 
                        previousNamesRef.current.length !== stableNames.length ||
                        previousNamesRef.current.some((name, idx) => name !== stableNames[idx])
                    
                    if (needsCacheRebuild) {
                        drawStaticWheel(centerX, centerY, radius, displayWidth, displayHeight)
                        previousNamesRef.current = [...stableNames]
                    }
                    
                    // PERFORMANCE: Use cached wheel for large datasets (>500 entries)
                    // This dramatically improves performance by avoiding redrawing 3000+ segments on every frame
                    if (numSegments > 500 && offscreenCanvasRef.current && cachedWheelRef.current) {
                        // Draw cached wheel with rotation (always draw for smooth animation)
                        ctx.save()
                        ctx.translate(centerX, centerY)
                        ctx.rotate((rotation * Math.PI) / 180)
                        ctx.drawImage(offscreenCanvasRef.current, -centerX, -centerY)
                        ctx.restore()
                        
                        // Draw shadow (only redraw shadow occasionally for performance)
                        const rotationDelta = Math.abs(rotation - previousRotationRef.current)
                        if (rotationDelta >= 5 || previousRotationRef.current === 0) {
                            ctx.save()
                            ctx.shadowColor = 'rgba(0, 0, 0, 0.3)'
                            ctx.shadowBlur = 15
                            ctx.shadowOffsetY = 10
                            ctx.beginPath()
                            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI)
                            ctx.fillStyle = 'rgba(0,0,0,0)'
                            ctx.fill()
                            ctx.restore()
                        }
                        
                        isDrawingRef.current = false
                        previousRotationRef.current = rotation
                        return
                    }
                    
                    // For smaller datasets, use original rendering
                    const sliceAngle = (2 * Math.PI) / numSegments

                    // Save context for wheel rotation
                    ctx.save()
                    ctx.translate(centerX, centerY)
                    ctx.rotate((rotation * Math.PI) / 180)

                    // Draw Shadow (behind the wheel)
                    ctx.save()
                    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)'
                    ctx.shadowBlur = 15
                    ctx.shadowOffsetY = 10
                    ctx.beginPath()
                    ctx.arc(0, 0, radius, 0, 2 * Math.PI)
                    ctx.fillStyle = 'rgba(0,0,0,0)'
                    ctx.fill()
                    ctx.restore()

                    // CRITICAL FIX: Use stableNames for rendering
                    stableNames.forEach((name, index) => {
                        // 0 degrees in standard canvas is 3 o'clock. 
                        // We want index 0 to start at -90 degrees (12 o'clock)
                        const startAngle = index * sliceAngle - Math.PI / 2
                        const endAngle = startAngle + sliceAngle

                        // Draw Segment
                        ctx.beginPath()
                        ctx.moveTo(0, 0)
                        ctx.arc(0, 0, radius, startAngle, endAngle)
                        ctx.closePath()

                        ctx.fillStyle = colors[index % colors.length]
                        ctx.fill()

                        // Add "Shine" / Gradient Depth
                        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius)
                        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.1)')
                        gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0)')
                        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.1)')

                        ctx.fillStyle = gradient
                        ctx.fill()

                        ctx.lineWidth = 1
                        ctx.strokeStyle = 'rgba(0,0,0,0.1)'
                        ctx.stroke()

                        // Draw Text with clipping to prevent overflow
                        ctx.save()
                        
                        // CRITICAL: Create clipping path for this segment to prevent text overflow
                        ctx.beginPath()
                        ctx.moveTo(0, 0)
                        ctx.arc(0, 0, radius, startAngle, endAngle)
                        ctx.closePath()
                        ctx.clip() // Clip all drawing to this segment
                        
                        const midAngle = startAngle + sliceAngle / 2
                        ctx.rotate(midAngle)

                        ctx.textAlign = 'right'
                        ctx.textBaseline = 'middle'

                        const bgColor = colors[index % colors.length]
                        if (bgColor === '#efb71d' || bgColor === '#24a643') {
                            ctx.fillStyle = '#000000'
                        } else {
                            ctx.fillStyle = '#FFFFFF'
                        }

                        // Dynamic font sizing - scales down aggressively with more entries
                        // Ensure text fits within each segment box
                        const entryCount = stableNames.length
                        const isMobile = window.innerWidth < 768
                        
                        // Calculate text radius - place text on OUTER EDGE of wheel
                        // Use radius minus small padding to place text at the very outer edge
                        const textRadius = radius - 15 // Place text at outer edge (15px from edge)
                        const arcLength = textRadius * sliceAngle
                        
                        // Base calculation from arc length - more aggressive division
                        let computedSize = arcLength / (isMobile ? 6 : 8) // Increased divisor for smaller text
                        
                        // Additional scaling based on number of entries
                        // More entries = much smaller font
                        let entryScaleFactor = 1
                        
                        if (entryCount > 500) {
                            // Very aggressive scaling for many entries
                            entryScaleFactor = Math.max(0.2, 200 / entryCount)
                        } else if (entryCount > 200) {
                            // Aggressive scaling for many entries
                            entryScaleFactor = Math.max(0.25, 150 / entryCount)
                        } else if (entryCount > 100) {
                            // Moderate scaling for medium entries
                            entryScaleFactor = Math.max(0.35, 80 / entryCount)
                        } else if (entryCount > 50) {
                            // Light scaling for moderate entries
                            entryScaleFactor = Math.max(0.5, 40 / entryCount)
                        } else if (entryCount > 20) {
                            // Light scaling for moderate entries
                            entryScaleFactor = Math.max(0.7, 20 / entryCount)
                        }
                        
                        computedSize = computedSize * entryScaleFactor
                        
                        // Dynamic min/max sizes - much smaller for many entries
                        let minSize, maxSize
                        if (entryCount > 500) {
                            minSize = isMobile ? 6 : 8
                            maxSize = isMobile ? 10 : 12
                        } else if (entryCount > 200) {
                            minSize = isMobile ? 8 : 10
                            maxSize = isMobile ? 14 : 16
                        } else if (entryCount > 100) {
                            minSize = isMobile ? 10 : 12
                            maxSize = isMobile ? 18 : 20
                        } else if (entryCount > 50) {
                            minSize = isMobile ? 12 : 14
                            maxSize = isMobile ? 24 : 26
                        } else if (entryCount > 20) {
                            minSize = isMobile ? 16 : 18
                            maxSize = isMobile ? 30 : 32
                        } else {
                            minSize = isMobile ? 18 : 20
                            maxSize = isMobile ? 36 : 38
                        }
                        
                        let fontSize = Math.max(minSize, Math.min(maxSize, computedSize))
                        
                        // Truncate name to be very short - calculate max characters based on arc length
                        // For large datasets, show only first few characters
                        let displayName = name
                        const maxChars = entryCount > 500 ? 3 : entryCount > 200 ? 4 : entryCount > 100 ? 5 : entryCount > 50 ? 6 : 8
                        if (displayName.length > maxChars) {
                            displayName = displayName.substring(0, maxChars) + '...'
                        }
                        
                        // Ensure text fits within segment - measure text width
                        ctx.font = `500 ${fontSize}px "Montserrat", sans-serif`
                        const textMetrics = ctx.measureText(displayName)
                        const textWidth = textMetrics.width
                        const maxTextWidth = arcLength * 0.85 // 85% of arc length to ensure it fits
                        
                        // If text is too wide, reduce font size further
                        if (textWidth > maxTextWidth && fontSize > minSize) {
                            fontSize = Math.max(minSize, fontSize * (maxTextWidth / textWidth))
                            ctx.font = `500 ${fontSize}px "Montserrat", sans-serif`
                        }

                        // Text positioning - place text on OUTER EDGE of wheel
                        // Position text at calculated textRadius (at outer edge)
                        const textX = textRadius - 10 // Position at outer edge with small padding
                        
                        ctx.shadowColor = 'rgba(0,0,0,0.3)'
                        ctx.shadowBlur = 1.5
                        ctx.shadowOffsetX = 0.5
                        ctx.shadowOffsetY = 0.5

                        // Draw text - use truncated name, ensure it fits within the segment box
                        ctx.fillText(displayName, textX, 0)
                        ctx.restore()
                    })

                    ctx.restore()

                    // Draw Center Hub
                    ctx.save()
                    ctx.translate(centerX, centerY)

                    // Draw Center Circle (Hub) - Smaller on Mobile
                    const isMobileHub = window.innerWidth < 768
                    const hubRadius = isMobileHub ? 25 : 50

                    ctx.beginPath()
                    ctx.arc(0, 0, hubRadius, 0, 2 * Math.PI)
                    ctx.fillStyle = 'white'
                    ctx.shadowColor = 'rgba(0,0,0,0.2)'
                    ctx.shadowBlur = 5
                    ctx.fill()
                    ctx.restore()
                    
                    // Update rotation ref
                    previousRotationRef.current = rotation
                } catch (error) {
                    console.error('Canvas draw error:', error)
                } finally {
                    isDrawingRef.current = false
                }
            })
        }

        return () => {
            resizeObserver.disconnect()
            if (resizeTimeout) {
                clearTimeout(resizeTimeout)
            }
        }
    }, [stableNames, colors, rotation, width, height]) // CRITICAL FIX: Use stableNames instead of names

    return (
        <canvas
            ref={canvasRef}
            style={{
                width: '100%',
                height: '100%',
                touchAction: 'none'
            }}
        />
    )
}

export default CanvasWheel
