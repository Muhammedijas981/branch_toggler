import Head from 'next/head';
import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import styles from '../styles/Dashboard.module.css';

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Redirect to login if unauthenticated
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  // ── Project selection state ────────────────────────────
  const [projects, setProjects]           = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projectError, setProjectError]   = useState('');

  // ── Branch state ───────────────────────────────────────
  const [branchData, setBranchData]       = useState({ currentProductionBranch: '', branches: [] });
  const [selectedBranch, setSelectedBranch] = useState('');
  const [loadingBranches, setLoadingBranches] = useState(false);

  // ── Action state ───────────────────────────────────────
  const [switching, setSwitching]         = useState(false);
  const [message, setMessage]             = useState({ type: '', text: '' });

  // ── Activity / stats ───────────────────────────────────
  const [recentActivity, setRecentActivity] = useState([]);
  const [stats, setStats]                 = useState({ total: 0, success: 0 });

  // Fetch projects on mount
  useEffect(() => {
    if (status !== 'authenticated') return;
    (async () => {
      try {
        const res = await fetch('/api/vercel?action=getProjects');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setProjects(data.projects || []);
      } catch (e) {
        setProjectError(e.message);
      } finally {
        setLoadingProjects(false);
      }
    })();
  }, [status]);

  // Fetch recent activity
  useEffect(() => {
    if (status !== 'authenticated') return;
    (async () => {
      const res = await fetch('/api/audit?limit=5');
      if (!res.ok) return;
      const data = await res.json();
      setRecentActivity(data.logs || []);
      const total = data.total || 0;
      const success = (data.logs || []).filter((l) => l.status === 'success').length;
      setStats({ total, success });
    })();
  }, [status, switching]);

  // Fetch branches when project changes
  const fetchBranches = useCallback(async (projectId) => {
    if (!projectId) { setBranchData({ currentProductionBranch: '', branches: [] }); return; }
    setLoadingBranches(true);
    setMessage({ type: '', text: '' });
    try {
      const project = projects.find((p) => p.id === projectId);
      const teamQuery = project?.teamId ? `&teamId=${project.teamId}` : '';
      const res = await fetch(`/api/vercel?action=getBranches&projectId=${projectId}${teamQuery}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBranchData(data);
      setSelectedBranch(data.currentProductionBranch || '');
    } catch (e) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setLoadingBranches(false);
    }
  }, [projects]);

  useEffect(() => { fetchBranches(selectedProject); }, [selectedProject, fetchBranches]);

  const handleSwitchBranch = async () => {
    setSwitching(true);
    setMessage({ type: 'info', text: `Switching production to "${selectedBranch}"…` });
    try {
      const project = projects.find((p) => p.id === selectedProject);
      const res = await fetch('/api/vercel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProject,
          newBranch: selectedBranch,
          projectName: project?.name,
          teamId: project?.teamId,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setMessage({ type: 'success', text: result.message });
      setTimeout(() => fetchBranches(selectedProject), 2000);
    } catch (e) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setSwitching(false);
    }
  };

  if (status === 'loading' || status === 'unauthenticated') return null;

  const isSameAsProduction = selectedBranch === branchData.currentProductionBranch;
  const hasBranches = branchData.branches.length > 0;

  return (
    <Layout>
      <Head>
        <title>Dashboard — Branch Toggler</title>
        <meta name="description" content="Switch your Vercel production branch." />
      </Head>

      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Select a project and flip its production branch instantly.</p>
      </div>

      <div className={styles.grid}>
        {/* ── Switcher card ───────────────────────────────── */}
        <div className={`card ${styles.switcherCard}`}>
          <div className={styles.cardLabel}>Branch Switcher</div>

          {projectError && (
            <div className={`${styles.status} ${styles.error}`}>⚠️ {projectError}</div>
          )}

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="projectSelect">Project</label>
            <select
              id="projectSelect"
              className="select"
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              disabled={loadingProjects}
            >
              <option value="">
                {loadingProjects ? 'Loading projects…' : 'Choose a project…'}
              </option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {selectedProject && (
            <>
              {loadingBranches ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)', fontSize: 13 }}>
                  <span className="spinner" style={{ marginRight: 8 }} />Loading branches…
                </div>
              ) : hasBranches ? (
                <>
                  <div className={styles.currentBranch}>
                    <strong>Production:</strong>
                    <span className={styles.branchName}>{branchData.currentProductionBranch}</span>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="branchSelect">Switch to Branch</label>
                    <select
                      id="branchSelect"
                      className="select"
                      value={selectedBranch}
                      onChange={(e) => setSelectedBranch(e.target.value)}
                      disabled={switching}
                    >
                      {branchData.branches.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    className={`btn btn-primary ${styles.switchBtn}`}
                    onClick={handleSwitchBranch}
                    disabled={switching || !selectedBranch || isSameAsProduction}
                  >
                    {switching ? (
                      <><span className="spinner" /> Switching…</>
                    ) : isSameAsProduction ? (
                      '✓ Already on this branch'
                    ) : (
                      `⚡ Switch to "${selectedBranch}"`
                    )}
                  </button>
                </>
              ) : (
                <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                  No recent deployments found for this project.
                </p>
              )}

              {message.text && (
                <div className={`${styles.status} ${styles[message.type]}`}>
                  {message.text}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Recent activity ────────────────────────────── */}
        <div className={`card ${styles.activityCard}`}>
          <div className={styles.cardLabel}>Recent Activity</div>
          {recentActivity.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">📋</div>
              <p>No switches yet. Your history will appear here.</p>
            </div>
          ) : (
            <div className={styles.activityList}>
              {recentActivity.map((log) => (
                <div key={log.id} className={styles.activityItem}>
                  <span>{log.status === 'success' ? '✅' : '❌'}</span>
                  <div className={styles.activityMeta}>
                    <div className={styles.activityProject}>{log.project_name}</div>
                    <div className={styles.activityBranches}>
                      <span className={styles.branchTag}>{log.from_branch}</span>
                      →
                      <span className={styles.branchTag}>{log.to_branch}</span>
                    </div>
                  </div>
                  <span className={styles.activityTime}>{timeAgo(log.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Stats ──────────────────────────────────────── */}
        <div className={`card ${styles.statsCard}`}>
          <div className={styles.cardLabel}>Your Stats</div>
          <div className={styles.stats}>
            <div className={styles.stat}>
              <div className={styles.statNum}>{stats.total}</div>
              <div className={styles.statLabel}>Total Switches</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statNum}>{projects.length}</div>
              <div className={styles.statLabel}>Projects</div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
