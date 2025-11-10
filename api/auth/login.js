// API route: /api/auth/login
// Handles admin authentication

export default async function handler(req, res) {
    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // CORS - restrict to your domain only
    const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://shreeadvaya.vercel.app';
    const origin = req.headers.origin;
    
    if (origin && (origin === allowedOrigin || origin.includes('localhost'))) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
        res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Parse request body
    let body = {};
    try {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON body' });
    }

    const { password } = body;
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

    if (!ADMIN_PASSWORD) {
        return res.status(500).json({ error: 'Admin password not configured. Please set ADMIN_PASSWORD in Vercel environment variables.' });
    }

    // Validate password format (prevent empty/null)
    if (!password || typeof password !== 'string') {
        return res.status(400).json({ error: 'Password required' });
    }

    // Simple password comparison (in production, use bcrypt for hashing)
    if (password === ADMIN_PASSWORD) {
        // Generate a more secure token
        const token = generateSecureToken();
        return res.status(200).json({ 
            success: true, 
            token: token,
            expiresIn: 3600 // 1 hour
        });
    } else {
        // Don't reveal whether user exists or not
        return res.status(401).json({ error: 'Invalid credentials' });
    }
}

// More secure token generator
function generateSecureToken() {
    // Use crypto if available (Node.js), otherwise fallback
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        const randomString = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
        return randomString + Date.now().toString(36);
    } else {
        // Fallback for environments without crypto
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let token = '';
        for (let i = 0; i < 64; i++) {
            token += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return token + Date.now().toString(36);
    }
}
