import Epic from '../../models/Epic.model.js'
import Feature from '../../models/Feature.model.js'
import Story from '../../models/Story.model.js'

// ==================== EPIC CONTROLLERS ====================

export const getEpics = async (req, res) => {
  try {
    const epics = await Epic.find({
      organisationId: req.user.organisationId
    }).sort({ createdAt: -1 })

    const epicsWithCounts = await Promise.all(
      epics.map(async (epic) => {
        const featureCount = await Feature.countDocuments({
          epicId: epic._id
        })
        const storyCount = await Story.countDocuments({
          epicId: epic._id
        })
        return {
          ...epic.toObject(),
          featureCount,
          storyCount
        }
      })
    )

    res.json({ success: true, epics: epicsWithCounts })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const createEpic = async (req, res) => {
  try {
    const { name, description, priority, projectId } = req.body

    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Epic name is required'
      })
    }

    const epic = await Epic.create({
      organisationId: req.user.organisationId,
      projectId: projectId || null,
      name: name.trim(),
      description: description || '',
      priority: priority || 'Medium',
      status: 'draft',
      createdBy: req.user.userId
    })

    console.log('[epic] Created:', epic.name)
    res.status(201).json({ success: true, epic })
  } catch (error) {
    console.error('[epic] Create error:', error.message)
    res.status(500).json({ success: false, message: error.message })
  }
}

export const updateEpic = async (req, res) => {
  try {
    const { name, description, priority, status } = req.body

    const epic = await Epic.findByIdAndUpdate(
      req.params.id,
      {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(priority && { priority }),
        ...(status && { status }),
        updatedAt: new Date()
      },
      { new: true }
    )

    if (!epic) {
      return res.status(404).json({
        success: false,
        message: 'Epic not found'
      })
    }

    res.json({ success: true, epic })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const deleteEpic = async (req, res) => {
  try {
    const epicId = req.params.id

    const featureCount = await Feature.countDocuments({ epicId })
    if (featureCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete epic with ${featureCount} features. Delete features first.`
      })
    }

    await Epic.findByIdAndDelete(epicId)
    res.json({ success: true, message: 'Epic deleted' })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const pushEpicToADO = async (req, res) => {
  try {
    const epic = await Epic.findById(req.params.id)
    if (!epic) {
      return res.status(404).json({
        success: false,
        message: 'Epic not found'
      })
    }

    const AdoConnection = (await import(
      '../../models/AdoConnection.model.js'
    )).default

    const conn = await AdoConnection.findOne({
      isDefault: true,
      isActive: true,
      connectionStatus: 'connected'
    }) || await AdoConnection.findOne({
      isActive: true,
      connectionStatus: 'connected'
    })

    if (!conn) {
      return res.status(400).json({
        success: false,
        message: 'No active ADO connection found'
      })
    }

    const pat = Buffer.from(`:${conn.patToken}`).toString('base64')
    const encodedProject = encodeURIComponent(conn.adoProject)

    const patchDocument = [
      {
        op: 'add',
        path: '/fields/System.Title',
        value: epic.name
      },
      {
        op: 'add',
        path: '/fields/System.Description',
        value: epic.description || ''
      },
      {
        op: 'add',
        path: '/fields/Microsoft.VSTS.Common.Priority',
        value: { Critical: 1, High: 2, Medium: 3, Low: 4 }[epic.priority] || 3
      }
    ]

    const url = `https://dev.azure.com/${conn.adoOrg}/${encodedProject}/_apis/wit/workitems/$Epic?api-version=7.0`

    console.log('[epic] Pushing to ADO:', epic.name)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json-patch+json',
        'Authorization': `Basic ${pat}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify(patchDocument)
    })

    const responseText = await response.text()

    if (responseText.includes('<!DOCTYPE')) {
      throw new Error('ADO auth failed. Check PAT token in Settings.')
    }

    if (!response.ok) {
      throw new Error(`ADO ${response.status}: ${responseText.substring(0, 200)}`)
    }

    const result = JSON.parse(responseText)
    const adoUrl = `https://dev.azure.com/${conn.adoOrg}/${encodedProject}/_workitems/edit/${result.id}`

    epic.adoId = String(result.id)
    epic.adoUrl = adoUrl
    epic.status = 'active'
    await epic.save()

    console.log('[epic] ADO Epic created:', result.id)

    res.json({
      success: true,
      epic,
      adoId: result.id,
      adoUrl,
      message: `Epic pushed to ADO as #${result.id}`
    })
  } catch (error) {
    console.error('[epic] ADO push error:', error.message)
    res.status(500).json({ success: false, message: error.message })
  }
}

// ==================== FEATURE CONTROLLERS ====================

export const getFeatures = async (req, res) => {
  try {
    const { epicId } = req.query

    const filter = {
      organisationId: req.user.organisationId,
      ...(epicId && { epicId })
    }

    const features = await Feature.find(filter)
      .populate('epicId', 'name')
      .sort({ createdAt: -1 })

    const featuresWithCounts = await Promise.all(
      features.map(async (feature) => {
        const storyCount = await Story.countDocuments({
          featureId: feature._id
        })
        return {
          ...feature.toObject(),
          storyCount
        }
      })
    )

    res.json({ success: true, features: featuresWithCounts })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const createFeature = async (req, res) => {
  try {
    const { name, description, epicId, priority, sprint, projectId } = req.body

    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Feature name is required'
      })
    }

    if (!epicId) {
      return res.status(400).json({
        success: false,
        message: 'Epic is required for a feature'
      })
    }

    const epic = await Epic.findById(epicId)
    if (!epic) {
      return res.status(404).json({
        success: false,
        message: 'Epic not found'
      })
    }

    const feature = await Feature.create({
      organisationId: req.user.organisationId,
      projectId: projectId || null,
      epicId,
      name: name.trim(),
      description: description || '',
      priority: priority || 'Medium',
      sprint: sprint || 'Backlog',
      status: 'draft',
      createdBy: req.user.userId
    })

    console.log('[feature] Created:', feature.name, 'under epic:', epic.name)
    res.status(201).json({ success: true, feature })
  } catch (error) {
    console.error('[feature] Create error:', error.message)
    res.status(500).json({ success: false, message: error.message })
  }
}

export const updateFeature = async (req, res) => {
  try {
    const { name, description, priority, sprint, status } = req.body

    const feature = await Feature.findByIdAndUpdate(
      req.params.id,
      {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(priority && { priority }),
        ...(sprint && { sprint }),
        ...(status && { status }),
        updatedAt: new Date()
      },
      { new: true }
    )

    if (!feature) {
      return res.status(404).json({
        success: false,
        message: 'Feature not found'
      })
    }

    res.json({ success: true, feature })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const deleteFeature = async (req, res) => {
  try {
    const featureId = req.params.id

    const storyCount = await Story.countDocuments({ featureId })
    if (storyCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete feature with ${storyCount} stories. Unlink stories first.`
      })
    }

    await Feature.findByIdAndDelete(featureId)
    res.json({ success: true, message: 'Feature deleted' })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const pushFeatureToADO = async (req, res) => {
  try {
    const feature = await Feature.findById(req.params.id)
      .populate('epicId', 'name adoId')

    if (!feature) {
      return res.status(404).json({
        success: false,
        message: 'Feature not found'
      })
    }

    const AdoConnection = (await import(
      '../../models/AdoConnection.model.js'
    )).default

    const conn = await AdoConnection.findOne({
      isDefault: true,
      isActive: true,
      connectionStatus: 'connected'
    }) || await AdoConnection.findOne({
      isActive: true,
      connectionStatus: 'connected'
    })

    if (!conn) {
      return res.status(400).json({
        success: false,
        message: 'No active ADO connection found'
      })
    }

    const pat = Buffer.from(`:${conn.patToken}`).toString('base64')
    const encodedProject = encodeURIComponent(conn.adoProject)

    const patchDocument = [
      {
        op: 'add',
        path: '/fields/System.Title',
        value: feature.name
      },
      {
        op: 'add',
        path: '/fields/System.Description',
        value: feature.description || ''
      },
      {
        op: 'add',
        path: '/fields/Microsoft.VSTS.Common.Priority',
        value: { Critical: 1, High: 2, Medium: 3, Low: 4 }[feature.priority] || 3
      }
    ]

    if (feature.sprint && feature.sprint !== 'Backlog') {
      patchDocument.push({
        op: 'add',
        path: '/fields/System.IterationPath',
        value: `${conn.adoProject}\\${feature.sprint}`
      })
    }

    if (feature.epicId?.adoId) {
      patchDocument.push({
        op: 'add',
        path: '/relations/-',
        value: {
          rel: 'System.LinkTypes.Hierarchy-Reverse',
          url: `https://dev.azure.com/${conn.adoOrg}/_apis/wit/workItems/${feature.epicId.adoId}`
        }
      })
    }

    const url = `https://dev.azure.com/${conn.adoOrg}/${encodedProject}/_apis/wit/workitems/$Feature?api-version=7.0`

    console.log('[feature] Pushing to ADO:', feature.name)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json-patch+json',
        'Authorization': `Basic ${pat}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify(patchDocument)
    })

    const responseText = await response.text()

    if (responseText.includes('<!DOCTYPE')) {
      throw new Error('ADO auth failed. Check PAT token in Settings.')
    }

    if (!response.ok) {
      throw new Error(`ADO ${response.status}: ${responseText.substring(0, 200)}`)
    }

    const result = JSON.parse(responseText)
    const adoUrl = `https://dev.azure.com/${conn.adoOrg}/${encodedProject}/_workitems/edit/${result.id}`

    feature.adoId = String(result.id)
    feature.adoUrl = adoUrl
    feature.status = 'active'
    await feature.save()

    console.log('[feature] ADO Feature created:', result.id)

    res.json({
      success: true,
      feature,
      adoId: result.id,
      adoUrl,
      message: `Feature pushed to ADO as #${result.id}`
    })
  } catch (error) {
    console.error('[feature] ADO push error:', error.message)
    res.status(500).json({ success: false, message: error.message })
  }
}

// ==================== HIERARCHY VIEW ====================

export const getHierarchy = async (req, res) => {
  try {
    const orgId = req.user.organisationId

    const epics = await Epic.find({ organisationId: orgId })
      .sort({ createdAt: 1 })

    const result = await Promise.all(
      epics.map(async (epic) => {
        const features = await Feature.find({ epicId: epic._id })
          .sort({ createdAt: 1 })

        const featuresWithStories = await Promise.all(
          features.map(async (feature) => {
            const stories = await Story.find({ featureId: feature._id })
              .sort({ createdAt: 1 })

            return {
              ...feature.toObject(),
              stories: stories.map(s => ({
                _id: s._id,
                storyTitle: s.storyTitle || s.title,
                status: s.status,
                priority: s.priority,
                sprint: s.sprint,
                assignee: s.assignee,
                assigneeName: s.assigneeName,
                adoId: s.adoId,
                adoUrl: s.adoUrl,
                type: s.type
              }))
            }
          })
        )

        const unlinkedStories = await Story.find({
          epicId: epic._id,
          featureId: null
        }).sort({ createdAt: 1 })

        return {
          ...epic.toObject(),
          features: featuresWithStories,
          unlinkedStories: unlinkedStories.map(s => ({
            _id: s._id,
            storyTitle: s.storyTitle || s.title,
            status: s.status,
            priority: s.priority,
            sprint: s.sprint,
            assignee: s.assignee,
            assigneeName: s.assigneeName,
            adoId: s.adoId,
            adoUrl: s.adoUrl,
            type: s.type
          }))
        }
      })
    )

    res.json({ success: true, hierarchy: result })
  } catch (error) {
    console.error('[hierarchy] Error:', error.message)
    res.status(500).json({ success: false, message: error.message })
  }
}
