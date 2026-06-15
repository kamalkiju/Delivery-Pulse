import express from 'express'
import { authMiddleware } from '../../middlewares/auth.middleware.js'
import {
  getDocuments,
  createDocument,
  generateVersion,
  updateDocument,
  approveDocument,
  extractStories,
  addComment,
  downloadDocument,
  deleteDocument
} from './document-workshop.controller.js'

const router = express.Router()

router.get('/', authMiddleware, getDocuments)
router.post('/', authMiddleware, createDocument)
router.post('/:id/generate', authMiddleware, generateVersion)
router.patch('/:id/approve', authMiddleware, approveDocument)
router.post('/:id/extract-stories', authMiddleware, extractStories)
router.post('/:id/comment', authMiddleware, addComment)
router.get('/:id/download', authMiddleware, downloadDocument)
router.patch('/:id', authMiddleware, updateDocument)
router.delete('/:id', authMiddleware, deleteDocument)

export default router
