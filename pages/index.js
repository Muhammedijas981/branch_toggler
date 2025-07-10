import Head from 'next/head';
import { useState, useEffect } from 'react';
import styles from '../styles/Home.module.css';

export default function Home() {
  // Setup and Project Selection State
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [initialError, setInitialError] = useState('');

  // Branch Selection State
  const [branchData, setBranchData] = useState({ currentProductionBranch: '', branches: [] });
  const [selectedBranch, setSelectedBranch] = useState('');
  const [loadingBranches, setLoadingBranches] = useState(false);
  
  // Action State
  const [switching, setSwitching] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Fetch all projects on initial load
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await fetch('/api/vercel?action=getProjects');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setProjects(data.projects || []);
      } catch (error) {
        setInitialError(error.message);
      } finally {
        setLoadingProjects(false);
      }
    };
    fetchProjects();
  }, []);

  // Fetch branches when a project is selected
  useEffect(() => {
    if (!selectedProject) {
      setBranchData({ currentProductionBranch: '', branches: [] });
      return;
    }

    const fetchBranches = async () => {
      setLoadingBranches(true);
      setMessage({ type: '', text: '' });
      try {
        const res = await fetch(`/api/vercel?action=getBranches&projectId=${selectedProject}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setBranchData(data);
        setSelectedBranch(data.currentProductionBranch || '');
      } catch (error) {
        setMessage({ type: 'error', text: `Failed to fetch branches: ${error.message}` });
      } finally {
        setLoadingBranches(false);
      }
    };

    fetchBranches();
  }, [selectedProject]);

  const handleSwitchBranch = async () => {
    setSwitching(true);
    setMessage({ type: 'info', text: `Switching to ${selectedBranch}...` });
    try {
      const res = await fetch('/api/vercel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: selectedProject, newBranch: selectedBranch }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      setMessage({ type: 'success', text: result.message || `Successfully updated production domain to point to branch: ${selectedBranch}.` });
      // After a short delay, refresh branch data to show the new current branch
      setTimeout(() => {
        if (selectedProject) {
          // Re-trigger the useEffect for fetching branches
          const fetchBranches = async () => {
            setLoadingBranches(true);
            try {
              const res = await fetch(`/api/vercel?action=getBranches&projectId=${selectedProject}`);
              const data = await res.json();
              if (!res.ok) throw new Error(data.error);
              setBranchData(data);
              setSelectedBranch(data.currentProductionBranch || '');
            } catch (error) {
              setMessage({ type: 'error', text: `Failed to refresh branches: ${error.message}` });
            } finally {
              setLoadingBranches(false);
            }
          };
          fetchBranches();
        }
      }, 3000); // 3-second delay to allow Vercel to update
    } catch (error) {
      setMessage({ type: 'error', text: `Failed to switch branch: ${error.message}` });
    } finally {
      setSwitching(false);
    }
  };

  const renderLoadingButton = (text) => (
    <>
      <span className={styles.loading}></span>
      {text}
    </>
  );

  return (
    <div className={styles.container}>
      <Head>
        <title>Branch Toggler</title>
        <link rel="icon" href="/favicon.ico" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet" />
      </Head>

      <h1 className={styles.title}>🚀 Branch Toggler</h1>
      <p className={styles.subtitle}>Switch your production branch with a single click</p>

      {initialError && (
        <div className={styles.setupInfo}>
          <h3>⚙️ Configuration Error</h3>
          <p>{initialError}. Please ensure your <code>.env.local</code> file contains a valid <code>VERCEL_API_TOKEN</code> and the application has been restarted.</p>
        </div>
      )}

      <div className={styles.formGroup}>
        <label htmlFor="projectSelect">Select Project</label>
        <select
          id="projectSelect"
          className={styles.select}
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          disabled={loadingProjects || initialError}
        >
          <option value="">{loadingProjects ? 'Loading projects...' : 'Choose a project...'}</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {selectedProject && (loadingBranches ? <p>Loading branches...</p> : branchData.branches.length > 0 && (
        <>
          <div className={styles.currentBranch}>
            <strong>Current Production Branch:</strong> <span>{branchData.currentProductionBranch}</span>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="branchSelect">Select New Production Branch</label>
            <select
              id="branchSelect"
              className={styles.select}
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              disabled={switching}
            >
              {branchData.branches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          <button
            className={styles.button}
            onClick={handleSwitchBranch}
            disabled={switching || !selectedBranch || selectedBranch === branchData.currentProductionBranch}
          >
            {switching ? renderLoadingButton('Switching...') : 'Switch Production Branch'}
          </button>
        </>
      ))}

      {message.text && (
        <div className={`${styles.status} ${styles[message.type]}`}>
          {message.text}
        </div>
      )}
    </div>
  );
}
