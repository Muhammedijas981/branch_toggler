/**
 * Vercel Cron Job endpoint — runs every minute (configured in vercel.json).
 * Finds all pending scheduled switches that are due and executes them.
 *
 * Security: only callable with the correct CRON_SECRET in the Authorization header.
 * Vercel automatically injects this header when calling cron jobs.
 */
import { getSupabase } from '../../../lib/supabase';
import { switchProductionBranch } from '../../../lib/vercel-api';
import { decrypt } from '../../../lib/encrypt';
import {
  buildSwitchNotification,
  buildScheduleNotification,
  sendSlackNotification,
  sendDiscordNotification,
} from '../../../lib/notifications';

export default async function handler(req, res) {
  // Reject non-GET requests
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end('Method Not Allowed');
  }

  // Verify cron secret — Vercel passes this automatically in production
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabase = getSupabase();
  const now = new Date().toISOString();

  const { data: dueSchedules, error } = await supabase
    .from('scheduled_switches')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_at', now);

  if (error) {
    console.error('[CRON] Failed to fetch schedules:', error.message);
    return res.status(500).json({ error: 'Failed to query scheduled switches.' });
  }

  if (!dueSchedules?.length) {
    return res.status(200).json({ executed: 0, message: 'No due schedules.' });
  }

  const results = [];

  for (const schedule of dueSchedules) {
    let status = 'executed';
    let errorMsg = null;

    try {
      // Use the global VERCEL_TOKEN (previously used decrypted OAuth tokens)
      const accessToken = process.env.VERCEL_TOKEN;

      // Execute the branch switch
      await switchProductionBranch(
        schedule.project_id,
        schedule.target_branch,
        accessToken,
        schedule.team_id
      );

      // Log to audit_logs
      await supabase.from('audit_logs').insert({
        user_email: schedule.user_email,
        user_name: 'Scheduled Switch (Cron)',
        project_id: schedule.project_id,
        project_name: schedule.project_name,
        from_branch: 'auto-detected',
        to_branch: schedule.target_branch,
        status: 'success',
      });

      // Send "executed" notification
      const { data: notifSettings } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('user_email', schedule.user_email)
        .single();

      if (notifSettings?.notify_on_schedule) {
        const notif = buildScheduleNotification({
          projectName: schedule.project_name,
          branch: schedule.target_branch,
          scheduledAt: schedule.scheduled_at,
          userEmail: schedule.user_email,
          executed: true,
        });
        await Promise.all([
          sendSlackNotification(notifSettings.slack_webhook_url, notif.slack),
          sendDiscordNotification(notifSettings.discord_webhook_url, notif.discord),
        ]);
      }
    } catch (err) {
      console.error(`[CRON] Failed to execute schedule ${schedule.id}:`, err.message);
      status = 'failed';
      errorMsg = err.message;

      // Notify on failure
      const { data: notifSettings } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('user_email', schedule.user_email)
        .single();

      if (notifSettings?.notify_on_failure) {
        const notif = buildSwitchNotification({
          projectName: schedule.project_name,
          fromBranch: 'unknown',
          toBranch: schedule.target_branch,
          userEmail: schedule.user_email,
          status: 'failed',
          error: err.message,
        });
        await Promise.all([
          sendSlackNotification(notifSettings.slack_webhook_url, notif.slack),
          sendDiscordNotification(notifSettings.discord_webhook_url, notif.discord),
        ]);
      }
    }

    // Update schedule status
    await supabase
      .from('scheduled_switches')
      .update({ status, executed_at: now, error_message: errorMsg })
      .eq('id', schedule.id);

    results.push({ id: schedule.id, status });
  }

  return res.status(200).json({ executed: results.length, results });
}
