// API route: /api/collections
// Handles collections with sub-categories CRUD operations via GitHub API

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Parse request body for POST/PUT requests
    let body = {};
    if (req.method === 'POST' || req.method === 'PUT') {
        try {
            body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        } catch (e) {
            return res.status(400).json({ error: 'Invalid JSON body' });
        }
    }

    const { method, query } = req;
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const GITHUB_OWNER = process.env.VERCEL_GIT_REPO_OWNER || process.env.GITHUB_OWNER || 'shreeadvaya';
    const GITHUB_REPO = process.env.VERCEL_GIT_REPO_SLUG || process.env.GITHUB_REPO || 'shreeadvaya';
    const DATA_FILE = 'data/collections.json';

    if (!GITHUB_TOKEN) {
        return res.status(500).json({ error: 'GitHub token not configured.' });
    }

    try {
        if (method === 'GET') {
            // Get all collections
            const collections = await getFileFromGitHub(GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, DATA_FILE);
            return res.status(200).json(collections);
        }

        if (method === 'POST') {
            // Add new collection
            const collections = await getFileFromGitHub(GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, DATA_FILE);
            const newCollection = {
                id: body.id || generateId(body.name),
                name: body.name,
                order: body.order || collections.length + 1,
                subcategories: body.subcategories || [],
                createdAt: new Date().toISOString()
            };
            collections.push(newCollection);
            await saveFileToGitHub(GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, DATA_FILE, collections);
            return res.status(201).json(newCollection);
        }

        if (method === 'PUT') {
            // Update collection
            const { id } = query;
            if (!id) {
                return res.status(400).json({ error: 'Collection ID is required' });
            }
            const collections = await getFileFromGitHub(GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, DATA_FILE);
            const index = collections.findIndex(c => c.id === id);
            if (index === -1) {
                return res.status(404).json({ error: 'Collection not found' });
            }
            collections[index] = {
                ...collections[index],
                ...body,
                updatedAt: new Date().toISOString()
            };
            await saveFileToGitHub(GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, DATA_FILE, collections);
            return res.status(200).json(collections[index]);
        }

        if (method === 'DELETE') {
            const { id } = query;
            if (!id) {
                return res.status(400).json({ error: 'Collection ID is required' });
            }
            const collections = await getFileFromGitHub(GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, DATA_FILE);
            const filteredCollections = collections.filter(c => c.id !== id);
            if (filteredCollections.length === collections.length) {
                return res.status(404).json({ error: 'Collection not found' });
            }
            await saveFileToGitHub(GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, DATA_FILE, filteredCollections);
            return res.status(200).json({ message: 'Collection deleted' });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ error: error.message });
    }
}

function generateId(name) {
    return name.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') +
        '-' + Date.now().toString(36);
}

// Helper functions
async function getFileFromGitHub(token, owner, repo, path) {
    try {
        const response = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'X-GitHub-Api-Version': '2022-11-28'
                }
            }
        );

        if (response.status === 404) {
            return [];
        }

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`GitHub API error: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        const content = Buffer.from(data.content, 'base64').toString('utf-8');
        return JSON.parse(content);
    } catch (error) {
        console.error('Error fetching from GitHub:', error);
        return [];
    }
}

async function saveFileToGitHub(token, owner, repo, path, data) {
    let sha = null;
    try {
        const response = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'X-GitHub-Api-Version': '2022-11-28'
                }
            }
        );
        if (response.ok) {
            const fileData = await response.json();
            sha = fileData.sha;
        }
    } catch (e) {
        // File doesn't exist, that's fine
    }

    const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
    
    const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
        {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
                'X-GitHub-Api-Version': '2022-11-28'
            },
            body: JSON.stringify({
                message: `Update ${path} via admin panel`,
                content: content,
                sha: sha
            })
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub API error: ${response.status} ${errorText}`);
    }

    return await response.json();
}
