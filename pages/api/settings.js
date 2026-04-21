import { getServerSession } from 'next-auth';
import { authOptions } from '../../lib/auth';
import { getSupabase } from '../../lib/supabase';
import { rateLimit } from '../../lib/rate-limit';
import { validateWebhookUrl } from '../../lib/validators';
import {
  buildSwitchNotification,
  sendSlackNotification,
  sendDiscordNotification,
} from '../../lib/notifications';

export default async function handler(req, res) {
  const limit = rateLimit(req, { name: 'settings', max: 20, windowMs: 60_000 });
  if (!limit.success) return res.status(429).json({ error: 'Too many requests.' });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized. Please sign in.' });

  const supabase = getSupabase();
  const userEmail = session.user.email;

  // ── GET: fetch current notification settings ───────────────────────────────
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('notification_settings')
      .select('*')
      .eq('user_email', userEmail)
      .single();

    if (error && error.code !== 'PGRST116') {
      return res.status(500).json({ error: 'Failed to fetch settings.' });
    }
    return res.status(200).json({ settings: data || null });
  }

  // ── PUT: upsert notification settings ─────────────────────────────────────
  if (req.method === 'PUT') {
    const { slackWebhookUrl, discordWebhookUrl, notifyOnSwitch, notifyOnSchedule, notifyOnFailure } =
      req.body;

    if (!validateWebhookUrl(slackWebhookUrl)) {
      return res.status(400).json({ error: 'Invalid Slack webhook URL. Must be HTTPS.' });
    }
    if (!validateWebhookUrl(discordWebhookUrl)) {
      return res.status(400).json({ error: 'Invalid Discord webhook URL. Must be HTTPS.' });
    }

    const { data, error } = await supabase
      .from('notification_settings')
      .upsert(
        {
          user_email: userEmail,
          slack_webhook_url: slackWebhookUrl || null,
          discord_webhook_url: discordWebhookUrl || null,
          notify_on_switch: notifyOnSwitch !== false,
          notify_on_schedule: notifyOnSchedule !== false,
          notify_on_failure: notifyOnFailure !== false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_email' }
      )
      .select()
      .single();

    if (error) return res.status(500).json({ error: 'Failed to save settings.' });
    return res.status(200).json({ settings: data });
  }

  // ── POST: send a test notification ────────────────────────────────────────
  if (req.method === 'POST') {
    const { slackWebhookUrl, discordWebhookUrl } = req.body;

    if (!slackWebhookUrl && !discordWebhookUrl) {
      return res.status(400).json({ error: 'Provide at least one webhook URL to test.' });
    }

    const testNotif = buildSwitchNotification({
      projectName: 'my-project',
      fromBranch: 'staging',
      toBranch: 'main',
      userEmail: session.user.email,
      status: 'success',
    });

    await Promise.all([
      sendSlackNotification(slackWebhookUrl, testNotif.slack),
      sendDiscordNotification(discordWebhookUrl, testNotif.discord),
    ]);

    return res.status(200).json({ success: true, message: 'Test notifications sent.' });
  }

  res.setHeader('Allow', ['GET', 'PUT', 'POST']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}
