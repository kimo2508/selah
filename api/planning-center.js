const PCO_BASE = 'https://api.planningcenteronline.com';

function getAuthHeader() {
  const id = process.env.PCO_APP_ID;
  const secret = process.env.PCO_SECRET;
  return 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64');
}

async function pcoFetch(path) {
  const response = await fetch(`${PCO_BASE}${path}`, {
    headers: {
      'Authorization': getAuthHeader(),
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PCO ${response.status}: ${text}`);
  }
  return response.json();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, serviceTypeId, planId, personId } = req.query;

  try {
    // ── Get current user (me) ──────────────────────────────────────────────
    if (action === 'me') {
      const data = await pcoFetch('/services/v2/me');
      return res.status(200).json(data);
    }

    // ── Get all service types ──────────────────────────────────────────────
    if (action === 'serviceTypes') {
      const data = await pcoFetch('/services/v2/service_types?per_page=25');
      return res.status(200).json(data);
    }

    // ── Get upcoming plans for a service type ──────────────────────────────
    if (action === 'plans' && serviceTypeId) {
      // Get plans sorted by date, upcoming only
      const data = await pcoFetch(
        `/services/v2/service_types/${serviceTypeId}/plans?filter=future&order=sort_date&per_page=10&include=team_members`
      );
      return res.status(200).json(data);
    }

    // ── Get my scheduled plans (services I'm playing on) ──────────────────
    if (action === 'myPlans') {
      // First get my person ID
      const me = await pcoFetch('/services/v2/me');
      const personId = me?.data?.id;
      if (!personId) throw new Error('Could not get person ID');

      // Get plan people where I am scheduled, include plan and service type
      const data = await pcoFetch(
        `/services/v2/people/${personId}/plan_people?filter=future&order=sort_date&per_page=20&include=plan,service_type`
      );
      return res.status(200).json(data);
    }

    // ── Get items (songs) for a specific plan ─────────────────────────────
    if (action === 'planItems' && serviceTypeId && planId) {
      const data = await pcoFetch(
        `/services/v2/service_types/${serviceTypeId}/plans/${planId}/items?include=song,arrangement,key&per_page=25`
      );
      return res.status(200).json(data);
    }

    // ── Get attachments for a plan item ───────────────────────────────────
    if (action === 'attachments' && serviceTypeId && planId) {
      const data = await pcoFetch(
        `/services/v2/service_types/${serviceTypeId}/plans/${planId}/attachments?per_page=25`
      );
      return res.status(200).json(data);
    }

    // ── Get a specific plan's full details ────────────────────────────────
    if (action === 'plan' && serviceTypeId && planId) {
      const data = await pcoFetch(
        `/services/v2/service_types/${serviceTypeId}/plans/${planId}?include=service_type`
      );
      return res.status(200).json(data);
    }

    // ── Get attachment open/download URL ──────────────────────────────────
    if (action === 'attachmentUrl' && req.query.attachmentId && serviceTypeId && planId) {
      const data = await pcoFetch(
        `/services/v2/service_types/${serviceTypeId}/plans/${planId}/attachments/${req.query.attachmentId}/open`
      );
      return res.status(200).json(data);
    }

    return res.status(400).json({ error: 'Unknown action or missing params' });

  } catch (error) {
    console.error('PCO proxy error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
