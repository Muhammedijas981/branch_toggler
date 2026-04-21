import { getServerSession } from 'next-auth';
import { authOptions } from '../../lib/auth';
import { getSupabase } from '../../lib/supabase';
import { rateLimit } from '../../lib/rate-limit';

export default async function handler(req, res) {
  const limit = rateLimit(req, { name: 'audit', max: 30, windowMs: 60_000 });
  if (!limit.success) return res.status(429).json({ error: 'Too many requests.' });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized. Please sign in.' });

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { page = '1', limit: pageLimit = '20', projectId, status, teamId } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(50, Math.max(1, parseInt(pageLimit, 10)));
  const offset = (pageNum - 1) * limitNum;

  const supabase = getSupabase();
  
  // 1. Build the primary query for logs
  let query = supabase
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limitNum - 1);

  // 2. Build a summary query for stats (total success count)
  let statsQuery = supabase
    .from('audit_logs')
    .select('status', { count: 'exact' })
    .eq('status', 'success');

  // Optional: In the future, filter by session.user.email if private mode is enabled
  // For now, we show team-wide activity for better collaboration
  
  if (projectId) {
    query = query.eq('project_id', projectId);
    statsQuery = statsQuery.eq('project_id', projectId);
  }
  if (status) query = query.eq('status', status);
  if (teamId) {
    query = query.eq('team_id', teamId);
    statsQuery = statsQuery.eq('team_id', teamId);
  }

  const [{ data, error, count }, { count: totalSuccess }] = await Promise.all([
    query,
    statsQuery
  ]);

  if (error) {
    console.error('[AUDIT GET ERROR]', error.message);
    return res.status(500).json({ error: 'Failed to fetch audit logs.' });
  }

  return res.status(200).json({ 
    logs: data, 
    total: count, 
    totalSuccess: totalSuccess || 0,
    page: pageNum, 
    limit: limitNum 
  });
}
