import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import styles from '../styles/Settings.module.css';

function Toggle({ on, onChange, label, description }) {
  return (
    <div className={styles.toggleRow}>
      <div className={styles.toggleInfo}>
        <strong>{label}</strong>
        <span>{description}</span>
      </div>
      <div
        className={`toggle ${on ? 'on' : ''}`}
        role="switch"
        aria-checked={on}
        tabIndex={0}
        onClick={onChange}
        onKeyDown={(e) => e.key === 'Enter' && onChange()}
      />
    </div>
  );
}

export default function Settings() {
  const { data: session, status } = useSession();
  const router = useRouter();
  useEffect(() => { if (status === 'unauthenticated') router.replace('/login'); }, [status, router]);

  const [slackUrl, setSlackUrl]           = useState('');
  const [discordUrl, setDiscordUrl]       = useState('');
  const [notifySwitch, setNotifySwitch]   = useState(true);
  const [notifySchedule, setNotifySchedule] = useState(true);
  const [notifyFailure, setNotifyFailure] = useState(true);

  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [testing, setTesting]   = useState(false);
  const [alert, setAlert]       = useState({ type: '', text: '' });

  // Load saved settings
  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/settings')
      .then((r) => r.json())
      .then(({ settings }) => {
        if (settings) {
          setSlackUrl(settings.slack_webhook_url || '');
          setDiscordUrl(settings.discord_webhook_url || '');
          setNotifySwitch(settings.notify_on_switch !== false);
          setNotifySchedule(settings.notify_on_schedule !== false);
          setNotifyFailure(settings.notify_on_failure !== false);
        }
      })
      .finally(() => setLoading(false));
  }, [status]);

  const showAlert = (type, text) => {
    setAlert({ type, text });
    setTimeout(() => setAlert({ type: '', text: '' }), 4000);
  };

  const handleSave = async () => {
    setSaving(true);
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slackWebhookUrl: slackUrl,
        discordWebhookUrl: discordUrl,
        notifyOnSwitch: notifySwitch,
        notifyOnSchedule: notifySchedule,
        notifyOnFailure: notifyFailure,
      }),
    });
    setSaving(false);
    if (res.ok) { showAlert('success', 'Settings saved successfully.'); }
    else        { const d = await res.json(); showAlert('error', d.error); }
  };

  const handleTest = async () => {
    if (!slackUrl && !discordUrl) {
      showAlert('error', 'Add at least one webhook URL before testing.'); return;
    }
    setTesting(true);
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slackWebhookUrl: slackUrl, discordWebhookUrl: discordUrl }),
    });
    setTesting(false);
    if (res.ok) { showAlert('success', 'Test notifications sent! Check your Slack/Discord.'); }
    else        { const d = await res.json(); showAlert('error', d.error); }
  };

  if (status === 'loading' || status === 'unauthenticated') return null;

  return (
    <Layout>
      <Head>
        <title>Settings — Branch Toggler</title>
        <meta name="description" content="Configure notifications and preferences." />
      </Head>

      <div className="page-header">
        <h1>Settings</h1>
        <p>Configure notifications and account preferences.</p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          <span className="spinner" style={{ marginRight: 8 }} /> Loading settings…
        </div>
      ) : (
        <div className="card" style={{ maxWidth: 640 }}>

          {/* ── Webhook URLs ────────────────────────────── */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>🔔 Webhook Notifications</div>

            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="slackUrl">Slack Webhook URL</label>
              <input
                id="slackUrl"
                type="url"
                className="input"
                placeholder="https://hooks.slack.com/services/…"
                value={slackUrl}
                onChange={(e) => setSlackUrl(e.target.value)}
              />
              <p className={styles.hint}>
                Create one at <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer">api.slack.com/apps</a> → Incoming Webhooks.
              </p>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="discordUrl">Discord Webhook URL</label>
              <input
                id="discordUrl"
                type="url"
                className="input"
                placeholder="https://discord.com/api/webhooks/…"
                value={discordUrl}
                onChange={(e) => setDiscordUrl(e.target.value)}
              />
              <p className={styles.hint}>
                Create one in Discord → Server Settings → Integrations → Webhooks.
              </p>
            </div>
          </div>

          {/* ── Notification toggles ─────────────────────── */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>⚙️ Notification Triggers</div>

            <Toggle
              on={notifySwitch}
              onChange={() => setNotifySwitch((v) => !v)}
              label="Branch Switched"
              description="Receive a notification whenever a production branch is switched."
            />
            <Toggle
              on={notifySchedule}
              onChange={() => setNotifySchedule((v) => !v)}
              label="Switch Scheduled"
              description="Receive a notification when a new scheduled switch is created."
            />
            <Toggle
              on={notifyFailure}
              onChange={() => setNotifyFailure((v) => !v)}
              label="Switch Failed"
              description="Get alerted if a branch switch or scheduled job fails."
            />
          </div>

          {/* ── Account info (read-only) ─────────────────── */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>👤 Account</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14 }}>
              {session?.user?.image && <img src={session.user.image} alt="" style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid var(--border)' }} />}
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{session?.user?.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{session?.user?.email}</div>
              </div>
              <span className="badge badge-success" style={{ marginLeft: 'auto' }}>Vercel OAuth</span>
            </div>
          </div>

          {alert.text && (
            <div className={`${styles.alert} ${alert.type === 'success' ? styles.alertSuccess : styles.alertError}`}>
              {alert.text}
            </div>
          )}

          {/* ── Actions ─────────────────────────────────── */}
          <div className={styles.actions}>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? <><span className="spinner" /> Saving…</> : '💾 Save Settings'}
            </button>
            <button className="btn btn-ghost" onClick={handleTest} disabled={testing}>
              {testing ? <><span className="spinner" /> Sending…</> : '🧪 Send Test Notification'}
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}
