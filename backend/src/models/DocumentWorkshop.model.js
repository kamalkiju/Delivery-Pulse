import mongoose from 'mongoose'
const { Schema, model } = mongoose

const VersionSchema = new Schema({
  versionNumber: { type: Number, required: true },
  content: { type: String, required: true },
  addedContext: { type: String, default: '' },
  generatedAt: { type: Date, default: Date.now },
  comments: [{
    text: String,
    createdAt: { type: Date, default: Date.now }
  }]
})

const DocumentWorkshopSchema = new Schema({
  organisationId: { 
    type: Schema.Types.ObjectId, 
    required: true 
  },
  title: { type: String, required: true },
  documentType: { 
    type: String,
    enum: [
      'understanding-document',
      'problem-statement',
      'prd',
      'use-case-catalogue',
      'sprint-plan',
      'rtm',
      'release-notes',
      'meeting-notes',
      'user-guide'
    ],
    required: true
  },
  clientName: { type: String },
  meetingDate: { type: Date },
  initialContext: { type: String, required: true },
  currentContent: { type: String, default: '' },
  versions: [VersionSchema],
  currentVersion: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['draft', 'in-review', 'approved', 'final'],
    default: 'draft'
  },
  storiesExtracted: { type: Boolean, default: false },
  storiesCount: { type: Number, default: 0 },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

export default model('DocumentWorkshop', DocumentWorkshopSchema)
