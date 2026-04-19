import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import styles from '../styles/Schedule.module.css';

function formatDateTime(dateStr) {
  return new Date(dateStr).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const STATUS_TABS = ['pending', 'executed', 'failed', 'cancelled'];
const STATUS_ICONS = { pending: '⏳', executed: '✅', failed: '❌', cancelled: '🚫' };

export default function SchedulePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  useEffect(() => { if (status === 'unauthenticated') router.replace('/login'); }, [status, router]);

  // ── Projects (for the form dropdown) ──────────────
  const [projects, setProjects]       = useState([]);
  const [branchMap, setBranchMap]     = useState({});
  const [branchLoading, setBranchLoading] = useState(false);

  // ── Form state ─────────────────────────────────────
  const [formProject, setFormProject] = useState('');
  const [formBranch, setFormBranch]   = useState('');
  const [formTime, setFormTime]       = useState('');
  const [creating, setCreating]       = useState(false);
  const [formMsg, setFormMsg]         = useState({ type: '', text: '' });

  // ── Schedule list state ────────────────────────────
  const [schedules, setSchedules]     = useState([]);
  const [activeTab, setActiveTab]     = useState('pending');
  const [listLoading, setListLoading] = useState(true);

  // Load projects
  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/vercel?action=getProjects')
      .then((r) => r.json())
      .then((d) => setProjects(d.projects || []));
  }, [status]);

  // Load branches when project changes in form
  useEffect(() => {
    if (!formProject) return;
    if (branchMap[formProject]) { setFormBranch(branchMap[formProject][0] || ''); return; }
    setBranchLoading(true);
    fetch(`/api/vercel?action=getBranches&projectId=${formProject}`)
      .then((r) => r.json())
      .then((d) => {
        const branches = d.branches || [];
        setBranchMap((prev) => ({ ...prev, [formProject]: branches }));
        setFormBranch(branches[0] || '');
      })
      .finally(() => setBranchLoading(false));
  }, [formProject]);

  // Load schedules by tab
  const loadSchedules = () => {
    setListLoading(true);
    fetch(`/api/schedule?status=${activeTab}`)
      .then((r) => r.json())
      .then((d) => setSchedules(d.schedules || []))
      .finally(() => setListLoading(false));
  };

  useEffect(() => { if (status === 'authenticated') loadSchedules(); }, [status, activeTab]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formProject || !formBranch || !formTime) {
      setFormMsg({ type: 'error', text: 'Please fill in all fields.' }); return;
    }
    setCreating(true);
    setFormMsg({ type: '', text: '' });
    const project = projects.find((p) => p.id === formProject);
    const res = await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: formProject,
        projectName: project?.name || formProject,
        targetBranch: formBranch,
        scheduledAt: new Date(formTime).toISOString(),
      }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) {
      setFormMsg({ type: 'error', text: data.error });
    } else {
      setFormMsg({ type: 'success', text: 'Schedule created successfully!' });
      setFormProject(''); setFormBranch(''); setFormTime('');
      if (activeTab === 'pending') loadSchedules();
    }
  };

  const handleCancel = async (id) => {
    await fetch(`/api/schedule?id=${id}`, { method: 'DELETE' });
    loadSchedules();
  };

  // Min datetime = now + 1 minute
  const minDateTime = new Date(Date.now() + 60_000).toISOString().slice(0, 16);

  if (status === 'loading' || status === 'unauthenticated') return null;

  const availableBranches = branchMap[formProject] || [];

  return (
    <Layout>
      <Head>
        <title>Schedule — Branch Toggler</title>
        <meta name="description" content="Schedule automatic production branch switches." />
      </Head>

      <div className="page-header">
        <h1>Scheduled Switches</h1>
        <p>Plan future production branch switches — they execute automatically.</p>
      </div>

      {/* ── Create form ────────────────────────────────── */}
      <div className={`card ${styles.formCard}`}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: 'var(--text-primary)' }}>
          ➕ New Scheduled Switch
        </div>
        <form onSubmit={handleCreate}>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="sProject">Project</label>
              <select
                id="sProject"
                className="select"
                value={formProject}
                onChange={(e) => setFormProject(e.target.value)}
              >
                <option value="">Choose project…</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="sBranch">Target Branch</label>
              <select
                id="sBranch"
                className="select"
                value={formBranch}
                onChange={(e) => setFormBranch(e.target.value)}
                disabled={!formProject || branchLoading}
              >
                <option value="">{branchLoading ? 'Loading…' : 'Choose branch…'}</option>
                {availableBranches.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
              <label className={styles.label} htmlFor="sTime">Switch Date & Time</label>
              <input
                id="sTime"
                type="datetime-local"
                className="input"
                value={formTime}
                min={minDateTime}
                onChange={(e) => setFormTime(e.target.value)}
              />
            </div>
          </div>

          {formMsg.text && (
            <div className={`${styles.createBtn} ${formMsg.type === 'error' ? 'badge-error' : 'badge-success'}`}
              style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>
              {formMsg.text}
            </div>
          )}

          <button type="submit" className={`btn btn-primary ${styles.createBtn}`} disabled={creating}>
            {creating ? <><span className="spinner" /> Scheduling…</> : '⏰ Schedule Switch'}
          </button>
        </form>
      </div>

      {/* ── Schedule list ──────────────────────────────── */}
      <div className={styles.tabs}>
        {STATUS_TABS.map((t) => (
          <button
            key={t}
            className={`${styles.tab} ${activeTab === t ? styles.activeTab : ''}`}
            onClick={() => setActiveTab(t)}
          >
            {STATUS_ICONS[t]} {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {listLoading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          <span className="spinner" style={{ marginRight: 8 }} /> Loading…
        </div>
      ) : schedules.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">{STATUS_ICONS[activeTab]}</div>
          <p>No {activeTab} scheduled switches.</p>
        </div>
      ) : (
        <div className={styles.scheduleList}>
          {schedules.map((s) => (
            <div key={s.id} className={styles.scheduleItem}>
              <span className={styles.scheduleIcon}>{STATUS_ICONS[s.status]}</span>
              <div className={styles.scheduleMeta}>
                <div className={styles.scheduleProject}>{s.project_name}</div>
                <div className={styles.scheduleBranch}>
                  Switch to <span className={styles.branchTag}>{s.target_branch}</span>
                  {s.error_message && (
                    <span style={{ color: 'var(--error)', fontSize: 12, marginLeft: 8 }}>
                      — {s.error_message}
                    </span>
                  )}
                </div>
              </div>
              <div className={styles.scheduleTime}>
                <div className={styles.scheduleDate}>{formatDateTime(s.scheduled_at)}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>
                  {s.executed_at ? `Executed ${formatDateTime(s.executed_at)}` : 'Pending'}
                </div>
              </div>
              {s.status === 'pending' && (
                <button
                  className={`btn btn-danger ${styles.cancelBtn}`}
                  onClick={() => handleCancel(s.id)}
                >
                  Cancel
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
