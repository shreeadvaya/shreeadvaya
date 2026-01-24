// API route: /api/categories
// Handles category CRUD operations via GitHub API

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
    const DATA_FILE = 'data/categories.json';

    if (!GITHUB_TOKEN) {
        return res.status(500).json({ error: 'GitHub token not configured. Please set GITHUB_TOKEN in Vercel environment variables.' });
    }

    try {
        if (method === 'GET') {
            // Get all categories
            const categories = await getFileFromGitHub(GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, DATA_FILE);
            // Sort by order
            categories.sort((a, b) => (a.order || 0) - (b.order || 0));
            return res.status(200).json(categories);
        }

        // For POST, PUT, DELETE - require authentication
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (method === 'POST') {
            // Add new category
            const categories = await getFileFromGitHub(GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, DATA_FILE);
            
            // Generate unique ID from name
            const categoryId = body.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
            
            // Check for duplicate ID
            if (categories.find(c => c.id === categoryId)) {
                return res.status(400).json({ error: 'Category with this name already exists' });
            }
            
            const newCategory = {
                id: categoryId,
                name: body.name,
                order: body.order || categories.length + 1,
                createdAt: new Date().toISOString()
            };
            
            categories.push(newCategory);
            await saveFileToGitHub(GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, DATA_FILE, categories);
            return res.status(201).json(newCategory);
        }

        if (method === 'PUT') {
            // Update category - ID comes from query string
            const { id } = query;
            if (!id) {
                return res.status(400).json({ error: 'Category ID is required' });
            }

            const categories = await getFileFromGitHub(GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, DATA_FILE);
            const index = categories.findIndex(c => c.id === id);
            
            if (index === -1) {
                return res.status(404).json({ error: 'Category not found' });
            }

            // Keep the same ID but update name and order
            categories[index] = { 
                ...categories[index], 
                name: body.name || categories[index].name,
                order: body.order !== undefined ? body.order : categories[index].order,
                updatedAt: new Date().toISOString() 
            };
            
            await saveFileToGitHub(GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, DATA_FILE, categories);
            return res.status(200).json(categories[index]);
        }

        if (method === 'DELETE') {
            // Delete category - ID comes from query string
            const { id } = query;
            if (!id) {
                return res.status(400).json({ error: 'Category ID is required' });
            }

            const categories = await getFileFromGitHub(GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, DATA_FILE);
            const filtered = categories.filter(c => c.id !== id);
            
            if (filtered.length === categories.length) {
                return res.status(404).json({ error: 'Category not found' });
            }

            await saveFileToGitHub(GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, DATA_FILE, filtered);
            return res.status(200).json({ success: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ error: error.message });
    }
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
            // File doesn't exist, return empty array
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
    // First, get the current file to get its SHA
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
    } catch (error) {
        // File doesn't exist yet, that's okay
    }

    const content = JSON.stringify(data, null, 2);
    const encodedContent = Buffer.from(content).toString('base64');

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

