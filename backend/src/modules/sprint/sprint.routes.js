import express from 'express'
import { authMiddleware } from '../../middlewares/auth.middleware.js'
import {
  getSprints,
  createSprint,
  updateSprint,
  deleteSprint,
  assignStoryToSprint,
  assignFeatureToSprint,
  getSprintBoard
} from './sprint.controller.js'

const router = express.Router()

router.get('/board', authMiddleware, getSprintBoard)
router.get('/', authMiddleware, getSprints)
router.post('/', authMiddleware, createSprint)
router.post('/assign-story', authMiddleware, assignStoryToSprint)
router.post('/assign-feature', authMiddleware, assignFeatureToSprint)
router.patch('/:id', authMiddleware, updateSprint)
router.delete('/:id', authMiddleware, deleteSprint)

export default router
