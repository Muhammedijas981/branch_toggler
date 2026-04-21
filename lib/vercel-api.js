/**
 * Vercel API helpers.
 * Uses VERCEL_TOKEN from env for all API calls.
 * Vercel OAuth is used for identity only (name/email/avatar).
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

/** List all projects (personal + team) */
export async function getProjects(token) {
  let allProjects = [];

  // 1. Personal projects
  try {
    const personalData = await vercelFetch('/v9/projects?limit=100', token);
    const personal = (personalData.projects || []).map((p) => ({
      id: p.id,
      name: p.name,
      teamId: null,
    }));
    console.log(`[getProjects] Personal projects: ${personal.length}`);
    allProjects = [...allProjects, ...personal];
  } catch (e) {
    console.warn('[getProjects] Personal projects failed:', e.message);
  }

  // 2. Team projects via env var
  const envTeamId = process.env.VERCEL_TEAM_ID;
  if (envTeamId) {
    try {
      const teamData = await vercelFetch(
        `/v9/projects?teamId=${envTeamId}&limit=100`,
        token
      );
      const teamProjects = (teamData.projects || []).map((p) => ({
        id: p.id,
        name: p.name,
        teamId: envTeamId,
      }));
      console.log(`[getProjects] Team projects (${envTeamId}): ${teamProjects.length}`);
      allProjects = [...allProjects, ...teamProjects];
    } catch (e) {
      console.error('[getProjects] Team projects failed:', e.message, 'status:', e.status);
    }
  }

  // 3. Dynamic teams as fallback
  try {
    const teamsData = await vercelFetch('/v2/teams', token);
    const teams = (teamsData.teams || []).filter((t) => t.id !== envTeamId);

    const results = await Promise.allSettled(
      teams.map(async (team) => {
        const data = await vercelFetch(
          `/v9/projects?teamId=${team.id}&limit=100`,
          token
        );
        return (data.projects || []).map((p) => ({
          id: p.id,
          name: p.name,
          teamId: team.id,
        }));
      })
    );

    for (const r of results) {
      if (r.status === 'fulfilled') allProjects = [...allProjects, ...r.value];
    }
  } catch (e) {
    console.warn('[getProjects] Dynamic teams skipped:', e.message);
  }

  // Deduplicate by project id
  const seen = new Set();
  allProjects = allProjects.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  console.log(`[getProjects] Total projects returned: ${allProjects.length}`);
  return allProjects;
}

/** Get a project's current production branch and available branches */
export async function getBranches(projectId, token, teamId = null) {
  const query = teamId ? `?teamId=${teamId}` : '';
  const sep = teamId ? '&' : '?';

  const [project, deployments] = await Promise.all([
    vercelFetch(`/v9/projects/${projectId}${query}`, token),
    vercelFetch(`/v6/deployments${query}${sep}projectId=${projectId}&limit=100`, token),
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
    productionDomains: project.targets?.production?.alias || [],
  };
}

/** Switch the production branch by reassigning all production aliases */
export async function switchProductionBranch(projectId, newBranch, token, teamId = null) {
  const query = teamId ? `?teamId=${teamId}` : '';
  const sep = teamId ? '&' : '?';

  const [project, deploymentsData] = await Promise.all([
    vercelFetch(`/v9/projects/${projectId}${query}`, token),
    vercelFetch(`/v6/deployments${query}${sep}projectId=${projectId}&limit=100`, token),
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

  // Reassign all production aliases to the new deployment
  const aliases = project.targets?.production?.alias;
  const toAssign = aliases?.length ? aliases : [`${project.name}.vercel.app`];

  const aliasResults = await Promise.allSettled(
    toAssign.map((alias) =>
      fetch(`${BASE}/v2/deployments/${target.uid}/aliases${query}`, {
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

  aliasResults.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.warn(`[switchBranch] Alias ${toAssign[i]} failed:`, r.reason);
    } else {
      console.log(`[switchBranch] Alias ${toAssign[i]} assigned successfully`);
    }
  });

  // NOTE: We skip PATCH /v9/projects entirely — Vercel's API rejects both
  // `productionBranch` and `git.productionBranch` as invalid properties.
  // The alias reassignment above IS the actual production switch —
  // it routes all live traffic to the new branch's deployment immediately.

  return { fromBranch, toDeploymentId: target.uid };
}