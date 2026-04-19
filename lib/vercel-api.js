/**
 * Vercel API helpers.
 * All functions accept an OAuth `token` (from the user's session) rather than
 * a static shared key. This ensures each user's calls are scoped to their own account.
 */

const BASE = 'https://api.vercel.com';

async function vercelFetch(path, token, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'BranchToggler/1.0',
      ...options.headers,
    },
  });

  let data = {};
  try { data = await res.json(); } catch (_) { /* empty body */ }

  if (!res.ok) {
    const msg = data.error?.message || `Vercel API error ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}

/** List all projects visible to the authenticated user */
export async function getProjects(token) {
  const data = await vercelFetch('/v9/projects?limit=100', token);
  return (data.projects || []).map((p) => ({ id: p.id, name: p.name }));
}

/** Get a project's current production branch and the branches from recent deployments */
export async function getBranches(projectId, token) {
  const [project, deployments] = await Promise.all([
    vercelFetch(`/v9/projects/${projectId}`, token),
    vercelFetch(`/v6/deployments?projectId=${projectId}&limit=100`, token),
  ]);

  const branches = [
    ...new Set(
      (deployments.deployments || [])
        .map((d) => d.meta?.githubCommitRef)
        .filter(Boolean)
    ),
  ];

  return {
    currentProductionBranch: project.productionBranch,
    branches,
    projectName: project.name,
    // Production aliases from project targets
    productionDomains: project.targets?.production?.alias || [],
  };
}

/**
 * Switch the production branch by:
 * 1. Finding the latest READY deployment for the target branch
 * 2. Reassigning all production domain aliases to that deployment
 * 3. Updating the project's `productionBranch` setting
 *
 * Returns { fromBranch, toDeploymentId }
 */
export async function switchProductionBranch(projectId, newBranch, token) {
  const [project, deploymentsData] = await Promise.all([
    vercelFetch(`/v9/projects/${projectId}`, token),
    vercelFetch(`/v6/deployments?projectId=${projectId}&limit=100`, token),
  ]);

  const fromBranch = project.productionBranch;

  // Find latest READY deployment on the target branch
  const target = (deploymentsData.deployments || []).find(
    (d) => d.meta?.githubCommitRef === newBranch && d.state === 'READY'
  );

  if (!target) {
    const err = new Error(`No READY deployment found for branch: "${newBranch}"`);
    err.status = 404;
    err.fromBranch = fromBranch;
    throw err;
  }

  // Determine which aliases to reassign
  const aliases = project.targets?.production?.alias;
  const toAssign = aliases?.length ? aliases : [`${project.name}.vercel.app`];

  // Reassign all production aliases to new deployment
  await Promise.allSettled(
    toAssign.map((alias) =>
      fetch(`${BASE}/v2/deployments/${target.uid}/aliases`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'BranchToggler/1.0',
        },
        body: JSON.stringify({ alias }),
      })
    )
  );

  // Also update the project's productionBranch setting
  await vercelFetch(`/v9/projects/${projectId}`, token, {
    method: 'PATCH',
    body: JSON.stringify({ productionBranch: newBranch }),
  });

  return { fromBranch, toDeploymentId: target.uid };
}
