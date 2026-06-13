import { Buffer } from "node:buffer";
import AdoConnection from "../../models/AdoConnection.model.js";

const getOrgId = (req) => req.user?.orgId ?? req.user?.organisationId;

export const getAdoConnections = async (req, res) => {
  try {
    const organisationId = getOrgId(req);
    const connections = await AdoConnection.find({
      organisationId,
      isActive: true,
    }).sort({ createdAt: -1 });

    const safeConnections = connections.map((c) => ({
      _id: c._id,
      name: c.name,
      adoOrg: c.adoOrg,
      adoProject: c.adoProject,
      patTokenPreview: c.patToken
        ? `${c.patToken.substring(0, 8)}...`
        : null,
      isDefault: c.isDefault,
      connectionStatus: c.connectionStatus,
      lastTestedAt: c.lastTestedAt,
      workItemTypes: c.workItemTypes,
      createdAt: c.createdAt,
    }));

    res.json({ success: true, connections: safeConnections });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const addAdoConnection = async (req, res) => {
  try {
    const organisationId = getOrgId(req);
    const { name, adoOrg, adoProject, patToken } = req.body;

    if (!name || !adoOrg || !adoProject || !patToken) {
      return res.status(400).json({
        success: false,
        message: "Name, ADO Org, ADO Project and PAT Token are required",
      });
    }

    console.log("[ado-conn] Testing connection before saving...");

    const pat = Buffer.from(`:${patToken}`).toString("base64");
    const encodedProject = encodeURIComponent(adoProject);
    const testUrl = `https://dev.azure.com/${adoOrg}/${encodedProject}/_apis/wit/workitemtypes?api-version=7.0`;

    let connectionStatus = "failed";
    let workItemTypes = [];

    try {
      const testResponse = await fetch(testUrl, {
        headers: { Authorization: `Basic ${pat}` },
      });

      if (testResponse.ok) {
        const testData = await testResponse.json();
        workItemTypes = (testData.value || []).map((t) => t.name);
        connectionStatus = "connected";
        console.log("[ado-conn] Connection successful. Types:", workItemTypes);
      } else {
        const errText = await testResponse.text();
        console.error("[ado-conn] Test failed:", testResponse.status, errText.substring(0, 200));
      }
    } catch (testError) {
      console.error("[ado-conn] Test error:", testError.message);
    }

    const existingCount = await AdoConnection.countDocuments({
      organisationId,
      isActive: true,
    });

    const connection = await AdoConnection.create({
      organisationId,
      name,
      adoOrg,
      adoProject,
      patToken,
      isDefault: existingCount === 0,
      connectionStatus,
      workItemTypes,
      lastTestedAt: new Date(),
      createdBy: req.user.userId ?? req.user.id,
    });

    if (connectionStatus === "connected" && connection.isDefault) {
      console.log("[ado-conn] Default connection saved:", connection.name);
    }

    res.status(201).json({
      success: true,
      connection: {
        _id: connection._id,
        name: connection.name,
        adoOrg: connection.adoOrg,
        adoProject: connection.adoProject,
        patTokenPreview: `${patToken.substring(0, 8)}...`,
        isDefault: connection.isDefault,
        connectionStatus: connection.connectionStatus,
        workItemTypes: connection.workItemTypes,
        lastTestedAt: connection.lastTestedAt,
      },
      message: connectionStatus === "connected"
        ? "✅ Connected successfully"
        : "⚠️ Saved but connection test failed. Check your PAT token.",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const testAdoConnection = async (req, res) => {
  try {
    const connection = await AdoConnection.findById(req.params.id);
    if (!connection) {
      return res.status(404).json({
        success: false,
        message: "Connection not found",
      });
    }

    console.log("[ado-conn] Testing:", connection.adoOrg, connection.adoProject);
    console.log("[ado-conn] Token preview:", connection.patToken?.substring(0, 8));

    const pat = Buffer.from(`:${connection.patToken}`).toString("base64");

    const testUrl = `https://dev.azure.com/${connection.adoOrg}/_apis/projects?api-version=7.0`;

    console.log("[ado-conn] Test URL:", testUrl);

    const testResponse = await fetch(testUrl, {
      method: "GET",
      headers: {
        Authorization: `Basic ${pat}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    console.log("[ado-conn] Response status:", testResponse.status);
    const responseText = await testResponse.text();
    console.log("[ado-conn] Response preview:", responseText.substring(0, 200));

    if (testResponse.ok) {
      let projects = [];
      try {
        const data = JSON.parse(responseText);
        projects = (data.value || []).map((p) => p.name);
        console.log("[ado-conn] Projects found:", projects);
      } catch (e) {
        console.error("[ado-conn] JSON parse error:", e.message);
      }

      const projectExists = projects.some((p) =>
        p.toLowerCase().trim() === connection.adoProject.toLowerCase().trim(),
      );

      console.log("[ado-conn] Looking for project:", connection.adoProject);
      console.log("[ado-conn] Available projects:", projects);
      console.log("[ado-conn] Project exists:", projectExists);

      connection.connectionStatus = "connected";
      connection.workItemTypes = ["Issue", "Task", "Epic"];
      connection.lastTestedAt = new Date();
      await connection.save();

      return res.json({
        success: true,
        connectionStatus: "connected",
        workItemTypes: ["Issue", "Task", "Epic"],
        projects,
        message: `✅ Connected successfully to ${connection.adoOrg}`,
      });
    }

    if (testResponse.status === 401) {
      connection.connectionStatus = "failed";
      connection.lastTestedAt = new Date();
      await connection.save();

      return res.json({
        success: false,
        connectionStatus: "failed",
        message: "❌ Authentication failed. PAT token is invalid or expired. Please create a new PAT token.",
      });
    }

    if (testResponse.status === 403) {
      connection.connectionStatus = "failed";
      connection.lastTestedAt = new Date();
      await connection.save();

      return res.json({
        success: false,
        connectionStatus: "failed",
        message: "❌ Access denied. PAT token does not have required permissions. Ensure Work Items Read & Write is enabled.",
      });
    }

    connection.connectionStatus = "failed";
    connection.lastTestedAt = new Date();
    await connection.save();

    return res.json({
      success: false,
      connectionStatus: "failed",
      message: `❌ Connection failed with status ${testResponse.status}`,
    });
  } catch (error) {
    console.error("[ado-conn] Test error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const deleteAdoConnection = async (req, res) => {
  try {
    const connection = await AdoConnection.findById(req.params.id);
    if (!connection) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    connection.isActive = false;
    await connection.save();

    res.json({ success: true, message: "Connection removed" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const setDefaultAdoConnection = async (req, res) => {
  try {
    const orgId = getOrgId(req);

    await AdoConnection.updateMany(
      { organisationId: orgId },
      { isDefault: false },
    );

    const connection = await AdoConnection.findByIdAndUpdate(
      req.params.id,
      { isDefault: true },
      { new: true },
    );

    if (!connection) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    console.log("[ado-conn] Default connection updated:", connection.name);

    res.json({
      success: true,
      message: `✅ ${connection.name} set as default ADO connection`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
