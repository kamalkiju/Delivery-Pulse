import Project from "../../models/Project.model.js";

const getOrgId = (req) => req.user?.orgId ?? req.user?.organisationId;

export const getProjects = async (req, res) => {
  try {
    const projects = await Project.find({
      organisationId: getOrgId(req),
      status: "active",
    }).sort({ createdAt: -1 });
    res.json({ success: true, projects });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createProject = async (req, res) => {
  try {
    const project = await Project.create({
      ...req.body,
      organisationId: getOrgId(req),
      createdBy: req.user?.userId ?? req.user?.id,
    });
    res.status(201).json({ success: true, project });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateProject = async (req, res) => {
  try {
    const project = await Project.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, project });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteProject = async (req, res) => {
  try {
    await Project.findByIdAndUpdate(req.params.id, { status: "archived" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
