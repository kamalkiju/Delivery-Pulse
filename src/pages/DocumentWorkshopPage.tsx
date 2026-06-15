import { useState, useEffect } from 'react'
import api from '../api/axios'
import AppShell from '../components/layout/AppShell'

const DOC_TYPES = [
  { value: 'meeting-notes', label: '📞 Meeting Notes' },
  { value: 'understanding-document', label: '📋 Understanding Document' },
  { value: 'problem-statement', label: '❗ Problem Statement' },
  { value: 'prd', label: '📘 PRD' },
  { value: 'use-case-catalogue', label: '📚 Use Case Catalogue' },
  { value: 'sprint-plan', label: '📅 Sprint Plan' },
  { value: 'rtm', label: '🔗 RTM' },
  { value: 'release-notes', label: '📝 Release Notes' },
  { value: 'user-guide', label: '📖 User Guide' }
]

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft: { bg: '#f1f5f9', text: '#64748b' },
  'in-review': { bg: '#fffbeb', text: '#d97706' },
  approved: { bg: '#f0fdf4', text: '#16a34a' },
  final: { bg: '#eff6ff', text: '#2563eb' }
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid #e2e8f0',
  borderRadius: 8,
  fontSize: 14,
  color: '#374151',
  boxSizing: 'border-box',
  outline: 'none',
  backgroundColor: 'white'
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#374151',
  display: 'block',
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: '0.05em'
}

export default function DocumentWorkshopPage() {
  const [documents, setDocuments] = useState<any[]>([])
  const [selectedDoc, setSelectedDoc] = useState<any>(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [additionalContext, setAdditionalContext] = useState('')
  const [editableContent, setEditableContent] = useState('')
  const [comment, setComment] = useState('')
  const [activeTab, setActiveTab] = useState('editor')

  const [newForm, setNewForm] = useState({
    title: '',
    documentType: 'meeting-notes',
    clientName: '',
    meetingDate: new Date().toISOString().split('T')[0],
    initialContext: ''
  })

  const fetchDocuments = async () => {
    try {
      const res = await api.get('/document-workshop')
      setDocuments(res.data.documents || [])
    } catch (error) {
      console.error('Failed to fetch documents:', error)
    }
  }

  useEffect(() => {
    fetchDocuments()
  }, [])

  useEffect(() => {
    if (selectedDoc) {
      setEditableContent(selectedDoc.currentContent || '')
    }
  }, [selectedDoc?._id])

  const handleCreate = async () => {
    if (!newForm.title.trim() || !newForm.initialContext.trim()) {
      alert('Please fill in Title and Meeting Notes/Context')
      return
    }
    setIsCreating(true)
    try {
      const res = await api.post('/document-workshop', newForm)
      const doc = res.data.document
      setDocuments(prev => [doc, ...prev])
      setSelectedDoc(doc)
      setShowNewForm(false)
      setNewForm({
        title: '',
        documentType: 'meeting-notes',
        clientName: '',
        meetingDate: new Date().toISOString().split('T')[0],
        initialContext: ''
      })
      await handleGenerate(doc._id, '')
    } catch (error: any) {
      alert('Failed to create: ' + error.message)
    } finally {
      setIsCreating(false)
    }
  }

  const handleGenerate = async (docId?: string, addContext?: string) => {
    const id = docId || selectedDoc?._id
    if (!id) return
    setIsGenerating(true)
    try {
      const res = await api.post(`/document-workshop/${id}/generate`, {
        additionalContext: addContext !== undefined
          ? addContext
          : additionalContext
      })
      const updated = res.data.document
      setSelectedDoc(updated)
      setEditableContent(updated.currentContent || '')
      setAdditionalContext('')
      setDocuments(prev =>
        prev.map((d: any) => d._id === updated._id ? updated : d)
      )
    } catch (error: any) {
      alert('Failed to generate: ' + error.message)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSave = async () => {
    if (!selectedDoc) return
    setIsSaving(true)
    try {
      await api.patch(`/document-workshop/${selectedDoc._id}`, {
        currentContent: editableContent
      })
      setSelectedDoc((prev: any) => ({
        ...prev,
        currentContent: editableContent
      }))
      alert('✅ Changes saved')
    } catch (error) {
      alert('Failed to save')
    } finally {
      setIsSaving(false)
    }
  }

  const handleApprove = async () => {
    if (!window.confirm('Approve this as final version?')) return
    try {
      const res = await api.patch(
        `/document-workshop/${selectedDoc._id}/approve`
      )
      setSelectedDoc(res.data.document)
      setDocuments(prev =>
        prev.map((d: any) =>
          d._id === selectedDoc._id ? res.data.document : d
        )
      )
      alert('✅ Document approved as final')
    } catch (error) {
      alert('Failed to approve')
    }
  }

  const handleExtract = async () => {
    if (!window.confirm(
      'Extract stories from this document and add to Review Queue?'
    )) return
    setIsExtracting(true)
    try {
      const res = await api.post(
        `/document-workshop/${selectedDoc._id}/extract-stories`
      )
      alert(`✅ ${res.data.storiesCreated} stories added to Review Queue`)
      setSelectedDoc((prev: any) => ({
        ...prev,
        storiesExtracted: true,
        storiesCount: res.data.storiesCreated
      }))
      fetchDocuments()
    } catch (error) {
      alert('Failed to extract stories')
    } finally {
      setIsExtracting(false)
    }
  }

  const handleDownload = async () => {
    try {
      const res = await api.get(
        `/document-workshop/${selectedDoc._id}/download`
      )
      const blob = new Blob([res.data.content], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${res.data.title}_v${res.data.version}.md`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      alert('Failed to download')
    }
  }

  const handleAddComment = async () => {
    if (!comment.trim()) return
    try {
      const res = await api.post(
        `/document-workshop/${selectedDoc._id}/comment`,
        { text: comment }
      )
      setSelectedDoc(res.data.document)
      setComment('')
    } catch (error) {
      alert('Failed to add comment')
    }
  }

  const handleDelete = async (docId: string) => {
    if (!window.confirm('Delete this document?')) return
    try {
      await api.delete(`/document-workshop/${docId}`)
      setDocuments(prev => prev.filter((d: any) => d._id !== docId))
      if (selectedDoc?._id === docId) setSelectedDoc(null)
    } catch (error) {
      alert('Failed to delete')
    }
  }

  return (
    <AppShell pageTitle="Document Workshop">
      <div style={{
        height: '100vh',
        display: 'flex',
        backgroundColor: '#f1f5f9',
        overflow: 'hidden'
      }}>
        {/* LEFT SIDEBAR */}
        <div style={{
          width: 260,
          backgroundColor: 'white',
          borderRight: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0
        }}>
          <div style={{
            padding: 16,
            borderBottom: '1px solid #e2e8f0'
          }}>
            <h2 style={{
              fontSize: 15,
              fontWeight: 700,
              margin: '0 0 12px',
              color: '#0f172a'
            }}>
              📄 Document Workshop
            </h2>
            <button
              onClick={() => setShowNewForm(true)}
              style={{
                width: '100%',
                backgroundColor: '#1c2655',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                padding: '10px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              + New Document
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
            {documents.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: 32,
                color: '#94a3b8',
                fontSize: 13
              }}>
                No documents yet.
                <br />Click + New Document
              </div>
            ) : (
              documents.map((doc: any) => {
                const sc = STATUS_COLORS[doc.status] || STATUS_COLORS.draft
                const isSelected = selectedDoc?._id === doc._id
                return (
                  <div
                    key={doc._id}
                    onClick={() => {
                      setSelectedDoc(doc)
                      setEditableContent(doc.currentContent || '')
                      setActiveTab('editor')
                    }}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      marginBottom: 4,
                      backgroundColor: isSelected ? '#eff6ff' : 'transparent',
                      border: isSelected
                        ? '1px solid #93c5fd'
                        : '1px solid transparent'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start'
                    }}>
                      <p style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: '#0f172a',
                        margin: '0 0 4px',
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        paddingRight: 8
                      }}>
                        {doc.title}
                      </p>
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          handleDelete(doc._id)
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#dc2626',
                          cursor: 'pointer',
                          fontSize: 12,
                          padding: 0,
                          flexShrink: 0
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: 10,
                        backgroundColor: sc.bg,
                        color: sc.text,
                        padding: '1px 6px',
                        borderRadius: 999,
                        fontWeight: 600,
                        textTransform: 'uppercase'
                      }}>
                        {doc.status}
                      </span>
                      <span style={{ fontSize: 10, color: '#94a3b8' }}>
                        v{doc.currentVersion}
                      </span>
                      {doc.storiesExtracted && (
                        <span style={{ fontSize: 10, color: '#16a34a' }}>
                          ✅ {doc.storiesCount} stories
                        </span>
                      )}
                    </div>
                    <p style={{
                      fontSize: 11,
                      color: '#94a3b8',
                      margin: '4px 0 0'
                    }}>
                      {DOC_TYPES.find(t => t.value === doc.documentType)?.label}
                      {' • '}
                      {new Date(doc.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {showNewForm ? (
            <div style={{ flex: 1, overflowY: 'auto', padding: 32 }}>
              <div style={{ maxWidth: 680 }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 24
                }}>
                  <h2 style={{
                    fontSize: 20,
                    fontWeight: 700,
                    margin: 0
                  }}>
                    Create New Document
                  </h2>
                  <button
                    onClick={() => setShowNewForm(false)}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: 22,
                      cursor: 'pointer',
                      color: '#64748b'
                    }}
                  >×</button>
                </div>

                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16
                }}>
                  <div>
                    <label style={labelStyle}>Document Title *</label>
                    <input
                      value={newForm.title}
                      onChange={e => setNewForm({
                        ...newForm, title: e.target.value
                      })}
                      placeholder="e.g. Q2 Planning Call — Demo Client"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Document Type *</label>
                    <select
                      value={newForm.documentType}
                      onChange={e => setNewForm({
                        ...newForm, documentType: e.target.value
                      })}
                      style={inputStyle}
                    >
                      {DOC_TYPES.map(t => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                    <p style={{
                      fontSize: 12,
                      color: '#94a3b8',
                      margin: '4px 0 0'
                    }}>
                      Start with Meeting Notes to capture requirements
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: 16 }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Client Name</label>
                      <input
                        value={newForm.clientName}
                        onChange={e => setNewForm({
                          ...newForm, clientName: e.target.value
                        })}
                        placeholder="e.g. Demo Client"
                        style={inputStyle}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Meeting Date</label>
                      <input
                        type="date"
                        value={newForm.meetingDate}
                        onChange={e => setNewForm({
                          ...newForm, meetingDate: e.target.value
                        })}
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>
                      Meeting Notes / Context *
                    </label>
                    <p style={{
                      fontSize: 12,
                      color: '#94a3b8',
                      margin: '0 0 6px'
                    }}>
                      Paste your meeting notes or call transcript.
                      AI will generate the document from this.
                    </p>
                    <textarea
                      value={newForm.initialContext}
                      onChange={e => setNewForm({
                        ...newForm, initialContext: e.target.value
                      })}
                      placeholder={`Paste meeting notes here...

Example:
- Client needs payment gateway with UPI and cards
- Login should have OTP verification
- Dashboard needs monthly sales charts
- Mobile app should work offline
- Admin panel for user management`}
                      style={{
                        ...inputStyle,
                        height: 220,
                        resize: 'vertical',
                        fontFamily: 'inherit',
                        lineHeight: 1.6
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 12 }}>
                    <button
                      onClick={handleCreate}
                      disabled={isCreating}
                      style={{
                        flex: 1,
                        backgroundColor: isCreating ? '#94a3b8' : '#1c2655',
                        color: 'white',
                        border: 'none',
                        borderRadius: 8,
                        padding: '14px',
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: isCreating ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {isCreating
                        ? '⏳ Generating Document...'
                        : '🤖 Create & Generate Document'
                      }
                    </button>
                    <button
                      onClick={() => setShowNewForm(false)}
                      style={{
                        padding: '14px 20px',
                        border: '1px solid #e2e8f0',
                        borderRadius: 8,
                        background: 'white',
                        cursor: 'pointer',
                        fontSize: 14
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>

          ) : selectedDoc ? (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}>
              {/* HEADER */}
              <div style={{
                backgroundColor: 'white',
                borderBottom: '1px solid #e2e8f0',
                padding: '14px 20px'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start'
                }}>
                  <div>
                    <h2 style={{
                      fontSize: 17,
                      fontWeight: 700,
                      margin: 0,
                      color: '#0f172a'
                    }}>
                      {selectedDoc.title}
                    </h2>
                    <div style={{
                      display: 'flex',
                      gap: 12,
                      marginTop: 4,
                      fontSize: 12,
                      color: '#64748b',
                      alignItems: 'center'
                    }}>
                      <span>
                        {DOC_TYPES.find(
                          t => t.value === selectedDoc.documentType
                        )?.label}
                      </span>
                      {selectedDoc.clientName && (
                        <span>📁 {selectedDoc.clientName}</span>
                      )}
                      <span>Version {selectedDoc.currentVersion}</span>
                      <span style={{
                        backgroundColor: STATUS_COLORS[selectedDoc.status]?.bg,
                        color: STATUS_COLORS[selectedDoc.status]?.text,
                        padding: '1px 8px',
                        borderRadius: 999,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        fontSize: 11
                      }}>
                        {selectedDoc.status}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={handleDownload}
                      style={{
                        padding: '7px 14px',
                        backgroundColor: '#f8fafc',
                        color: '#374151',
                        border: '1px solid #e2e8f0',
                        borderRadius: 7,
                        fontSize: 12,
                        cursor: 'pointer'
                      }}
                    >
                      📥 Download
                    </button>
                    {selectedDoc.currentContent &&
                      !selectedDoc.storiesExtracted && (
                      <button
                        onClick={handleExtract}
                        disabled={isExtracting}
                        style={{
                          padding: '7px 14px',
                          backgroundColor: '#faf5ff',
                          color: '#7c3aed',
                          border: '1px solid #d8b4fe',
                          borderRadius: 7,
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: isExtracting ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {isExtracting ? '⏳ Extracting...' : '✨ Extract Stories'}
                      </button>
                    )}
                    {selectedDoc.storiesExtracted && (
                      <span style={{
                        padding: '7px 14px',
                        backgroundColor: '#f0fdf4',
                        color: '#16a34a',
                        borderRadius: 7,
                        fontSize: 12,
                        fontWeight: 500
                      }}>
                        ✅ {selectedDoc.storiesCount} stories extracted
                      </span>
                    )}
                    {selectedDoc.status !== 'approved' &&
                      selectedDoc.currentContent && (
                      <button
                        onClick={handleApprove}
                        style={{
                          padding: '7px 14px',
                          backgroundColor: '#16a34a',
                          color: 'white',
                          border: 'none',
                          borderRadius: 7,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        ✅ Approve Final
                      </button>
                    )}
                  </div>
                </div>

                {/* VERSION PILLS */}
                {selectedDoc.versions?.length > 0 && (
                  <div style={{
                    display: 'flex',
                    gap: 6,
                    marginTop: 10,
                    alignItems: 'center'
                  }}>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>
                      Versions:
                    </span>
                    {selectedDoc.versions.map((v: any) => (
                      <button
                        key={v.versionNumber}
                        onClick={() => setEditableContent(v.content)}
                        style={{
                          padding: '2px 8px',
                          borderRadius: 4,
                          border: '1px solid #e2e8f0',
                          backgroundColor:
                            v.versionNumber === selectedDoc.currentVersion
                              ? '#1c2655' : 'white',
                          color:
                            v.versionNumber === selectedDoc.currentVersion
                              ? 'white' : '#64748b',
                          fontSize: 11,
                          cursor: 'pointer'
                        }}
                      >
                        v{v.versionNumber}
                        {v.addedContext ? ' +' : ''}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* TABS */}
              <div style={{
                backgroundColor: 'white',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                padding: '0 20px'
              }}>
                {[
                  { key: 'editor', label: '✏️ Edit' },
                  { key: 'iterate', label: '🔄 Iterate' },
                  { key: 'comments', label: '💬 Comments' }
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    style={{
                      padding: '10px 16px',
                      fontSize: 13,
                      fontWeight: activeTab === tab.key ? 600 : 400,
                      cursor: 'pointer',
                      border: 'none',
                      borderBottom: activeTab === tab.key
                        ? '2px solid #0088ff'
                        : '2px solid transparent',
                      color: activeTab === tab.key ? '#0088ff' : '#64748b',
                      backgroundColor: 'transparent'
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* TAB CONTENT */}
              <div style={{
                flex: 1,
                overflow: 'hidden',
                display: 'flex'
              }}>
                {activeTab === 'editor' && (
                  <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column'
                  }}>
                    {selectedDoc.currentContent ? (
                      <>
                        <div style={{
                          padding: '8px 16px',
                          backgroundColor: '#f8fafc',
                          borderBottom: '1px solid #e2e8f0',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <span style={{ fontSize: 12, color: '#64748b' }}>
                            Edit document directly below
                          </span>
                          <button
                            onClick={handleSave}
                            disabled={isSaving}
                            style={{
                              padding: '5px 14px',
                              backgroundColor: '#16a34a',
                              color: 'white',
                              border: 'none',
                              borderRadius: 6,
                              fontSize: 12,
                              cursor: 'pointer'
                            }}
                          >
                            {isSaving ? '⏳' : '💾 Save'}
                          </button>
                        </div>
                        <textarea
                          value={editableContent}
                          onChange={e => setEditableContent(e.target.value)}
                          style={{
                            flex: 1,
                            padding: '20px 24px',
                            border: 'none',
                            outline: 'none',
                            resize: 'none',
                            fontSize: 13,
                            lineHeight: 1.8,
                            fontFamily: 'monospace',
                            color: '#1e293b',
                            backgroundColor: 'white'
                          }}
                        />
                      </>
                    ) : (
                      <div style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 48, marginBottom: 16 }}>
                            🤖
                          </div>
                          <p style={{
                            fontSize: 16,
                            color: '#64748b',
                            margin: '0 0 16px'
                          }}>
                            No content yet
                          </p>
                          <button
                            onClick={() => handleGenerate()}
                            disabled={isGenerating}
                            style={{
                              backgroundColor: '#1c2655',
                              color: 'white',
                              border: 'none',
                              borderRadius: 8,
                              padding: '10px 20px',
                              cursor: 'pointer',
                              fontSize: 14
                            }}
                          >
                            {isGenerating
                              ? '⏳ Generating...'
                              : '🤖 Generate Document'
                            }
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'iterate' && (
                  <div style={{
                    flex: 1,
                    padding: 24,
                    overflowY: 'auto'
                  }}>
                    <h3 style={{
                      fontSize: 16,
                      fontWeight: 700,
                      margin: '0 0 8px',
                      color: '#0f172a'
                    }}>
                      🔄 Iterate & Improve
                    </h3>
                    <p style={{
                      fontSize: 13,
                      color: '#64748b',
                      margin: '0 0 20px',
                      lineHeight: 1.6
                    }}>
                      Add more context from your next meeting.
                      AI will regenerate incorporating all previous
                      context plus your new additions.
                    </p>

                    <div style={{ marginBottom: 16 }}>
                      <label style={labelStyle}>
                        What changed or was discussed?
                      </label>
                      <textarea
                        value={additionalContext}
                        onChange={e => setAdditionalContext(e.target.value)}
                        placeholder={`Add new context from latest discussion...

Example:
- Client confirmed payment must support international cards
- Dashboard must show weekly data not monthly
- Login timeout should be 30 minutes
- Need Arabic language support`}
                        style={{
                          ...inputStyle,
                          height: 180,
                          resize: 'vertical',
                          fontFamily: 'inherit',
                          lineHeight: 1.6
                        }}
                      />
                    </div>

                    <button
                      onClick={() => handleGenerate()}
                      disabled={isGenerating || !additionalContext.trim()}
                      style={{
                        width: '100%',
                        backgroundColor:
                          isGenerating || !additionalContext.trim()
                            ? '#94a3b8' : '#0088ff',
                        color: 'white',
                        border: 'none',
                        borderRadius: 8,
                        padding: '12px',
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: isGenerating || !additionalContext.trim()
                          ? 'not-allowed' : 'pointer',
                        marginBottom: 24
                      }}
                    >
                      {isGenerating
                        ? '⏳ Regenerating...'
                        : '🤖 Regenerate with New Context'
                      }
                    </button>

                    {selectedDoc.versions?.length > 0 && (
                      <div>
                        <h4 style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: '#374151',
                          margin: '0 0 12px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em'
                        }}>
                          Version History
                        </h4>
                        {[...selectedDoc.versions]
                          .reverse()
                          .map((v: any) => (
                          <div key={v.versionNumber} style={{
                            backgroundColor: 'white',
                            border: '1px solid #e2e8f0',
                            borderRadius: 8,
                            padding: '12px 16px',
                            marginBottom: 10
                          }}>
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: v.addedContext ? 8 : 0
                            }}>
                              <span style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: v.versionNumber ===
                                  selectedDoc.currentVersion
                                  ? '#0088ff' : '#374151'
                              }}>
                                Version {v.versionNumber}
                                {v.versionNumber ===
                                  selectedDoc.currentVersion &&
                                  ' (Current)'}
                              </span>
                              <div style={{
                                display: 'flex',
                                gap: 8,
                                alignItems: 'center'
                              }}>
                                <span style={{
                                  fontSize: 11,
                                  color: '#94a3b8'
                                }}>
                                  {new Date(v.generatedAt).toLocaleString()}
                                </span>
                                <button
                                  onClick={() => {
                                    setEditableContent(v.content)
                                    setActiveTab('editor')
                                  }}
                                  style={{
                                    padding: '3px 10px',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: 4,
                                    background: 'white',
                                    fontSize: 11,
                                    cursor: 'pointer',
                                    color: '#64748b'
                                  }}
                                >
                                  View
                                </button>
                              </div>
                            </div>
                            {v.addedContext && (
                              <p style={{
                                fontSize: 12,
                                color: '#64748b',
                                margin: 0,
                                backgroundColor: '#f8fafc',
                                padding: '6px 10px',
                                borderRadius: 6,
                                fontStyle: 'italic'
                              }}>
                                Added: {v.addedContext.substring(0, 100)}
                                {v.addedContext.length > 100 && '...'}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'comments' && (
                  <div style={{
                    flex: 1,
                    padding: 24,
                    overflowY: 'auto'
                  }}>
                    <h3 style={{
                      fontSize: 16,
                      fontWeight: 700,
                      margin: '0 0 16px',
                      color: '#0f172a'
                    }}>
                      💬 Comments & Feedback
                    </h3>

                    <div style={{ marginBottom: 20 }}>
                      <textarea
                        value={comment}
                        onChange={e => setComment(e.target.value)}
                        placeholder="Add a comment or feedback..."
                        style={{
                          ...inputStyle,
                          height: 80,
                          resize: 'none',
                          fontFamily: 'inherit',
                          marginBottom: 8
                        }}
                      />
                      <button
                        onClick={handleAddComment}
                        disabled={!comment.trim()}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: !comment.trim()
                            ? '#94a3b8' : '#1c2655',
                          color: 'white',
                          border: 'none',
                          borderRadius: 6,
                          fontSize: 13,
                          cursor: !comment.trim()
                            ? 'not-allowed' : 'pointer'
                        }}
                      >
                        Add Comment
                      </button>
                    </div>

                    {selectedDoc.versions?.flatMap((v: any) =>
                      (v.comments || []).map((c: any, i: number) => (
                        <div key={`${v.versionNumber}-${i}`} style={{
                          backgroundColor: 'white',
                          border: '1px solid #e2e8f0',
                          borderRadius: 8,
                          padding: '12px 16px',
                          marginBottom: 10
                        }}>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginBottom: 6
                          }}>
                            <span style={{
                              fontSize: 11,
                              color: '#0088ff',
                              fontWeight: 600
                            }}>
                              v{v.versionNumber} comment
                            </span>
                            <span style={{
                              fontSize: 11,
                              color: '#94a3b8'
                            }}>
                              {new Date(c.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p style={{
                            fontSize: 13,
                            color: '#374151',
                            margin: 0,
                            lineHeight: 1.5
                          }}>
                            {c.text}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

          ) : (
            /* EMPTY STATE */
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 64, marginBottom: 16 }}>📄</div>
                <h2 style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: '#0f172a',
                  margin: '0 0 8px'
                }}>
                  Document Workshop
                </h2>
                <p style={{
                  fontSize: 14,
                  color: '#64748b',
                  margin: '0 0 24px',
                  maxWidth: 400,
                  lineHeight: 1.6
                }}>
                  Create and iterate BA documents with AI.
                  Start with meeting notes and generate PRD,
                  Use Case Catalogue, Sprint Plan and more.
                </p>
                <button
                  onClick={() => setShowNewForm(true)}
                  style={{
                    backgroundColor: '#1c2655',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    padding: '12px 24px',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  + Create First Document
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
