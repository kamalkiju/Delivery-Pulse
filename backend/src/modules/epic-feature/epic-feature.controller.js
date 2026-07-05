import Epic from '../../models/Epic.model.js'
import Feature from '../../models/Feature.model.js'
import Story from '../../models/Story.model.js'

const getOrgId = (req) =>
  req.user?.organisationId ??
  req.user?.orgId ??
  req.user?.organization ??
  req.user?.org

// ==================== EPIC CONTROLLERS ====================

export const getEpics = async (req, res) => {
  try {
    const organisationId = getOrgId(req)
    const filter = organisationId ? { organisationId } : {}

    const epics = await Epic.find(filter).sort({ createdAt: -1 })

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

    const organisationId = getOrgId(req)
    if (!organisationId) {
      return res.status(400).json({
        success: false,
        message: 'Organisation ID not found in user token'
      })
    }

    const epic = await Epic.create({
      organisationId,
      projectId: projectId || null,
      name: name.trim(),
      description: description || '',
      priority: priority || 'Medium',
      status: 'draft',
      createdBy: req.user.userId || req.user._id || req.user.id
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

    const organisationId = getOrgId(req)
    const filter = {
      ...(organisationId && { organisationId }),
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

    const organisationId = getOrgId(req)
    if (!organisationId) {
      return res.status(400).json({
        success: false,
        message: 'Organisation ID not found in user token'
      })
    }

    const feature = await Feature.create({
      organisationId,
      projectId: projectId || null,
      epicId,
      name: name.trim(),
      description: description || '',
      priority: priority || 'Medium',
      sprint: sprint || 'Backlog',
      status: 'draft',
      createdBy: req.user.userId || req.user._id || req.user.id
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
    const orgId = getOrgId(req)
    const filter = orgId ? { organisationId: orgId } : {}

    const epics = await Epic.find(filter)
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

export const autoDetectHierarchy = async (req, res) => {
  try {
    const orgId = getOrgId(req)

    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: 'Organisation ID not found in user token'
      })
    }

    console.log('[auto-detect] Starting hierarchy detection...')

    const stories = await Story.find({
      organisationId: orgId,
      featureId: null
    })

    console.log('[auto-detect] Found', stories.length, 'unlinked stories')

    const epicMap = {}
    const featureMap = {}

    for (const story of stories) {
      const title = story.storyTitle || story.title || ''

      let epicName = null
      let featureName = null
      let storyName = title

      if (title.includes('>')) {
        const parts = title.split('>').map(p => p.trim())
        if (parts.length >= 3) {
          epicName = parts[0]
          featureName = parts[1]
          storyName = parts[2]
        } else if (parts.length === 2) {
          epicName = parts[0]
          featureName = parts[1]
        }
      } else if (title.includes(':')) {
        const parts = title.split(':').map(p => p.trim())
        epicName = parts[0]
        featureName = parts[1] || null
      }

      if (!epicName) continue

      epicName = epicName.trim()

      const epicKey = epicName.toLowerCase()
      if (!epicMap[epicKey]) {
        let existingEpic = await Epic.findOne({
          organisationId: orgId,
          name: { $regex: new RegExp(`^${epicName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
        })

        if (!existingEpic) {
          existingEpic = await Epic.create({
            organisationId: orgId,
            name: epicName,
            description: `Auto-detected from stories`,
            priority: story.priority || 'Medium',
            status: 'active',
            createdBy: req.user.userId || req.user._id || req.user.id
          })
          console.log('[auto-detect] Created Epic:', epicName)
        }

        epicMap[epicKey] = existingEpic
      }

      const epic = epicMap[epicKey]

      if (featureName) {
        featureName = featureName.trim()
        const featureKey = `${epicKey}__${featureName.toLowerCase()}`

        if (!featureMap[featureKey]) {
          let existingFeature = await Feature.findOne({
            epicId: epic._id,
            name: { $regex: new RegExp(`^${featureName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
          })

          if (!existingFeature) {
            existingFeature = await Feature.create({
              organisationId: orgId,
              epicId: epic._id,
              name: featureName,
              description: `Auto-detected from stories`,
              priority: story.priority || 'Medium',
              sprint: story.sprint || 'Backlog',
              status: 'active',
              createdBy: req.user.userId || req.user._id || req.user.id
            })
            console.log('[auto-detect] Created Feature:', featureName,
              'under Epic:', epicName)
          }

          featureMap[featureKey] = existingFeature
        }

        const feature = featureMap[featureKey]

        story.epicId = epic._id
        story.epicName = epic.name
        story.featureId = feature._id
        story.featureName = feature.name
        await story.save()

        console.log('[auto-detect] Linked story:',
          (story.storyTitle || story.title)?.substring(0, 40))
      } else {
        story.epicId = epic._id
        story.epicName = epic.name
        await story.save()
      }
    }

    const epicsCreated = Object.keys(epicMap).length
    const featuresCreated = Object.keys(featureMap).length

    console.log('[auto-detect] Done. Epics:', epicsCreated,
      'Features:', featuresCreated)

    res.json({
      success: true,
      epicsDetected: epicsCreated,
      featuresDetected: featuresCreated,
      storiesProcessed: stories.length,
      message: `Detected ${epicsCreated} epics and ${featuresCreated} features from ${stories.length} stories`
    })
  } catch (error) {
    console.error('[auto-detect] Error:', error.message)
    res.status(500).json({ success: false, message: error.message })
  }
}

export const pushHierarchyToADO = async (req, res) => {
  try {
    const orgId = getOrgId(req)

    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: 'Organisation ID not found in user token'
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
    const priorityMap = { Critical: 1, High: 2, Medium: 3, Low: 4 }

    const pushToADO = async (type, title, description, priority, sprint, parentAdoId) => {
      const patchDocument = [
        {
          op: 'add',
          path: '/fields/System.Title',
          value: title
        },
        {
          op: 'add',
          path: '/fields/System.Description',
          value: description || ''
        },
        {
          op: 'add',
          path: '/fields/Microsoft.VSTS.Common.Priority',
          value: priorityMap[priority] || 3
        }
      ]

      if (sprint && sprint !== 'Backlog') {
        patchDocument.push({
          op: 'add',
          path: '/fields/System.IterationPath',
          value: `${conn.adoProject}\\${sprint}`
        })
      }

      if (parentAdoId) {
        patchDocument.push({
          op: 'add',
          path: '/relations/-',
          value: {
            rel: 'System.LinkTypes.Hierarchy-Reverse',
            url: `https://dev.azure.com/${conn.adoOrg}/_apis/wit/workItems/${parentAdoId}`
          }
        })
      }

      const url = `https://dev.azure.com/${conn.adoOrg}/${encodedProject}/_apis/wit/workitems/$${encodeURIComponent(type)}?api-version=7.0`

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
      return result.id
    }

    const results = {
      epics: { success: 0, failed: 0 },
      features: { success: 0, failed: 0 },
      stories: { success: 0, failed: 0 }
    }

    // Step 1 — Push Epics
    const epics = await Epic.find({
      organisationId: orgId,
      adoId: null
    })

    console.log('[hierarchy-push] Pushing', epics.length, 'epics to ADO')

    for (const epic of epics) {
      try {
        const adoId = await pushToADO(
          'Epic',
          epic.name,
          epic.description,
          epic.priority,
          null,
          null
        )

        epic.adoId = String(adoId)
        epic.adoUrl = `https://dev.azure.com/${conn.adoOrg}/${encodedProject}/_workitems/edit/${adoId}`
        epic.status = 'active'
        await epic.save()

        results.epics.success++
        console.log('[hierarchy-push] ✅ Epic pushed:', epic.name, '→ ADO #' + adoId)
        await new Promise(r => setTimeout(r, 300))
      } catch (err) {
        results.epics.failed++
        console.error('[hierarchy-push] ❌ Epic failed:', epic.name, err.message)
      }
    }

    // Step 2 — Push Features
    const features = await Feature.find({
      organisationId: orgId,
      adoId: null
    }).populate('epicId')

    console.log('[hierarchy-push] Pushing', features.length, 'features to ADO')

    for (const feature of features) {
      try {
        const parentAdoId = feature.epicId?.adoId || null

        const adoId = await pushToADO(
          'Feature',
          feature.name,
          feature.description,
          feature.priority,
          feature.sprint,
          parentAdoId
        )

        feature.adoId = String(adoId)
        feature.adoUrl = `https://dev.azure.com/${conn.adoOrg}/${encodedProject}/_workitems/edit/${adoId}`
        feature.status = 'active'
        await feature.save()

        results.features.success++
        console.log('[hierarchy-push] ✅ Feature pushed:', feature.name,
          '→ ADO #' + adoId)
        await new Promise(r => setTimeout(r, 300))
      } catch (err) {
        results.features.failed++
        console.error('[hierarchy-push] ❌ Feature failed:', feature.name, err.message)
      }
    }

    // Step 3 — Push Stories linked to Features
    const stories = await Story.find({
      organisationId: orgId,
      featureId: { $exists: true, $ne: null },
      adoId: null
    }).populate('featureId')

    console.log('[hierarchy-push] Pushing', stories.length, 'stories to ADO')

    for (const story of stories) {
      try {
        const parentAdoId = story.featureId?.adoId || null

        const acHtml = (story.acceptanceCriteriaFormatted ||
          story.acceptanceCriteria || [])
          .map((ac, i) => {
            const id = typeof ac === 'object'
              ? (ac.id || `AC ${i+1}`) : `AC ${i+1}`
            const scenario = typeof ac === 'string'
              ? ac : (ac.scenario || '')
            return `<div><strong>${id}:</strong> ${scenario}</div>`
          }).join('<br/>')

        let descHtml = `<div><em>${story.description || ''}</em></div>`
        if (story.businessRequirement) {
          descHtml += `<br/><div><strong>Business Requirement:</strong><br/>${story.businessRequirement}</div>`
        }
        if (story.userFlow) {
          descHtml += `<br/><div><strong>User Flow:</strong><br/>${story.userFlow}</div>`
        }
        if (acHtml) {
          descHtml += `<br/><div><strong>Acceptance Criteria:</strong><br/>${acHtml}</div>`
        }

        const patchDocument = [
          {
            op: 'add',
            path: '/fields/System.Title',
            value: story.storyTitle || story.title || 'Untitled'
          },
          {
            op: 'add',
            path: '/fields/System.Description',
            value: descHtml
          },
          {
            op: 'add',
            path: '/fields/Microsoft.VSTS.Common.Priority',
            value: { Critical: 1, High: 2, Medium: 3, Low: 4 }[story.priority] || 3
          }
        ]

        if (story.sprint && story.sprint !== 'Backlog') {
          patchDocument.push({
            op: 'add',
            path: '/fields/System.IterationPath',
            value: `${conn.adoProject}\\${story.sprint}`
          })
        }

        if (story.assignee) {
          patchDocument.push({
            op: 'add',
            path: '/fields/System.AssignedTo',
            value: story.assignee
          })
        }

        if (story.tags?.length > 0) {
          patchDocument.push({
            op: 'add',
            path: '/fields/System.Tags',
            value: story.tags.join('; ')
          })
        }

        if (parentAdoId) {
          patchDocument.push({
            op: 'add',
            path: '/relations/-',
            value: {
              rel: 'System.LinkTypes.Hierarchy-Reverse',
              url: `https://dev.azure.com/${conn.adoOrg}/_apis/wit/workItems/${parentAdoId}`
            }
          })
        }

        const url = `https://dev.azure.com/${conn.adoOrg}/${encodedProject}/_apis/wit/workitems/$Issue?api-version=7.0`

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
          throw new Error('ADO auth failed')
        }

        if (!response.ok) {
          throw new Error(`ADO ${response.status}: ${responseText.substring(0, 200)}`)
        }

        const result = JSON.parse(responseText)

        story.adoId = String(result.id)
        story.adoUrl = `https://dev.azure.com/${conn.adoOrg}/${encodedProject}/_workitems/edit/${result.id}`
        story.status = 'pushed-to-ado'
        await story.save()

        results.stories.success++
        console.log('[hierarchy-push] ✅ Story pushed:',
          (story.storyTitle || story.title)?.substring(0, 40),
          '→ ADO #' + result.id)
        await new Promise(r => setTimeout(r, 300))
      } catch (err) {
        results.stories.failed++
        console.error('[hierarchy-push] ❌ Story failed:',
          (story.storyTitle || story.title)?.substring(0, 40), err.message)
      }
    }

    console.log('[hierarchy-push] Done:', JSON.stringify(results))

    res.json({
      success: true,
      results,
      message: `Pushed: ${results.epics.success} epics, ${results.features.success} features, ${results.stories.success} stories to ADO`
    })
  } catch (error) {
    console.error('[hierarchy-push] Error:', error.message)
    res.status(500).json({ success: false, message: error.message })
  }
}
