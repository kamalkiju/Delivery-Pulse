import DocumentWorkshop from '../../models/DocumentWorkshop.model.js'
import Story from '../../models/Story.model.js'
import Anthropic from '@anthropic-ai/sdk'

const getClaudeClient = () => new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY
})

const getPrompt = (documentType, context, additions, currentContent) => {
  const additionText = additions
    ? `\nNew additions from latest discussion:\n${additions}\n`
    : ''
  const existingText = currentContent
    ? `\nPrevious version to improve upon:\n${currentContent}\n`
    : ''

  const prompts = {
    'understanding-document': `You are a senior Business Analyst.
Create a professional Understanding Document.
${existingText}${additionText}
Structure:
# Understanding Document
## Executive Summary
## Business Background & Context
## Problem Overview
## Objectives & Expected Outcomes
## Scope Definition
### In-Scope
### Out-of-Scope
## Key Assumptions & Constraints
## Stakeholder Overview
| Stakeholder | Role | Responsibilities | Challenges |
## Success Indicators
## Risks & Open Questions
Context: ${context}`,

    'problem-statement': `You are a senior Business Analyst.
Create a Problem Statement document.
${existingText}${additionText}
Structure:
# Problem Statement & Assumptions
## Problem Statement
## Business Impact
## Current Challenges & Pain Points
## Assumptions
## Constraints
## Risks & Dependencies
## Summary & Next Steps
Context: ${context}`,

    'prd': `You are a senior Business Analyst.
Create a comprehensive PRD.
${existingText}${additionText}
Structure:
# Product Requirement Document
## Product Overview
## Current Process
### Stakeholders Involved
### System Touchpoints
### Current Workflow
## To-Be Process
### Automated Workflow
### Feature Requirements
## Functional Requirements
## Non-Functional Requirements
## UI Requirements
## Acceptance Criteria Summary
## Backlog Overview
Context: ${context}`,

    'use-case-catalogue': `You are a senior Business Analyst.
Create a Use Case Catalogue.
${existingText}${additionText}
Structure:
# Use Case Catalogue
## Introduction & Scope
## Actors Overview
| Actor | Role | Description |
## Use Case List
| UC ID | Use Case | Actor | Priority |
## Use Case Descriptions
### UC-01: [Name]
**Goal:**
**Actor:**
**Preconditions:**
**Main Flow:**
**Alternate Flows:**
**Postconditions:**
Context: ${context}`,

    'sprint-plan': `You are a senior Business Analyst.
Create a Sprint Plan document.
${existingText}${additionText}
Structure:
# Sprint Plan
## Delivery Overview
## Sprint 1 — Current Sprint
### Stories Included
### Estimated Duration
### Key Deliverables
## Sprint 2 — Next Sprint
### Stories Planned
## Backlog Items
## Timeline & Milestones
| Milestone | Target Date | Status |
## Resource Plan
## Dependencies
## Risks & Mitigation
Context: ${context}`,

    'rtm': `You are a senior Business Analyst.
Create a Requirement Traceability Matrix.
${existingText}${additionText}
Structure:
# Requirement Traceability Matrix (RTM)
## Overview
## Traceability Matrix
| Req ID | Requirement | Story ID | ADO ID | Dev Status | Test Status | Sign-off |
## Gap Analysis
## Status Summary
Context: ${context}`,

    'release-notes': `You are creating Release Notes.
${existingText}${additionText}
Structure:
# Release Notes — v[VERSION]
## Version Information
## What's New
## Bug Fixes
## Known Issues
## Next Steps
Context: ${context}`,

    'meeting-notes': `You are a senior Business Analyst.
Analyze these meeting notes and create a structured document.
${existingText}${additionText}
Structure:
# Meeting Summary
## Meeting Overview
## Key Discussion Points
## Requirements Identified
| # | Requirement | Priority | Notes |
## Action Items
| Action | Owner | Due Date |
## Decisions Made
## Open Questions
## Next Steps
Meeting notes: ${context}`,

    'user-guide': `You are creating a User Guide.
${existingText}${additionText}
Structure:
# User Guide
## System Overview
## User Roles & Access
## Getting Started
## Module Guides
## FAQs
## Troubleshooting
Context: ${context}`
  }

  return prompts[documentType] || prompts['understanding-document']
}

export const getDocuments = async (req, res) => {
  try {
    const organisationId = req.user.organisationId ||
                           req.user.orgId ||
                           req.user.organization ||
                           req.user.org

    const filter = organisationId ? { organisationId } : {}

    const docs = await DocumentWorkshop.find(filter)
      .sort({ updatedAt: -1 })

    res.json({ success: true, documents: docs })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const createDocument = async (req, res) => {
  try {
    const {
      title, documentType, clientName,
      meetingDate, initialContext, projectId
    } = req.body

    console.log('[doc-workshop] req.user:', JSON.stringify(req.user))

    const organisationId = req.user.organisationId ||
                           req.user.orgId ||
                           req.user.organization ||
                           req.user.org

    if (!organisationId) {
      return res.status(400).json({
        success: false,
        message: 'Organisation ID not found in user token'
      })
    }

    const doc = await DocumentWorkshop.create({
      organisationId,
      projectId: projectId || null,
      title,
      documentType: documentType || 'meeting-notes',
      clientName: clientName || '',
      meetingDate: meetingDate || new Date(),
      initialContext,
      currentContent: '',
      versions: [],
      currentVersion: 0,
      status: 'draft',
      createdBy: req.user.userId || req.user._id || req.user.id
    })

    console.log('[doc-workshop] Created:', doc.title, doc.documentType)
    res.status(201).json({ success: true, document: doc })
  } catch (error) {
    console.error('[doc-workshop] Create error:', error.message)
    res.status(500).json({ success: false, message: error.message })
  }
}

export const generateVersion = async (req, res) => {
  try {
    const doc = await DocumentWorkshop.findById(req.params.id)
    if (!doc) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      })
    }

    const { additionalContext } = req.body
    const claude = getClaudeClient()

    console.log('[doc-workshop] Generating version',
      doc.currentVersion + 1, 'for:', doc.title)

    const prompt = getPrompt(
      doc.documentType,
      doc.initialContext,
      additionalContext || '',
      doc.currentContent || ''
    )

    const response = await claude.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    })

    const content = response.content[0].text

    const newVersion = {
      versionNumber: doc.currentVersion + 1,
      content,
      addedContext: additionalContext || '',
      generatedAt: new Date(),
      comments: []
    }

    doc.versions.push(newVersion)
    doc.currentVersion = newVersion.versionNumber
    doc.currentContent = content
    doc.updatedAt = new Date()

    await doc.save()

    console.log('[doc-workshop] Version', newVersion.versionNumber, 'done')

    res.json({
      success: true,
      document: doc,
      version: newVersion,
      message: `Version ${newVersion.versionNumber} generated`
    })
  } catch (error) {
    console.error('[doc-workshop] Generate error:', error.message)
    res.status(500).json({ success: false, message: error.message })
  }
}

export const updateDocument = async (req, res) => {
  try {
    const { currentContent, status, title } = req.body
    const doc = await DocumentWorkshop.findById(req.params.id)

    if (!doc) {
      return res.status(404).json({
        success: false, message: 'Document not found'
      })
    }

    if (currentContent !== undefined) {
      doc.currentContent = currentContent
      if (doc.versions.length > 0) {
        doc.versions[doc.versions.length - 1].content = currentContent
      }
    }
    if (status) doc.status = status
    if (title) doc.title = title
    doc.updatedAt = new Date()

    await doc.save()
    res.json({ success: true, document: doc })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const approveDocument = async (req, res) => {
  try {
    const doc = await DocumentWorkshop.findByIdAndUpdate(
      req.params.id,
      { status: 'approved', updatedAt: new Date() },
      { new: true }
    )
    res.json({
      success: true,
      document: doc,
      message: 'Document approved as final version'
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const extractStories = async (req, res) => {
  try {
    const doc = await DocumentWorkshop.findById(req.params.id)
    if (!doc || !doc.currentContent) {
      return res.status(404).json({
        success: false, message: 'Document not found or empty'
      })
    }

    const claude = getClaudeClient()

    const prompt = `Extract all user stories from this document.
Return ONLY raw JSON - no markdown backticks:
{
  "stories": [
    {
      "storyTitle": "Module > Feature Name",
      "type": "Story or Bug or Feature or Task",
      "priority": "Critical or High or Medium or Low",
      "description": "As a [role] I need [what] So that [value]",
      "acceptanceCriteria": [
        {"id": "AC 1", "scenario": "Given X When Y Then Z"},
        {"id": "AC 2", "scenario": "Given X When Y Then Z"},
        {"id": "AC 3", "scenario": "Given X When Y Then Z"}
      ],
      "releaseNotes": "We introduced X to solve Y",
      "sprint": "Current or Next or Backlog"
    }
  ]
}

Rules:
- Extract EVERY requirement as a story
- Minimum 3 AC per story in Given/When/Then format
- Description must be As a X I need Y So that Z

Document:
${doc.currentContent.substring(0, 15000)}`

    const response = await claude.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    })

    const text = response.content[0].text
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim()

    const jsonStart = text.indexOf('{')
    const jsonEnd = text.lastIndexOf('}')
    const analysis = JSON.parse(text.substring(jsonStart, jsonEnd + 1))

    const createdStories = []
    for (const storyData of (analysis.stories || [])) {
      const story = await Story.create({
        organisationId: doc.organisationId,
        title: storyData.storyTitle,
        storyTitle: storyData.storyTitle,
        description: storyData.description,
        type: storyData.type || 'Story',
        priority: storyData.priority || 'Medium',
        status: 'pending-review',
        source: 'meeting',
        sourceQuote: `From document: ${doc.title}`,
        acceptanceCriteria: (storyData.acceptanceCriteria || [])
          .map(ac => ac.scenario || ac),
        acceptanceCriteriaFormatted: storyData.acceptanceCriteria || [],
        releaseNotes: storyData.releaseNotes || '',
        sprint: storyData.sprint || 'Backlog',
        isAIGenerated: true
      })
      createdStories.push(story)
    }

    doc.storiesExtracted = true
    doc.storiesCount = createdStories.length
    await doc.save()

    res.json({
      success: true,
      storiesCreated: createdStories.length,
      message: `${createdStories.length} stories added to Review Queue`
    })
  } catch (error) {
    console.error('[doc-workshop] Extract error:', error.message)
    res.status(500).json({ success: false, message: error.message })
  }
}

export const addComment = async (req, res) => {
  try {
    const { text } = req.body
    const doc = await DocumentWorkshop.findById(req.params.id)
    if (!doc) {
      return res.status(404).json({
        success: false, message: 'Document not found'
      })
    }
    if (doc.versions.length > 0) {
      doc.versions[doc.versions.length - 1].comments.push({ text })
    }
    await doc.save()
    res.json({ success: true, document: doc })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const downloadDocument = async (req, res) => {
  try {
    const doc = await DocumentWorkshop.findById(req.params.id)
    if (!doc) {
      return res.status(404).json({
        success: false, message: 'Document not found'
      })
    }
    res.json({
      success: true,
      content: doc.currentContent,
      title: doc.title,
      documentType: doc.documentType,
      version: doc.currentVersion
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const deleteDocument = async (req, res) => {
  try {
    await DocumentWorkshop.findByIdAndDelete(req.params.id)
    res.json({ success: true, message: 'Document deleted' })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}
