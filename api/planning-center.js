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

  const { action, serviceTypeId, planId, attachmentId } = req.query;

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

    if (action === 'attachments' && serviceTypeId && planId) {
      const planAttachments = await pcoFetch(
        `/services/v2/service_types/${serviceTypeId}/plans/${planId}/attachments?per_page=50`
      );
      let itemAttachments = { data: [] };
      try {
        itemAttachments = await pcoFetch(
          `/services/v2/service_types/${serviceTypeId}/plans/${planId}/items?include=attachments&per_page=25`
        );
      } catch (e) {}

      // DEBUG — remove after testing
      console.log('ATTACHMENTS planAttachments count:', planAttachments.data?.length);
      console.log('ATTACHMENTS itemAttachments included:', JSON.stringify(itemAttachments.included?.slice(0,3)));

      return res.status(200).json({
        planAttachments: planAttachments.data || [],
        itemAttachments: itemAttachments.included?.filter(i => i.type === 'Attachment') || [],
        items: itemAttachments.data || [],
      });
    }
    
    if (action === 'attachmentUrl' && serviceTypeId && planId && attachmentId) {
      try {
        const data = await pcoFetch(
          `/services/v2/service_types/${serviceTypeId}/plans/${planId}/attachments/${attachmentId}/open`
        );
        return res.status(200).json(data);
      } catch (e) {
        const data = await pcoFetch(
          `/services/v2/service_types/${serviceTypeId}/plans/${planId}/attachments/${attachmentId}`
        );
        return res.status(200).json(data);
      }
    }

    return res.status(400).json({ error: 'Unknown action or missing params' });

  } catch (error) {
    console.error('PCO proxy error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
