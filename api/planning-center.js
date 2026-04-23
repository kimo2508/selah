const PCO_BASE = 'https://api.planningcenteronline.com';
function getAuthHeader(query) {
  const id = query?.pcoAppId || process.env.PCO_APP_ID;
  const secret = query?.pcoSecret || process.env.PCO_SECRET;
  return 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64');
}
async function pcoFetch(path, query) {
  const response = await fetch(`${PCO_BASE}${path}`, {
    headers: {
      'Authorization': getAuthHeader(query),
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
  const { action, serviceTypeId, planId, planItemId, attachmentId, songId, arrangementId, personId } = req.query;
  try {
    if (action === 'me') {
      const data = await pcoFetch('/services/v2/me', req.query);
      return res.status(200).json(data);
    }
    if (action === 'teamMembers') {
      const data = await pcoFetch('/services/v2/people?per_page=100&order=last_name&where[status]=active', req.query);
      return res.status(200).json(data);
    }
    if (action === 'searchPerson') {
      const { firstName, lastName } = req.query;
      const fullName = (firstName || '') + ' ' + (lastName || '');
      const data = await pcoFetch(`/services/v2/people?where[name_like]=${encodeURIComponent(fullName.trim())}&per_page=5`, req.query);
      return res.status(200).json(data);
    }
    if (action === 'myPlans') {
      let pid = personId;
      if (!pid) {
        const me = await pcoFetch('/services/v2/me', req.query);
        pid = me?.data?.id;
      }
      if (!pid) throw new Error('Could not get person ID');
      const data = await pcoFetch(
        `/services/v2/people/${pid}/plan_people?filter=future&order=sort_date&per_page=20&include=plan,service_type`,
        req.query
      );
      return res.status(200).json(data);
    }
    if (action === 'planItems' && serviceTypeId && planId) {
      const data = await pcoFetch(
        `/services/v2/service_types/${serviceTypeId}/plans/${planId}/items?include=song,arrangement,key&per_page=25`,
        req.query
      );
      return res.status(200).json(data);
    }
    if (action === 'attachments' && serviceTypeId && planId) {
      const results = {};
      if (planItemId) {
        try { const r = await pcoFetch(`/services/v2/service_types/${serviceTypeId}/plans/${planId}/items/${planItemId}/attachments?per_page=50`, req.query); results.itemAttachments = r.data || []; } catch (e) { results.itemAttachments = []; }
      } else { results.itemAttachments = []; }
      try { const r = await pcoFetch(`/services/v2/service_types/${serviceTypeId}/plans/${planId}/attachments?per_page=50`, req.query); results.planAttachments = r.data || []; } catch (e) { results.planAttachments = []; }
      if (songId) { try { const r = await pcoFetch(`/services/v2/songs/${songId}/attachments?per_page=50`, req.query); results.songAttachments = r.data || []; } catch (e) { results.songAttachments = []; } } else { results.songAttachments = []; }
      if (songId && arrangementId) { try { const r = await pcoFetch(`/services/v2/songs/${songId}/arrangements/${arrangementId}/attachments?per_page=50`, req.query); results.arrangementAttachments = r.data || []; } catch (e) { results.arrangementAttachments = []; } } else { results.arrangementAttachments = []; }
      return res.status(200).json(results);
    }
    if (action === 'attachmentUrl' && attachmentId) {
      if (serviceTypeId && planId && planItemId) {
        try {
          const data = await pcoFetch(`/services/v2/service_types/${serviceTypeId}/plans/${planId}/items/${planItemId}/attachments/${attachmentId}`, req.query);
          return res.status(200).json(data);
        } catch (e) {}
      }
      return res.status(404).json({ error: 'Could not get attachment URL' });
    }
    // NEW: Fetch arrangement details including the chord_chart text (structured chord sheet, not PDF)
    if (action === 'arrangement' && songId && arrangementId) {
      const data = await pcoFetch(`/services/v2/songs/${songId}/arrangements/${arrangementId}`, req.query);
      return res.status(200).json(data);
    }
    return res.status(400).json({ error: 'Unknown action or missing params' });
  } catch (error) {
    console.error('PCO proxy error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
