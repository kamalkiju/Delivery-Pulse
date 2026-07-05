import Sprint from '../../models/Sprint.model.js'
import Story from '../../models/Story.model.js'
import Feature from '../../models/Feature.model.js'

const getOrgId = (req) =>
  req.user?.organisationId ?? req.user?.orgId ?? req.user?.organization ?? req.user?.org

export const getSprints = async (req, res) => {
  try {
    const organisationId = getOrgId(req)
    const sprints = await Sprint.find({ organisationId })
      .sort({ order: 1, createdAt: 1 })

    const sprintsWithCounts = await Promise.all(
      sprints.map(async (sprint) => {
        const storyCount = await Story.countDocuments({
          organisationId,
          sprint: sprint.name
        })
        const featureCount = await Feature.countDocuments({
          organisationId,
          sprint: sprint.name
        })
        return {
          ...sprint.toObject(),
          storyCount,
          featureCount
        }
      })
    )

    res.json({ success: true, sprints: sprintsWithCounts })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const createSprint = async (req, res) => {
  try {
    const organisationId = getOrgId(req)
    const { name, startDate, endDate, goal, order } = req.body

    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Sprint name is required'
      })
    }

    const existing = await Sprint.findOne({
      organisationId,
      name: name.trim()
    })

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Sprint with this name already exists'
      })
    }

    const sprintCount = await Sprint.countDocuments({ organisationId })

    const sprint = await Sprint.create({
      organisationId,
      name: name.trim(),
      displayName: name.trim(),
      startDate: startDate || null,
      endDate: endDate || null,
      goal: goal || '',
      order: order || sprintCount + 1,
      status: 'planning',
      createdBy: req.user?.userId ?? req.user?.id
    })

    console.log('[sprint] Created:', sprint.name)
    res.status(201).json({ success: true, sprint })
  } catch (error) {
    console.error('[sprint] Create error:', error.message)
    res.status(500).json({ success: false, message: error.message })
  }
}

export const updateSprint = async (req, res) => {
  try {
    const organisationId = getOrgId(req)
    const { name, startDate, endDate, goal, status, order } = req.body

    const sprint = await Sprint.findOneAndUpdate(
      { _id: req.params.id, organisationId },
      {
        ...(name && { name, displayName: name }),
        ...(startDate !== undefined && { startDate }),
        ...(endDate !== undefined && { endDate }),
        ...(goal !== undefined && { goal }),
        ...(status && { status }),
        ...(order !== undefined && { order }),
        updatedAt: new Date()
      },
      { new: true }
    )

    if (!sprint) {
      return res.status(404).json({
        success: false,
        message: 'Sprint not found'
      })
    }

    res.json({ success: true, sprint })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const deleteSprint = async (req, res) => {
  try {
    const organisationId = getOrgId(req)
    const sprint = await Sprint.findOne({
      _id: req.params.id,
      organisationId
    })

    if (!sprint) {
      return res.status(404).json({
        success: false,
        message: 'Sprint not found'
      })
    }

    const storyCount = await Story.countDocuments({
      organisationId,
      sprint: sprint.name
    })

    if (storyCount > 0) {
      await Story.updateMany(
        { organisationId, sprint: sprint.name },
        { sprint: 'Backlog' }
      )
      console.log('[sprint] Moved', storyCount, 'stories to Backlog')
    }

    await Sprint.findByIdAndDelete(req.params.id)
    res.json({
      success: true,
      message: `Sprint deleted. ${storyCount} stories moved to Backlog.`
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const assignStoryToSprint = async (req, res) => {
  try {
    const organisationId = getOrgId(req)
    const { storyId, sprintName } = req.body

    const story = await Story.findOneAndUpdate(
      { _id: storyId, organisationId },
      { sprint: sprintName },
      { new: true }
    )

    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Story not found'
      })
    }

    console.log('[sprint] Assigned story:', story.storyTitle, '→', sprintName)

    res.json({
      success: true,
      story,
      message: `Story assigned to ${sprintName}`
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const assignFeatureToSprint = async (req, res) => {
  try {
    const organisationId = getOrgId(req)
    const { featureId, sprintName } = req.body

    const feature = await Feature.findOneAndUpdate(
      { _id: featureId, organisationId },
      { sprint: sprintName },
      { new: true }
    )

    if (!feature) {
      return res.status(404).json({
        success: false,
        message: 'Feature not found'
      })
    }

    await Story.updateMany(
      { organisationId, featureId },
      { sprint: sprintName }
    )

    console.log('[sprint] Assigned feature:', feature.name, '→', sprintName)

    res.json({
      success: true,
      feature,
      message: `Feature and all its stories assigned to ${sprintName}`
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const getSprintBoard = async (req, res) => {
  try {
    const orgId = getOrgId(req)

    const sprints = await Sprint.find({ organisationId: orgId })
      .sort({ order: 1 })

    const sprintBoard = await Promise.all(
      sprints.map(async (sprint) => {
        const features = await Feature.find({
          organisationId: orgId,
          sprint: sprint.name
        }).populate('epicId', 'name')

        const featuresWithStories = await Promise.all(
          features.map(async (feature) => {
            const stories = await Story.find({
              organisationId: orgId,
              featureId: feature._id
            }).sort({ createdAt: 1 })

            return {
              ...feature.toObject(),
              epicName: feature.epicId?.name || 'No Epic',
              stories: stories.map((s) => ({
                _id: s._id,
                storyTitle: s.storyTitle || s.title,
                status: s.status,
                priority: s.priority,
                assignee: s.assignee,
                assigneeName: s.assigneeName,
                adoId: s.adoId,
                type: s.type
              }))
            }
          })
        )

        const unassignedStories = await Story.find({
          organisationId: orgId,
          sprint: sprint.name,
          featureId: null
        })

        return {
          ...sprint.toObject(),
          features: featuresWithStories,
          unassignedStories
        }
      })
    )

    const backlogFeatures = await Feature.find({
      organisationId: orgId,
      sprint: 'Backlog'
    }).populate('epicId', 'name')

    const backlogFeaturesWithStories = await Promise.all(
      backlogFeatures.map(async (feature) => {
        const stories = await Story.find({
          organisationId: orgId,
          featureId: feature._id,
          sprint: 'Backlog'
        })
        return {
          ...feature.toObject(),
          epicName: feature.epicId?.name || 'No Epic',
          stories: stories.map((s) => ({
            _id: s._id,
            storyTitle: s.storyTitle || s.title,
            status: s.status,
            priority: s.priority,
            assignee: s.assignee,
            assigneeName: s.assigneeName,
            adoId: s.adoId,
            type: s.type
          }))
        }
      })
    )

    res.json({
      success: true,
      sprintBoard,
      backlog: {
        name: 'Backlog',
        features: backlogFeaturesWithStories
      }
    })
  } catch (error) {
    console.error('[sprint-board] Error:', error.message)
    res.status(500).json({ success: false, message: error.message })
  }
}
