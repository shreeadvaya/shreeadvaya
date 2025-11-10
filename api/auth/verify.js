// API route: /api/auth/verify
// Verifies admin authentication token

export default async function handler(req, res) {
    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    
    // CORS - restrict to your domain only
    const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://shreeadvaya.vercel.app';
    const origin = req.headers.origin;
    
    if (origin && (origin === allowedOrigin || origin.includes('localhost'))) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
        res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Get token from Authorization header or body
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '') || req.body?.token;

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    // Validate token format (should be at least 40 chars)
    if (token.length < 40) {
        return res.status(401).json({ error: 'Invalid token format' });
    }

    // Simple token validation (in production, use proper JWT verification)
    // For now, we'll just check if token exists and is recent (within 1 hour)
    try {
        const tokenTimestamp = parseInt(token.slice(-8), 36);
        const currentTime = Date.now();
        const oneHour = 60 * 60 * 1000;

        if (isNaN(tokenTimestamp) || currentTime - tokenTimestamp > oneHour) {
            return res.status(401).json({ error: 'Token expired' });
        }
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    return res.status(200).json({ success: true, valid: true });
}
