import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const SESSION_COOKIE_NAME = 'admin_session'
const SESSION_DURATION = 24 * 60 * 60 * 1000 // 24 hours

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (!secret) {
    console.error('SESSION_SECRET environment variable is not set')
    // Fallback for development only - MUST be set in production
    return 'dev-fallback-secret-change-in-production'
  }
  return secret
}

export interface SessionData {
  username: string
  expiresAt: number
}

/**
 * Verify admin credentials
 * Uses environment variables for authentication
 */
export async function verifyAdminCredentials(
  username: string,
  password: string
): Promise<boolean> {
  const adminUsername = process.env.ADMIN_USERNAME || 'admin'
  const adminPassword = process.env.ADMIN_PASSWORD

  if (!adminPassword) {
    console.error('ADMIN_PASSWORD environment variable is not set')
    return false
  }

  // Compare username
  if (username !== adminUsername) {
    return false
  }

  // Compare password (support both plain text and bcrypt hashed)
  try {
    // Try bcrypt comparison first
    const isMatch = await bcrypt.compare(password, adminPassword)
    if (isMatch) return true

    // Fallback to plain text comparison (for initial setup)
    if (password === adminPassword) return true
  } catch (error) {
    // If bcrypt fails, try plain text
    if (password === adminPassword) return true
  }

  return false
}

/**
 * Create a session for authenticated admin
 * Uses HMAC signing to prevent tampering
 */
export async function createSession(username: string): Promise<string> {
  const sessionData: SessionData = {
    username,
    expiresAt: Date.now() + SESSION_DURATION,
  }

  // Create payload
  const payload = Buffer.from(JSON.stringify(sessionData)).toString('base64')
  
  // Sign payload with HMAC-SHA256
  const secret = getSessionSecret()
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64')
  
  // Return payload.signature format
  return `${payload}.${signature}`
}

/**
 * Verify session and return session data
 * Validates HMAC signature to prevent tampering
 */
export async function verifySession(): Promise<SessionData | null> {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (!sessionToken) {
    return null
  }

  try {
    // Split payload and signature
    const [payload, signature] = sessionToken.split('.')
    
    if (!payload || !signature) {
      return null // Invalid format
    }

    // Verify signature
    const secret = getSessionSecret()
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('base64')
    
    if (signature !== expectedSignature) {
      return null // Tampered token
    }

    // Decode payload
    const sessionData: SessionData = JSON.parse(
      Buffer.from(payload, 'base64').toString()
    )

    // Check if session expired
    if (Date.now() > sessionData.expiresAt) {
      return null
    }

    return sessionData
  } catch (error) {
    return null
  }
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await verifySession()
  return session !== null
}

/**
 * Clear session (logout)
 */
export async function clearSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
}

