import mongoose from 'mongoose'
const { Schema, model } = mongoose

const SprintSchema = new Schema({
  organisationId: {
    type: Schema.Types.ObjectId,
    required: true
  },
  name: { type: String, required: true },
  displayName: { type: String },
  startDate: { type: Date },
  endDate: { type: Date },
  status: {
    type: String,
    enum: ['planning', 'active', 'completed'],
    default: 'planning'
  },
  goal: { type: String, default: '' },
  order: { type: Number, default: 0 },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

export default model('Sprint', SprintSchema)
