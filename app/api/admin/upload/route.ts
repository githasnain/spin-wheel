import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { parseExcelFile, combineParticipants, Participant } from '@/lib/excel-parser'
import { replaceWheelList } from '@/lib/wheel-storage'

// Mark route as dynamic (uses cookies and file upload)
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      )
    }

    // Parse all Excel files
    const allParticipants: Participant[] = []
    const errors: string[] = []

    for (const file of files) {
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        errors.push(`${file.name}: Not an Excel file`)
        continue
      }

      const parsed = await parseExcelFile(file)

      if (parsed.errors.length > 0) {
        errors.push(...parsed.errors.map((e) => `${file.name}: ${e}`))
      }

      // Enforce per-file 3000 row limit
      if (parsed.participants.length > 3000) {
        errors.push(`${file.name}: Contains ${parsed.participants.length} rows. Maximum 3000 rows per file.`)
        continue // Skip this file
      }

      allParticipants.push(...parsed.participants)
    }

    // Combine and limit to 3000 entries (with random trimming if needed)
    const combined = combineParticipants([allParticipants])

    // ATOMIC REPLACEMENT - Replace entire list immediately
    // No publish needed - wheel will see this on next load
    replaceWheelList(combined)

    return NextResponse.json({
      success: true,
      totalEntries: combined.length,
      errors: errors.length > 0 ? errors : undefined,
      message: 'Files uploaded successfully. List is now available on the wheel.',
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

