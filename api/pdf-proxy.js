// pdf-proxy.js — Fetches PDF from PCO signed URL server-side and returns raw bytes
// This bypasses PCO's iframe/CORS restrictions by proxying through our own server

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  try {
    // Fetch the PDF from PCO's signed URL server-side
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Selah/1.0',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: `PDF fetch failed: ${response.status} ${response.statusText}` 
      });
    }

    const contentType = response.headers.get('content-type') || 'application/pdf';
    
    // If PCO redirected to a login page (HTML), reject it
    if (contentType.includes('text/html')) {
      return res.status(403).json({ 
        error: 'PCO returned login page instead of PDF. URL may have expired.' 
      });
    }

    // Get the PDF as an ArrayBuffer and send it back
    const buffer = await response.arrayBuffer();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', buffer.byteLength);
    res.setHeader('Cache-Control', 'private, max-age=3600'); // Cache for 1 hour
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    return res.send(Buffer.from(buffer));
  } catch (err) {
    console.error('PDF proxy error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch PDF: ' + err.message });
  }
}
