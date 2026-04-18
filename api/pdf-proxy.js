export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url, pcoAppId, pcoSecret } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  // Use user-provided credentials or fall back to env vars
  const appId = pcoAppId || process.env.PCO_APP_ID;
  const secret = pcoSecret || process.env.PCO_SECRET;

  try {
    const headers = {};
    // If the URL is a PCO URL, add auth
    if (url.includes('planningcenteronline.com') || url.includes('planning-center')) {
      headers['Authorization'] = 'Basic ' + Buffer.from(`${appId}:${secret}`).toString('base64');
    }

    const response = await fetch(url, { headers, redirect: 'follow' });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Failed to fetch PDF: ${response.status}` });
    }

    const contentType = response.headers.get('content-type') || 'application/pdf';
    const buffer = Buffer.from(await response.arrayBuffer());

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    // Allow iframe embedding from our domain
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    return res.status(200).send(buffer);
  } catch (error) {
    console.error('PDF proxy error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
