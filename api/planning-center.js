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

  const { action, serviceTypeId, planId, planItemId, attachmentId, songId, arrangementId } = req.query;

  try {
    if (action === 'me') {
      const data = await pcoFetch('/services/v2/me');
      return res.status(200).json(data);
    }

    if (action === 'myPlans') {
      const me = await pcoFetch('/services/v2/me');
      const personId = me?.data?.id;
      if (!personId) throw new Error('Could not get person ID');
      const data = await pcoFetch(
        `/services/v2/people/${personId}/plan_people?filter=future&order=sort_date&per_page=20&include=plan,service_type`
      );
      return res.status(200).json(data);
    }

    if (action === 'planItems' && serviceTypeId && planId) {
      const data = await pcoFetch(
        `/services/v2/service_types/${serviceTypeId}/plans/${planId}/items?include=song,arrangement,key&per_page=25`
      );
      return res.status(200).json(data);
    }

    // ── Get attachments — check every possible location ───────────────────
    if (action === 'attachments' && serviceTypeId && planId) {
      const results = {};

      // 1. Plan item level (the "Files" tab when you tap a song in the Order tab)
      if (planItemId) {
        try {
          const r = await pcoFetch(
            `/services/v2/service_types/${serviceTypeId}/plans/${planId}/items/${planItemId}/attachments?per_page=50`
          );
          results.itemAttachments = r.data || [];
          console.log('ITEM attachments:', results.itemAttachments.length, JSON.stringify(results.itemAttachments.map(a => a.attributes?.filename)));
        } catch (e) {
          console.log('ITEM attachments failed:', e.message);
          results.itemAttachments = [];
        }
      } else {
        results.itemAttachments = [];
      }

      // 2. Plan level
      try {
        const r = await pcoFetch(
          `/services/v2/service_types/${serviceTypeId}/plans/${planId}/attachments?per_page=50`
        );
        results.planAttachments = r.data || [];
        console.log('PLAN attachments:', results.planAttachments.length);
      } catch (e) {
        results.planAttachments = [];
      }

      // 3. Song library level
      if (songId) {
        try {
          const r = await pcoFetch(`/services/v2/songs/${songId}/attachments?per_page=50`);
          results.songAttachments = r.data || [];
          console.log('SONG attachments:', results.songAttachments.length, JSON.stringify(results.songAttachments.map(a => a.attributes?.filename)));
        } catch (e) {
          results.songAttachments = [];
        }
      } else {
        results.songAttachments = [];
      }

      // 4. Arrangement level
      if (songId && arrangementId) {
        try {
          const r = await pcoFetch(`/services/v2/songs/${songId}/arrangements/${arrangementId}/attachments?per_page=50`);
          results.arrangementAttachments = r.data || [];
          console.log('ARR attachments:', results.arrangementAttachments.length, JSON.stringify(results.arrangementAttachments.map(a => a.attributes?.filename)));
        } catch (e) {
          results.arrangementAttachments = [];
        }
      } else {
        results.arrangementAttachments = [];
      }

      return res.status(200).json(results);
    }

    // ── Get signed URL for a specific attachment ──────────────────────────
    if (action === 'attachmentUrl' && attachmentId) {

      // Try plan item level first (most likely location)
      if (serviceTypeId && planId && planItemId) {
        try {
          const data = await pcoFetch(
            `/services/v2/service_types/${serviceTypeId}/plans/${planId}/items/${planItemId}/attachments/${attachmentId}/open`
          );
          console.log('ITEM OPEN full response:', JSON.stringify(data).slice(0, 500));
return res.status(200).json(data);
        } catch (e) {
          console.log('ITEM OPEN failed:', e.message);
        }
      }

      // Try song level
      if (songId) {
        try {
          const data = await pcoFetch(`/services/v2/songs/${songId}/attachments/${attachmentId}/open`);
          console.log('SONG OPEN success');
          return res.status(200).json(data);
        } catch (e) {
          console.log('SONG OPEN failed:', e.message);
        }
        if (arrangementId) {
          try {
            const data = await pcoFetch(`/services/v2/songs/${songId}/arrangements/${arrangementId}/attachments/${attachmentId}/open`);
            console.log('ARR OPEN success');
            return res.status(200).json(data);
          } catch (e) {
            console.log('ARR OPEN failed:', e.message);
          }
        }
      }

      // Try plan level
      if (serviceTypeId && planId) {
        try {
          const data = await pcoFetch(
            `/services/v2/service_types/${serviceTypeId}/plans/${planId}/attachments/${attachmentId}/open`
          );
          console.log('PLAN OPEN success');
          return res.status(200).json(data);
        } catch (e) {
          console.log('PLAN OPEN failed:', e.message);
          // Return raw attachment data as last resort
          try {
            const data = await pcoFetch(
              `/services/v2/service_types/${serviceTypeId}/plans/${planId}/attachments/${attachmentId}`
            );
            return res.status(200).json(data);
          } catch (e2) {}
        }
      }

      return res.status(404).json({ error: 'Could not get attachment URL' });
    }

    return res.status(400).json({ error: 'Unknown action or missing params' });

  } catch (error) {
    console.error('PCO proxy error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
