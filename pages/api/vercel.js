// pages/api/vercel.js

async function handleVercelRequest(endpoint, token) {
  const url = `https://api.vercel.com${endpoint}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'Branch-Toggler-App', // Custom User-Agent to avoid Vercel's infinite loop protection
  };
  const res = await fetch(url, { headers });

  if (!res.ok) {
    const errorData = await res.json();
    console.error(`Vercel API Error (${url}):`, errorData);
    const error = new Error(errorData.error?.message || `Request failed with status ${res.status}`);
    error.status = res.status;
    throw error;
  }
  return res.json();
}

export default async function handler(req, res) {
  const { VERCEL_API_TOKEN } = process.env;

  if (!VERCEL_API_TOKEN) {
    return res.status(500).json({ error: 'Missing Vercel API token environment variable' });
  }

  try {
    if (req.method === 'GET') {
      const { action, projectId } = req.query;

      if (action === 'getProjects') {
        const data = await handleVercelRequest('/v9/projects', VERCEL_API_TOKEN);
        const projects = data.projects.map(p => ({ id: p.id, name: p.name }));
        res.status(200).json({ projects });

      } else if (action === 'getBranches' && projectId) {
        const projectData = await handleVercelRequest(`/v9/projects/${projectId}`, VERCEL_API_TOKEN);
        const deploymentsData = await handleVercelRequest(`/v6/deployments?projectId=${projectId}&limit=100`, VERCEL_API_TOKEN);
        
        const branches = [...new Set(deploymentsData.deployments
          .map(d => d.meta?.githubCommitRef)
          .filter(Boolean)
        )];
        
        res.status(200).json({ currentProductionBranch: projectData.productionBranch, branches });

      } else {
        res.status(400).json({ error: 'Invalid action or missing projectId' });
      }

    } else if (req.method === 'POST') {
      const { projectId, newBranch } = req.body;
      const { PRODUCTION_DOMAIN } = process.env;

      if (!projectId || !newBranch) {
        return res.status(400).json({ error: 'Missing projectId or newBranch in request body' });
      }
      if (!PRODUCTION_DOMAIN) {
        return res.status(500).json({ error: 'Missing PRODUCTION_DOMAIN environment variable.' });
      }

      // 1. Fetch deployments
      const deploymentsData = await handleVercelRequest(`/v6/deployments?projectId=${projectId}&limit=100`, VERCEL_API_TOKEN);

      // 2. Find the latest successful deployment for the target branch
      const targetDeployment = deploymentsData.deployments
        .find(d => d.meta?.githubCommitRef === newBranch && d.state === 'READY');

      if (!targetDeployment) {
        return res.status(404).json({ error: `No READY deployment found for branch: ${newBranch}` });
      }

      // 3. Assign the production domain to this deployment
      const aliasUrl = `https://api.vercel.com/v2/deployments/${targetDeployment.uid}/aliases`;
      const response = await fetch(aliasUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${VERCEL_API_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ alias: PRODUCTION_DOMAIN }),
      });

      const aliasData = await response.json();

      if (!response.ok) {
        throw new Error(aliasData.error?.message || 'Alias reassignment failed.');
      }

      res.status(200).json({ success: true, message: `Successfully switched production to ${newBranch}` });

    } else {
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    console.error('[VERCEL API HANDLER ERROR]', error);
    res.status(error.status || 500).json({ error: error.message || 'Internal Server Error' });
  }
}
