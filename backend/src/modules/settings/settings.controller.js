export const saveTeamsWebhook = async (req, res) => {
  try {
    const { webhookUrl } = req.body;
    process.env.TEAMS_WEBHOOK_URL = webhookUrl || "";
    console.log("[settings] Teams webhook updated");
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getTeamsWebhook = async (req, res) => {
  const url = process.env.TEAMS_WEBHOOK_URL || "";
  res.json({
    success: true,
    configured: Boolean(url),
    webhookUrl: url ? `${url.substring(0, 40)}...` : "",
  });
};
