import mongoose from 'mongoose'
const { Schema, model } = mongoose

const FeatureSchema = new Schema({
  organisationId: {
    type: Schema.Types.ObjectId,
    required: true
  },
  projectId: {
    type: Schema.Types.ObjectId,
    ref: 'Project',
    default: null
  },
  epicId: {
    type: Schema.Types.ObjectId,
    ref: 'Epic',
    required: true
  },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  priority: {
    type: String,
    enum: ['Critical', 'High', 'Medium', 'Low'],
    default: 'Medium'
  },
  sprint: {
    type: String,
    enum: ['Sprint 1', 'Sprint 2', 'Sprint 3', 'Sprint 4', 'Current', 'Next', 'Backlog'],
    default: 'Backlog'
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'done'],
    default: 'draft'
  },
  adoId: { type: String, default: null },
  adoUrl: { type: String, default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

export default model('Feature', FeatureSchema)
