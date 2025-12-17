import * as XLSX from 'xlsx'

export interface Participant {
  firstName: string
  lastName: string
  ticketNumber: string // UNIQUE identifier
}

export interface ParsedData {
  participants: Participant[]
  totalRows: number
  errors: string[]
}

/**
 * Parse Excel file and extract participant data
 * Expected columns: Order ID, First Name, Last Name, Email, Phone, Ticket Number, Date
 */
export async function parseExcelFile(file: File): Promise<ParsedData> {
  const errors: string[] = []
  const participants: Participant[] = []

  try {
    // Read file as array buffer
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })

    // Get first sheet
    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]

    // Convert to JSON
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

    if (rawData.length < 2) {
      errors.push('Excel file must contain at least a header row and one data row')
      return { participants, totalRows: 0, errors }
    }

    // Find header row (first row with data)
    const headerRow = rawData[0] as string[]
    
    // Normalize header names (case-insensitive, trim whitespace)
    const normalizedHeaders = headerRow.map(h => 
      String(h || '').toLowerCase().trim()
    )

    // Find column indices - only First Name, Last Name, and Ticket Number
    const firstNameIndex = findColumnIndex(normalizedHeaders, ['first name', 'firstname', 'first_name', 'fname'])
    const lastNameIndex = findColumnIndex(normalizedHeaders, ['last name', 'lastname', 'last_name', 'lname'])
    const ticketNumberIndex = findColumnIndex(normalizedHeaders, ['ticket number', 'ticketnumber', 'ticket_number', 'ticket'])

    // Validate required columns
    const missingColumns: string[] = []
    if (firstNameIndex === -1) missingColumns.push('First Name')
    if (lastNameIndex === -1) missingColumns.push('Last Name')
    if (ticketNumberIndex === -1) missingColumns.push('Ticket Number')

    if (missingColumns.length > 0) {
      errors.push(`Missing required columns: ${missingColumns.join(', ')}`)
      return { participants, totalRows: 0, errors }
    }

    // Process data rows
    const ticketNumbers = new Set<string>() // Track unique ticket numbers
    let rowNumber = 1 // Start from 1 (header is row 0)

    for (let i = 1; i < rawData.length; i++) {
      rowNumber++
      const row = rawData[i]

      // Skip empty rows
      if (!row || row.every(cell => !cell || String(cell).trim() === '')) {
        continue
      }

      // Extract values - only First Name, Last Name, and Ticket Number
      const firstName = String(row[firstNameIndex] || '').trim()
      const lastName = String(row[lastNameIndex] || '').trim()
      const ticketNumber = String(row[ticketNumberIndex] || '').trim()

      // Validate required fields
      if (!firstName || !lastName || !ticketNumber) {
        errors.push(`Row ${rowNumber}: Missing required fields (First Name, Last Name, or Ticket Number)`)
        continue
      }

      // Check for duplicate ticket numbers
      if (ticketNumbers.has(ticketNumber)) {
        errors.push(`Row ${rowNumber}: Duplicate ticket number: ${ticketNumber}`)
        continue
      }

      ticketNumbers.add(ticketNumber)

      // Create participant object - only First Name, Last Name, and Ticket Number
      const participant: Participant = {
        firstName,
        lastName,
        ticketNumber,
      }

      participants.push(participant)
    }

    // Validate row limit
    if (participants.length > 3000) {
      errors.push(`File contains ${participants.length} rows. Maximum allowed is 3000.`)
    }

    return {
      participants,
      totalRows: participants.length,
      errors: errors.length > 0 ? errors : [],
    }
  } catch (error) {
    errors.push(`Error parsing Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    return { participants, totalRows: 0, errors }
  }
}

/**
 * Helper function to find column index by multiple possible header names
 */
function findColumnIndex(headers: string[], possibleNames: string[]): number {
  for (const name of possibleNames) {
    const index = headers.indexOf(name.toLowerCase())
    if (index !== -1) return index
  }
  return -1
}

/**
 * Combine multiple participant arrays and enforce 3000 limit
 * Uses random trimming if total exceeds 3000
 */
export function combineParticipants(
  participantArrays: Participant[][]
): Participant[] {
  const combined: Participant[] = []
  const ticketNumbers = new Set<string>()

  // First pass: collect all unique participants
  for (const participants of participantArrays) {
    for (const participant of participants) {
      // Skip duplicates based on ticket number
      if (ticketNumbers.has(participant.ticketNumber)) {
        continue
      }

      ticketNumbers.add(participant.ticketNumber)
      combined.push(participant)
    }
  }

  // If exceeds 3000, randomly trim
  if (combined.length > 3000) {
    // Shuffle array using Fisher-Yates
    for (let i = combined.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [combined[i], combined[j]] = [combined[j], combined[i]]
    }
    
    // Return first 3000
    return combined.slice(0, 3000)
  }

  return combined
}

