import { getServerSession } from 'next-auth';
import { authOptions } from '../../lib/auth';
import { getSupabase } from '../../lib/supabase';
import { rateLimit } from '../../lib/rate-limit';
import { validateProjectId, validateBranchName, validateScheduledAt } from '../../lib/validators';
import { encrypt } from '../../lib/encrypt';
import {
  buildScheduleNotification,
  sendSlackNotification,
  sendDiscordNotification,
} from '../../lib/notifications';

export default async function handler(req, res) {
  const limit = rateLimit(req, { name: 'schedule', max: 20, windowMs: 60_000 });
  if (!limit.success) return res.status(429).json({ error: 'Too many requests.' });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.accessToken) return res.status(401).json({ error: 'Unauthorized. Please sign in.' });

  const supabase = getSupabase();
  const userEmail = session.user.email;

  // ── GET: list scheduled switches ──────────────────────────────────────────
  if (req.method === 'GET') {
    const { status } = req.query;
    let query = supabase
      .from('scheduled_switches')
      .select('id, project_id, project_name, target_branch, scheduled_at, status, executed_at, error_message, created_at')
      .eq('user_email', userEmail)
      .order('scheduled_at', { ascending: true });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: 'Failed to fetch schedules.' });
    return res.status(200).json({ schedules: data });
  }

  // ── POST: create a new scheduled switch ───────────────────────────────────
  if (req.method === 'POST') {
    const { projectId, projectName, targetBranch, scheduledAt } = req.body;

    if (!validateProjectId(projectId)) return res.status(400).json({ error: 'Invalid project ID.' });
    if (!validateBranchName(targetBranch)) return res.status(400).json({ error: 'Invalid branch name.' });
    if (!validateScheduledAt(scheduledAt)) return res.status(400).json({ error: 'Scheduled time must be in the future.' });
    if (!projectName || typeof projectName !== 'string') return res.status(400).json({ error: 'Missing project name.' });

    // Encrypt the user's current OAuth token so the cron job can act on their behalf
    const encryptedToken = encrypt(session.accessToken);

    const { data, error } = await supabase
      .from('scheduled_switches')
      .insert({
        user_email: userEmail,
        project_id: projectId,
        project_name: projectName,
        target_branch: targetBranch,
        scheduled_at: scheduledAt,
        status: 'pending',
        encrypted_token: encryptedToken,
      })
      .select('id, project_id, project_name, target_branch, scheduled_at, status, created_at')
      .single();

    if (error) return res.status(500).json({ error: 'Failed to create schedule.' });

    // Notify user
    const { data: settings } = await supabase
      .from('notification_settings')
      .select('*')
      .eq('user_email', userEmail)
      .single();

    if (settings?.notify_on_schedule) {
      const notif = buildScheduleNotification({
        projectName, branch: targetBranch, scheduledAt, userEmail, executed: false,
      });
      await Promise.all([
        sendSlackNotification(settings.slack_webhook_url, notif.slack),
        sendDiscordNotification(settings.discord_webhook_url, notif.discord),
      ]);
    }

    return res.status(201).json({ schedule: data });
  }

  // ── DELETE: cancel a pending scheduled switch ─────────────────────────────
  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing schedule ID.' });

    const { error } = await supabase
      .from('scheduled_switches')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .eq('user_email', userEmail) // scoped to this user
      .eq('status', 'pending'); // can only cancel pending ones

    if (error) return res.status(500).json({ error: 'Failed to cancel schedule.' });
    return res.status(200).json({ success: true });
  }

  res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}
