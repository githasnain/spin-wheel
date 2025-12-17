'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { SpinConfiguration } from '@/lib/storage'
import './admin-styles.css'

export default function AdminPanel() {
  const router = useRouter()
  const [entries, setEntries] = useState<any[]>([])
  const [spinMode, setSpinMode] = useState<'natural' | 'fixed'>('natural') // Simplified: just track mode
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [fixedTicketsQueue, setFixedTicketsQueue] = useState<string[]>([]) // NEW: Queue of up to 3 tickets
  const [searchTerm, setSearchTerm] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadData()
  }, [])

  // No validation errors needed - upload is immediate

  const loadData = async () => {
    try {
      const response = await fetch('/api/admin/list')
      if (response.status === 401) {
        router.push('/admin/login')
        return
      }
      const data = await response.json()
      setEntries(data.entries || [])
      setFixedTicketsQueue(data.fixedTicketsQueue || []) // NEW: Queue
      setLoading(false)
    } catch (error) {
      console.error('Failed to load data:', error)
      setLoading(false)
    }
  }

  // No validation needed - upload is immediate and entries are available right away

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setSelectedFiles(files)
    setUploadError(null)
    setUploadSuccess(false)
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setUploadError('Please select at least one file')
      return
    }

    setUploading(true)
    setUploadError(null)
    setUploadSuccess(false)

    try {
      const formData = new FormData()
      selectedFiles.forEach(file => {
        formData.append('files', file)
      })

      const response = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        setUploadError(data.error || 'Upload failed')
        setUploading(false)
        return
      }

      setUploadSuccess(true)
      setSelectedFiles([])
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      // Reload data (draft state updated)
      await loadData()

      // Show success message for 3 seconds
      setTimeout(() => setUploadSuccess(false), 3000)
    } catch (error) {
      setUploadError('Network error. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push('/admin/login')
  }

  const displayNames = entries.map(e => e.label || `${e.firstName || ''} ${e.lastName || ''}`.trim())

  // Update spin mode
  const handleSpinModeChange = (mode: 'natural' | 'fixed') => {
    setSpinMode(mode)
    if (mode === 'natural') {
      // Clear queue when switching to natural mode
      setFixedTicketsQueue([])
      handleFixedTicketsQueueChange([])
    }
  }

  // Update fixed tickets queue (up to 3 tickets in order)
  const handleFixedTicketsQueueChange = async (tickets: string[]) => {
    // Validate: max 3 tickets
    if (tickets.length > 3) {
      alert('Maximum 3 fixed tickets allowed')
      return
    }

    // Validate: no duplicates
    const uniqueTickets = new Set(tickets)
    if (uniqueTickets.size !== tickets.length) {
      alert('Duplicate tickets not allowed')
      return
    }

    // Validate: all tickets exist in current entries
    for (const ticket of tickets) {
      const exists = entries.some(e => e.ticketNumber === ticket)
      if (!exists) {
        alert(`Ticket "${ticket}" not found in current list`)
        return
      }
    }

    // Update state optimistically
    setFixedTicketsQueue(tickets)
    
    // Update immediately via API
    try {
      const response = await fetch('/api/admin/fixed-ticket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tickets }),
      })

      if (!response.ok) {
        const data = await response.json()
        console.error('Failed to set fixed tickets queue:', data.error)
        alert(`Failed to set fixed tickets: ${data.error}`)
        // Revert on error - reload from server
        loadData()
      } else {
        console.log('Fixed tickets queue updated successfully:', tickets)
      }
    } catch (error) {
      console.error('Error setting fixed tickets queue:', error)
      alert('Network error. Please try again.')
      // Revert on error - reload from server
      loadData()
    }
  }

  // Add ticket to queue
  const addTicketToQueue = (ticketNumber: string) => {
    try {
      if (fixedTicketsQueue.length >= 3) {
        alert('Maximum 3 fixed tickets allowed')
        return
      }
      if (fixedTicketsQueue.includes(ticketNumber)) {
        alert('Ticket already in queue')
        return
      }
      // Validate ticket exists
      const entry = entries.find(e => e.ticketNumber === ticketNumber)
      if (!entry) {
        alert(`Ticket "${ticketNumber}" not found in current list`)
        return
      }
      handleFixedTicketsQueueChange([...fixedTicketsQueue, ticketNumber])
    } catch (error) {
      console.error('Error adding ticket to queue:', error)
      alert('Failed to add ticket to queue. Please try again.')
    }
  }

  // Remove ticket from queue
  const removeTicketFromQueue = (index: number) => {
    const newQueue = fixedTicketsQueue.filter((_, i) => i !== index)
    handleFixedTicketsQueueChange(newQueue)
  }

  // Clear queue
  const clearQueue = () => {
    handleFixedTicketsQueueChange([])
  }

  // Validate fixed winner index before use
  const validateFixedWinnerIndex = (index: number | null): boolean => {
    if (index === null) return true
    if (index < 0 || index >= entries.length) {
      setUploadError(`Invalid winner index. Must be between 0 and ${entries.length - 1}`)
      return false
    }
    return true
  }

  const filteredEntries = entries.filter(entry => {
    if (!searchTerm) return true
    if (!entry) return false
    const search = searchTerm.toLowerCase()
    const firstName = (entry.firstName || '').toLowerCase()
    const lastName = (entry.lastName || '').toLowerCase()
    const label = (entry.label || `${firstName} ${lastName}`).toLowerCase()
    const ticketNumber = (entry.ticketNumber || '').toLowerCase()
    return (
      firstName.includes(search) ||
      lastName.includes(search) ||
      label.includes(search) ||
      ticketNumber.includes(search)
    )
  })

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: 'linear-gradient(135deg, #2b0505 0%, #233159 60%, #05051a 100%)',
        color: 'white'
      }}>
        <div>Loading admin panel...</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'linear-gradient(135deg, #2b0505 0%, #233159 60%, #05051a 100%)' }}>
      {/* Left Sidebar - Admin Controls */}
      <div style={{
        width: '400px',
        background: 'rgba(26, 26, 26, 0.95)',
        borderRight: '1px solid #3a3a3a',
        padding: '20px',
        overflowY: 'auto',
        color: 'white'
      }}>
        <div style={{ marginBottom: '30px' }}>
          <h1 style={{ fontSize: '24px', marginBottom: '10px' }}>Admin Panel</h1>
          <button
            onClick={handleLogout}
            style={{
              background: '#ef4444',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Logout
          </button>
        </div>

        {/* File Upload */}
        <div style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '18px', marginBottom: '15px' }}>Upload Excel Files</h2>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".xlsx,.xls"
            onChange={handleFileSelect}
            style={{ marginBottom: '10px', color: 'white' }}
          />
          {selectedFiles.length > 0 && (
            <div style={{ marginBottom: '10px', fontSize: '14px', color: '#888' }}>
              {selectedFiles.length} file(s) selected
            </div>
          )}
          <button
            onClick={handleUpload}
            disabled={uploading || selectedFiles.length === 0}
            style={{
              background: '#2563eb',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '6px',
              cursor: uploading ? 'not-allowed' : 'pointer',
              opacity: uploading ? 0.5 : 1,
              width: '100%',
              marginBottom: '10px'
            }}
          >
            {uploading ? 'Uploading...' : 'Upload Files'}
          </button>
          {uploadError && (
            <div style={{ marginTop: '10px', color: '#ef4444', fontSize: '14px' }}>
              {uploadError}
            </div>
          )}
          {uploadSuccess && (
            <div style={{ marginTop: '10px', color: '#24a643', fontSize: '14px' }}>
              Upload successful! {entries.length} entries loaded.
              <br />
              <strong>Entries are immediately available on the wheel!</strong>
            </div>
          )}
        </div>

        {/* Status Section */}
        <div style={{ 
          marginBottom: '30px', 
          padding: '20px', 
          background: 'linear-gradient(135deg, #1a1a1a 0%, #2a1a1a 100%)', 
          borderRadius: '8px', 
          border: '1px solid #3a3a3a',
          transition: 'all 0.3s ease'
        }}>
          <h2 style={{ fontSize: '20px', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>🎡</span>
            Wheel Status
          </h2>
          
          {/* Entry Count Status */}
          <div style={{ 
            marginBottom: '15px', 
            padding: '15px', 
            background: entries.length > 0 ? 'rgba(36, 166, 67, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
            borderRadius: '6px',
            border: `1px solid ${entries.length > 0 ? 'rgba(36, 166, 67, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            fontSize: '14px',
            color: entries.length > 0 ? '#4ade80' : '#ef4444'
          }}>
            <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '5px' }}>
              <strong>{entries.length}</strong> entries loaded
            </div>
            {entries.length > 3000 && (
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#ff6b6b' }}>
                ⚠️ Exceeds maximum of 3000 entries
              </div>
            )}
            {entries.length > 0 && entries.length <= 3000 && (
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#888' }}>
                ✓ Entries are immediately available on the wheel
              </div>
            )}
          </div>
          
          {/* Go to Wheel Button */}
          {entries.length > 0 && (
            <button
              onClick={() => router.push('/wheel')}
              style={{
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: 'white',
                border: 'none',
                padding: '14px 24px',
                borderRadius: '8px',
                cursor: 'pointer',
                width: '100%',
                fontSize: '16px',
                fontWeight: 'bold',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(37, 99, 235, 0.4)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.3)'
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <span>🎡</span>
                Go to Wheel
              </span>
            </button>
          )}
        </div>

        {/* Spin Controls */}
        <div style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '18px', marginBottom: '15px' }}>Spin Controls</h2>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '8px' }}>
              <input
                type="radio"
                checked={spinMode === 'natural'}
                onChange={() => handleSpinModeChange('natural')}
                style={{ marginRight: '8px' }}
              />
              Natural Spin
            </label>
            <label style={{ display: 'block' }}>
              <input
                type="radio"
                checked={spinMode === 'fixed'}
                onChange={() => handleSpinModeChange('fixed')}
                style={{ marginRight: '8px' }}
              />
              Fixed Winner
            </label>
          </div>
          {spinMode === 'fixed' && (
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Fixed Spin Queue (Up to 3 tickets):
              </label>
              
              {/* Queue Display */}
              <div style={{ marginBottom: '15px', padding: '12px', background: '#1a1a1a', borderRadius: '6px', border: '1px solid #3a3a3a' }}>
                {fixedTicketsQueue.length === 0 ? (
                  <div style={{ color: '#888', fontSize: '14px', textAlign: 'center', padding: '10px' }}>
                    No fixed tickets set. Click entries below to add to queue.
                  </div>
                ) : (
                  <div>
                    <div style={{ marginBottom: '10px', fontSize: '12px', color: '#aaa' }}>
                      Queue ({fixedTicketsQueue.length}/3):
                    </div>
                    {fixedTicketsQueue.map((ticket, index) => {
                      const entry = entries.find(e => e.ticketNumber === ticket)
                      return (
                        <div key={index} style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          padding: '8px',
                          marginBottom: '5px',
                          background: '#2a2a2a',
                          borderRadius: '4px',
                          border: '1px solid #3a3a3a'
                        }}>
                          <div style={{ 
                            flex: 1, 
                            minWidth: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            <span style={{ fontWeight: 'bold', color: '#4ade80' }}>#{index + 1}</span>
                            <span 
                              style={{ marginLeft: '10px', color: 'white' }}
                              title={(() => {
                                const entry = entries.find(e => e.ticketNumber === ticket)
                                return entry ? `${entry.firstName || ''} ${entry.lastName || ''}`.trim() : ticket
                              })() + ` (${ticket})`}
                            >
                              {(() => {
                                const entry = entries.find(e => e.ticketNumber === ticket)
                                return entry ? `${entry.firstName || ''} ${entry.lastName || ''}`.trim() : ticket
                              })()} ({ticket})
                            </span>
                          </div>
                          <button
                            onClick={() => removeTicketFromQueue(index)}
                            style={{
                              padding: '4px 8px',
                              background: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      )
                    })}
                    <button
                      onClick={clearQueue}
                      style={{
                        width: '100%',
                        marginTop: '10px',
                        padding: '8px',
                        background: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      Clear Queue
                    </button>
                  </div>
                )}
              </div>

              {/* Instructions */}
              <div style={{ marginBottom: '15px', padding: '10px', background: '#1a3a1a', borderRadius: '6px', border: '1px solid #2a5a2a' }}>
                <div style={{ fontSize: '12px', color: '#4ade80', marginBottom: '5px' }}>
                  <strong>How it works:</strong>
                </div>
                <div style={{ fontSize: '11px', color: '#aaa', lineHeight: '1.5' }}>
                  • Click entries below to add them to the queue (up to 3)<br/>
                  • 1st spin stops on ticket #1<br/>
                  • 2nd spin stops on ticket #2<br/>
                  • 3rd spin stops on ticket #3<br/>
                  • After queue is empty → natural spins
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Data Preview */}
        <div>
          <h2 style={{ fontSize: '18px', marginBottom: '15px' }}>
            Data Preview ({entries.length} entries)
          </h2>
          <input
            type="text"
            placeholder="Search by name, ticket, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              marginBottom: '15px',
              background: '#2a2a2a',
              border: '1px solid #3a3a3a',
              borderRadius: '6px',
              color: 'white',
              boxSizing: 'border-box',
              position: 'relative',
              transform: 'none',
              caretColor: 'white',
              fontSize: '14px',
              lineHeight: '1.5',
              fontFamily: 'inherit'
            }}
          />
          <div style={{
            maxHeight: '400px',
            overflowY: 'auto',
            background: '#1a1a1a',
            borderRadius: '6px',
            padding: '10px'
          }}>
            {filteredEntries.length === 0 ? (
              <div style={{ color: '#888', textAlign: 'center', padding: '20px' }}>
                No entries found
              </div>
            ) : (
              filteredEntries.map((entry, index) => (
                <div
                  key={entry.ticketNumber}
                  style={{
                    padding: '10px',
                    marginBottom: '8px',
                    background: '#2a2a2a',
                    borderRadius: '4px',
                    fontSize: '14px',
                    cursor: spinMode === 'fixed' ? 'pointer' : 'default',
                    border: fixedTicketsQueue.includes(entry.ticketNumber) ? '2px solid #2563eb' : '1px solid transparent'
                  }}
                  onClick={() => {
                    if (spinMode === 'fixed') {
                      // When clicking an entry, add to queue (up to 3)
                      addTicketToQueue(entry.ticketNumber)
                    }
                  }}
                >
                  <div style={{ 
                    fontWeight: 'bold', 
                    marginBottom: '4px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '100%'
                  }} title={`${entry.firstName || ''} ${entry.lastName || ''}`.trim()}>
                    {entry.firstName || ''} {entry.lastName || ''}
                  </div>
                  <div style={{ 
                    fontSize: '12px', 
                    color: '#888',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '100%'
                  }} title={`Ticket: ${entry.ticketNumber}${entry.email ? ` | Email: ${entry.email}` : ''}`}>
                    Ticket: {entry.ticketNumber}
                    {entry.email && ` | ${entry.email}`}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Right Side - Info and Navigation */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '40px', color: 'white' }}>
        <div style={{ textAlign: 'center', maxWidth: '500px' }}>
          <h2 style={{ fontSize: '28px', marginBottom: '20px' }}>Admin Panel</h2>
          
          {entries.length > 0 ? (
            <>
              <div style={{ fontSize: '18px', marginBottom: '30px', color: '#888' }}>
                <div style={{ marginBottom: '10px' }}>
                  <strong style={{ color: 'white' }}>{entries.length}</strong> entries loaded
                </div>
                <div style={{ fontSize: '14px', color: '#4ade80', marginTop: '10px' }}>
                  ✓ Entries are immediately available on the wheel
                </div>
              </div>
            </>
          ) : (
            <div style={{ fontSize: '18px', color: '#888' }}>
              <div style={{ marginBottom: '20px' }}>No entries loaded</div>
              <div style={{ fontSize: '14px' }}>Upload Excel files to get started</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

