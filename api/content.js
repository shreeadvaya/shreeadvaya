// API route: /api/content
// Handles website content updates via GitHub API

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Parse request body for PUT requests
    let body = {};
    if (req.method === 'PUT') {
        try {
            body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        } catch (e) {
            return res.status(400).json({ error: 'Invalid JSON body' });
        }
    }

    const { method } = req;
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    // Use Vercel's built-in env vars if available, otherwise fallback to custom env vars or defaults
    const GITHUB_OWNER = process.env.VERCEL_GIT_REPO_OWNER || process.env.GITHUB_OWNER || 'shreeadvaya';
    const GITHUB_REPO = process.env.VERCEL_GIT_REPO_SLUG || process.env.GITHUB_REPO || 'shreeadvaya';
    const DATA_FILE = 'data/content.json';

    if (!GITHUB_TOKEN) {
        return res.status(500).json({ error: 'GitHub token not configured' });
    }

    try {
        if (method === 'GET') {
            const content = await getFileFromGitHub(GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, DATA_FILE);
            return res.status(200).json(content);
        }

        // For PUT - require authentication
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        const token = authHeader.replace('Bearer ', '');
        if (!token || !(await verifyToken(token))) {
            return res.status(401).json({ error: 'Unauthorized. Please login.' });
        }

        if (method === 'PUT') {
            const content = await getFileFromGitHub(GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, DATA_FILE);
            const updatedContent = {
                ...content,
                ...body,
                updatedAt: new Date().toISOString()
            };
            await saveFileToGitHub(GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, DATA_FILE, updatedContent);
            // Also patch index.html directly so content is pre-rendered (no flash on load)
            await patchIndexHtml(GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, updatedContent);
            return res.status(200).json(updatedContent);
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ error: error.message });
    }
}

async function getFileFromGitHub(token, owner, repo, path) {
    try {
        const response = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`, // Works with both classic and fine-grained tokens
                    'Accept': 'application/vnd.github.v3+json',
                    'X-GitHub-Api-Version': '2022-11-28' // Required for fine-grained tokens
                }
            }
        );

        if (response.status === 404) {
            return {};
        }

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.statusText}`);
        }

        const data = await response.json();
        const content = Buffer.from(data.content, 'base64').toString('utf-8');
        return JSON.parse(content);
    } catch (error) {
        console.error('Error fetching from GitHub:', error);
        return {};
    }
}

async function saveFileToGitHub(token, owner, repo, path, data) {
    let sha = null;
    try {
        const response = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`, // Works with both classic and fine-grained tokens
                    'Accept': 'application/vnd.github.v3+json',
                    'X-GitHub-Api-Version': '2022-11-28' // Required for fine-grained tokens
                }
            }
        );
        if (response.ok) {
            const fileData = await response.json();
            sha = fileData.sha;
        }
    } catch (error) {
        // File doesn't exist yet
    }

    const content = JSON.stringify(data, null, 2);
    const encodedContent = Buffer.from(content).toString('base64');

    const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
        {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`, // Works with both classic and fine-grained tokens
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
                'X-GitHub-Api-Version': '2022-11-28' // Required for fine-grained tokens
            },
            body: JSON.stringify({
                message: `Update ${path} via admin panel - ${new Date().toISOString()}`,
                content: encodedContent,
                sha: sha
            })
        }
    );

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`GitHub API error: ${error.message || response.statusText}`);
    }

    return await response.json();
}

// Patch index.html with updated content values directly
async function patchIndexHtml(token, owner, repo, content) {
    try {
        const response = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/index.html`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'X-GitHub-Api-Version': '2022-11-28'
                }
            }
        );
        if (!response.ok) return;

        const fileData = await response.json();
        const sha = fileData.sha;
        let html = Buffer.from(fileData.content, 'base64').toString('utf-8');

        // Replace inner text of an element by its id
        function patchById(html, id, newText) {
            const regex = new RegExp(`(id="${id}"[^>]*>)([\\s\\S]*?)(<\\/[a-zA-Z0-9]+>)`, 'i');
            return html.replace(regex, `$1${newText}$3`);
        }

        // Replace a specific attribute value on an element by its id
        function patchAttr(html, id, attr, newValue) {
            const regex = new RegExp(`(<[a-zA-Z]+[^>]*id="${id}"[^>]*)${attr}="[^"]*"`, 'i');
            if (regex.test(html)) {
                return html.replace(regex, `$1${attr}="${newValue}"`);
            }
            // Also try attr before id
            const regex2 = new RegExp(`(<[a-zA-Z]+[^>]*${attr}=")[^"]*("[^>]*id="${id}")`, 'i');
            return html.replace(regex2, `$1${newValue}$2`);
        }

        if (content.logo) {
            html = patchAttr(html, 'siteLogo', 'src', content.logo);
        }
        if (content.siteName) {
            html = patchById(html, 'siteNameNav', content.siteName);
            html = patchById(html, 'siteNameFooter', content.siteName);
            html = patchById(html, 'siteNameCopyright', content.siteName);
        }
        if (content.hero?.title) {
            html = patchById(html, 'heroTitle', content.hero.title);
        }
        if (content.hero?.subtitle) {
            html = patchById(html, 'heroSubtitle', content.hero.subtitle);
        }
        if (content.about) {
            html = patchById(html, 'aboutDescription', content.about);
        }
        if (content.whatsapp) {
            const formatted = content.whatsapp.replace(/(\d{2})(\d{5})(\d{5})/, '+$1 $2 $3');
            html = patchById(html, 'whatsappNumber', formatted);
        }
        if (content.email) {
            html = patchById(html, 'contactEmail', content.email);
        }
        if (content.phone) {
            html = patchById(html, 'contactPhone', content.phone);
        }

        const encodedContent = Buffer.from(html).toString('base64');
        await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/index.html`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                    'X-GitHub-Api-Version': '2022-11-28'
                },
                body: JSON.stringify({
                    message: `Update index.html via admin panel - ${new Date().toISOString()}`,
                    content: encodedContent,
                    sha
                })
            }
        );
    } catch (error) {
        // Best-effort — don't block the content save if this fails
        console.error('Error patching index.html:', error);
    }
}

// Token verification helper
async function verifyToken(token) {
    if (!token) return false;
    
    try {
        const tokenTimestamp = parseInt(token.slice(-8), 36);
        const currentTime = Date.now();
        const oneHour = 60 * 60 * 1000;
        
        return (currentTime - tokenTimestamp) <= oneHour;
    } catch (error) {
        return false;
    }
}
