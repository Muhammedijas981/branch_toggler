import { getServerSession } from 'next-auth';
import { authOptions } from '../../lib/auth';
import { getProjects, getBranches, switchProductionBranch } from '../../lib/vercel-api';
import { validateProjectId, validateBranchName } from '../../lib/validators';
import { rateLimit } from '../../lib/rate-limit';
import { getSupabase } from '../../lib/supabase';
import {
  buildSwitchNotification,
  sendSlackNotification,
  sendDiscordNotification,
} from '../../lib/notifications';

export default async function handler(req, res) {
  // ── Rate limiting ──────────────────────────────────────────────────────────
  const limit = rateLimit(req, { name: 'vercel', max: 30, windowMs: 60_000 });
  if (!limit.success) {
    return res.status(429).json({ error: 'Too many requests. Please slow down.' });
  }

  // ── Authentication (Check identity, but use service token for API) ─────────
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized. Please sign in.' });
  }

  const token = process.env.VERCEL_TOKEN; // Use service token
  if (!token) {
    return res.status(500).json({ error: 'Server configuration error: VERCEL_TOKEN is missing.' });
  }

  const userEmail = session.user.email;
  const userName = session.user.name;

  try {
    // ── GET: list projects or branches ───────────────────────────────────────
    if (req.method === 'GET') {
      const { action, projectId } = req.query;

      if (action === 'getProjects') {
        const projects = await getProjects(token);
        return res.status(200).json({ projects });
      }

      if (action === 'getBranches') {
        const { teamId } = req.query;
        if (!validateProjectId(projectId)) {
          return res.status(400).json({ error: 'Invalid project ID format.' });
        }
        const data = await getBranches(projectId, token, teamId);
        return res.status(200).json(data);
      }

      return res.status(400).json({ error: 'Invalid action or missing parameters.' });
    }

    // ── POST: switch the production branch ───────────────────────────────────
    if (req.method === 'POST') {
      const { projectId, newBranch, projectName, teamId } = req.body;

      if (!validateProjectId(projectId)) {
        return res.status(400).json({ error: 'Invalid project ID format.' });
      }
      if (!validateBranchName(newBranch)) {
        return res.status(400).json({ error: 'Invalid branch name format.' });
      }

      const supabase = getSupabase();
      let result;

      try {
        result = await switchProductionBranch(projectId, newBranch, token, teamId);
      } catch (switchError) {
        // Log the failed attempt
        await supabase.from('audit_logs').insert({
          user_email: userEmail,
          user_name: userName,
          project_id: projectId,
          project_name: projectName || projectId,
          team_id: teamId, // Store team context
          from_branch: switchError.fromBranch || 'unknown',
          to_branch: newBranch,
          status: 'failed',
          error_message: switchError.message,
        });
        throw switchError;
      }

      // Log the successful switch
      await supabase.from('audit_logs').insert({
        user_email: userEmail,
        user_name: userName,
        project_id: projectId,
        project_name: projectName || projectId,
        team_id: teamId, // Store team context
        from_branch: result.fromBranch,
        to_branch: newBranch,
        status: 'success',
      });

      // Fire notifications (non-blocking)
      const { data: settings } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('user_email', userEmail)
        .single();

      if (settings?.notify_on_switch) {
        const notif = buildSwitchNotification({
          projectName: projectName || projectId,
          fromBranch: result.fromBranch,
          toBranch: newBranch,
          userEmail,
          status: 'success',
        });
        await Promise.all([
          sendSlackNotification(settings.slack_webhook_url, notif.slack),
          sendDiscordNotification(settings.discord_webhook_url, notif.discord),
        ]);
      }

      return res.status(200).json({
        success: true,
        message: `Successfully switched production to branch: ${newBranch}`,
        fromBranch: result.fromBranch,
      });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error) {
    console.error('[VERCEL API ERROR]', error.message);
    const isClientError = error.status >= 400 && error.status < 500;
    res.status(error.status || 500).json({
      error: isClientError ? error.message : 'An internal error occurred. Please try again.',
    });
  }
}
