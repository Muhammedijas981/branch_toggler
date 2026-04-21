/**
 * Slack and Discord webhook notification helpers.
 * All functions are fire-and-forget — errors are logged but never thrown.
 */

async function post(url, payload) {
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error('[Notification send failed]', err.message);
  }
}

export const sendSlackNotification = (url, payload) => post(url, payload);
export const sendDiscordNotification = (url, payload) => post(url, payload);

// ── Payload builders ─────────────────────────────────────────────────────────

export function buildSwitchNotification({ projectName, fromBranch, toBranch, userEmail, status, error }) {
  const ok = status === 'success';
  const emoji = ok ? '✅' : '❌';
  const color = ok ? '#10b981' : '#ef4444';
  const colorInt = ok ? 0x10b981 : 0xef4444;
  const title = `${emoji} ${ok ? 'Branch switched' : 'Branch switch failed'}: ${projectName}`;
  const body = ok
    ? `*${userEmail}* switched \`${fromBranch}\` → \`${toBranch}\``
    : `*${userEmail}* failed to switch \`${fromBranch}\` → \`${toBranch}\`\nError: ${error}`;

  return {
    slack: {
      attachments: [{ color, title, text: body, footer: 'Branch Toggler', ts: Math.floor(Date.now() / 1000) }],
    },
    discord: {
      embeds: [{
        title,
        description: body.replace(/\*/g, '**'),
        color: colorInt,
        timestamp: new Date().toISOString(),
        footer: { text: 'Branch Toggler' },
      }],
    },
  };
}

export function buildScheduleNotification({ projectName, branch, scheduledAt, userEmail, executed }) {
  const emoji = executed ? '⏰' : '📅';
  const title = executed
    ? `${emoji} Scheduled switch executed: ${projectName}`
    : `${emoji} Branch switch scheduled: ${projectName}`;
  const body = executed
    ? `Scheduled switch to \`${branch}\` has been executed.`
    : `*${userEmail}* scheduled a switch to \`${branch}\` at ${new Date(scheduledAt).toUTCString()}.`;

  return {
    slack: { text: `*${title}*\n${body}`, username: 'Branch Toggler' },
    discord: {
      embeds: [{
        title,
        description: body.replace(/\*/g, '**'),
        color: 0x667eea,
        timestamp: new Date().toISOString(),
        footer: { text: 'Branch Toggler' },
      }],
    },
  };
}
