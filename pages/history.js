import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import styles from '../styles/History.module.css';

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function History() {
  const { data: session, status } = useSession();
  const router = useRouter();
  useEffect(() => { if (status === 'unauthenticated') router.replace('/login'); }, [status, router]);

  const [logs, setLogs]         = useState([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [loading, setLoading]   = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const PER_PAGE = 15;

  useEffect(() => {
    if (status !== 'authenticated') return;
    setLoading(true);
    const params = new URLSearchParams({ page, limit: PER_PAGE });
    if (statusFilter) params.set('status', statusFilter);

    fetch(`/api/audit?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setLogs(d.logs || []);
        setTotal(d.total || 0);
      })
      .finally(() => setLoading(false));
  }, [status, page, statusFilter]);

  const totalPages = Math.ceil(total / PER_PAGE);
  if (status === 'loading' || status === 'unauthenticated') return null;

  return (
    <Layout>
      <Head>
        <title>History — Branch Toggler</title>
        <meta name="description" content="Full audit log of all production branch switches." />
      </Head>

      <div className="page-header">
        <h1>Switch History</h1>
        <p>A complete audit trail of every production branch change.</p>
      </div>

      {/* Filters */}
      <div className={styles.filtersBar}>
        <select
          className={`select ${styles.filterSelect}`}
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="">All statuses</option>
          <option value="success">✅ Success</option>
          <option value="failed">❌ Failed</option>
        </select>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {total} total {total === 1 ? 'record' : 'records'}
        </span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          <span className="spinner" style={{ marginRight: 8 }} /> Loading history…
        </div>
      ) : logs.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">📋</div>
          <p>No history yet. Branch switches will appear here.</p>
        </div>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Project</th>
                  <th>From → To</th>
                  <th>Status</th>
                  <th>Switched By</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{log.project_name}</td>
                    <td>
                      <div className={styles.branchCell}>
                        <span className={styles.branchTag}>{log.from_branch}</span>
                        <span>→</span>
                        <span className={styles.branchTag}>{log.to_branch}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge badge-${log.status === 'success' ? 'success' : 'error'}`}>
                        {log.status === 'success' ? '✓ Success' : '✗ Failed'}
                      </span>
                    </td>
                    <td>{log.user_name || log.user_email}</td>
                    <td className={styles.time}>{formatDate(log.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                className={`btn btn-ghost ${styles.pageBtn}`}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                ← Prev
              </button>
              <span className={styles.pageInfo}>Page {page} of {totalPages}</span>
              <button
                className={`btn btn-ghost ${styles.pageBtn}`}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
