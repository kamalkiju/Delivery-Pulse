// ─────────────────────────────────────────────────────────────────────────────
// slack.reply.js — automatic Slack replies to clients
//
// Two moments in the product flow:
//   1. sendAcknowledgement — right after a client message becomes a draft story
//      (called from slack.service.js Step 10)
//   2. sendStatusUpdate — when a BA changes story status in DeliveryPulse
//      (call from review/ADO code later — pass app.client from slack.service)
// ─────────────────────────────────────────────────────────────────────────────

/** Turn MongoDB ObjectId (or string) into a display id for client-facing copy */
function formatStoryId(storyId) {
  const id = storyId?.toString?.() ?? String(storyId);
  return id;
}

/**
 * sendAcknowledgement — instant “we got your message” reply in the Slack thread.
 *
 * WHEN CALLED: Immediately after slack.service creates a draft story from a
 * client (external) message — Step 10 of the message handler.
 *
 * WHY: The client feels heard right away; the BA does not need to type a manual
 * “thanks, we’ll look at this” every time.
 *
 * @param {{
 *   say: (msg: object) => Promise<unknown>,
 *   threadTs: string,
 *   storyId: import("mongoose").Types.ObjectId | string,
 *   clientName: string,
 * }} params
 */
export async function sendAcknowledgement({
  say,
  threadTs,
  storyId,
  clientName,
}) {
  const storyRef = formatStoryId(storyId);

  const message = `
Hi ${clientName} 👋

Thank you for reaching out. Your message has been received and logged as Story #${storyRef} in our system.

Our team is reviewing it and will update you on the progress shortly.

_Powered by DeliveryPulse_ ⚡
  `.trim();

  // thread_ts = reply under the original message (same conversation thread),
  // not a new top-level message that could be missed in a busy channel
  await say({
    text: message,
    thread_ts: threadTs,
  });
}

/**
 * Status-specific copy when the delivery team updates a story in DeliveryPulse.
 */
function statusMessage(status, storyRef) {
  const key = (status ?? "").trim().toLowerCase();

  if (key === "in progress" || key === "in-progress") {
    return `Your issue Story #${storyRef} is now being worked on by our development team.`;
  }

  if (key === "done" || key === "resolved" || key === "completed") {
    return `Great news! Story #${storyRef} has been resolved and deployed.`;
  }

  if (key === "blocked" || key === "on hold") {
    return `Story #${storyRef} is temporarily on hold. Our team is working to resolve the blocker.`;
  }

  return null;
}

/**
 * sendStatusUpdate — notify the client when story status changes.
 *
 * WHEN CALLED: After a BA approves, starts work, completes, or blocks a story
 * (e.g. from review queue or ADO sync — not wired yet; import this when ready).
 *
 * Uses chat.postMessage (not `say`) because status updates often happen outside
 * the original Bolt event — e.g. from an HTTP API when someone clicks in the UI.
 *
 * @param {{
 *   client: import("@slack/web-api").WebClient,
 *   channelId: string,
 *   threadTs: string,
 *   status: string,
 *   storyId: import("mongoose").Types.ObjectId | string,
 * }} params
 */
export async function sendStatusUpdate({
  client,
  channelId,
  threadTs,
  status,
  storyId,
}) {
  const storyRef = formatStoryId(storyId);
  const text = statusMessage(status, storyRef);

  if (!text) {
    console.warn(`[slack] Unknown status for client update: ${status}`);
    return;
  }

  await client.chat.postMessage({
    channel: channelId,
    thread_ts: threadTs,
    text,
  });
}

export default { sendAcknowledgement, sendStatusUpdate };
