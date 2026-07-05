import express from 'express'
import { authMiddleware } from '../../middlewares/auth.middleware.js'
import {
  getEpics,
  createEpic,
  updateEpic,
  deleteEpic,
  pushEpicToADO,
  getFeatures,
  createFeature,
  updateFeature,
  deleteFeature,
  pushFeatureToADO,
  getHierarchy
} from './epic-feature.controller.js'

const router = express.Router()

// Hierarchy
router.get('/hierarchy', authMiddleware, getHierarchy)

// Epic routes
router.get('/epics', authMiddleware, getEpics)
router.post('/epics', authMiddleware, createEpic)
router.patch('/epics/:id', authMiddleware, updateEpic)
router.delete('/epics/:id', authMiddleware, deleteEpic)
router.post('/epics/:id/push-to-ado', authMiddleware, pushEpicToADO)

// Feature routes
router.get('/features', authMiddleware, getFeatures)
router.post('/features', authMiddleware, createFeature)
router.patch('/features/:id', authMiddleware, updateFeature)
router.delete('/features/:id', authMiddleware, deleteFeature)
router.post('/features/:id/push-to-ado', authMiddleware, pushFeatureToADO)

export default router
