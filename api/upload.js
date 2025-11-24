// API route: /api/upload
// Handles file uploads and saves them to GitHub repository
// Accepts base64 data URLs or file buffers, saves as actual files, returns URLs

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Verify authentication
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token || !(await verifyToken(token))) {
        return res.status(401).json({ error: 'Unauthorized. Please login.' });
    }

    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const GITHUB_OWNER = process.env.VERCEL_GIT_REPO_OWNER || process.env.GITHUB_OWNER || 'your-username';
    const GITHUB_REPO = process.env.VERCEL_GIT_REPO_SLUG || process.env.GITHUB_REPO || 'ShreeAdvaya';

    if (!GITHUB_TOKEN) {
        return res.status(500).json({ error: 'GitHub token not configured' });
    }

    try {
        // Parse request body
        let body = {};
        try {
            body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        } catch (e) {
            return res.status(400).json({ error: 'Invalid JSON body' });
        }

        const { images, folder } = body;
        
        if (!images || !Array.isArray(images) || images.length === 0) {
            return res.status(400).json({ error: 'No images provided. Expected array of base64 data URLs or file data.' });
        }

        const targetFolder = folder || 'images';
        const uploadedFiles = [];

        // Process each image
        for (const imageData of images) {
            let fileBuffer;
            let extension = 'webp';
            let fileName;

            // Handle base64 data URL (data:image/png;base64,...)
            if (typeof imageData === 'string' && imageData.startsWith('data:')) {
                try {
                    // More flexible regex to handle various image types
                    const matches = imageData.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
                    if (!matches || matches.length < 3) {
                        throw new Error('Invalid base64 data URL format. Expected: data:image/<type>;base64,<data>');
                    }
                    
                    extension = matches[1] === 'jpeg' ? 'jpg' : matches[1].toLowerCase();
                    // Validate extension
                    const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg+xml', 'bmp'];
                    if (!validExtensions.includes(extension)) {
                        extension = 'png'; // Default fallback
                    }
                    if (extension === 'svg+xml') extension = 'svg';
                    
                    const base64Data = matches[2];
                    // Validate base64 string is not empty and has reasonable length
                    if (!base64Data || base64Data.length < 10) {
                        throw new Error('Base64 data is empty or too short');
                    }
                    
                    fileBuffer = Buffer.from(base64Data, 'base64');
                    fileName = `image-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${extension}`;
                } catch (error) {
                    console.error('Base64 parsing error:', error.message);
                    throw new Error(`Invalid base64 data URL: ${error.message}`);
                }
            } 
            // Handle file object with name and data
            else if (typeof imageData === 'object' && imageData.data) {
                try {
                    if (imageData.data.startsWith('data:')) {
                        const matches = imageData.data.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
                        if (!matches || matches.length < 3) {
                            throw new Error('Invalid base64 data URL format in object');
                        }
                        extension = matches[1] === 'jpeg' ? 'jpg' : matches[1].toLowerCase();
                        if (extension === 'svg+xml') extension = 'svg';
                        fileBuffer = Buffer.from(matches[2], 'base64');
                    } else {
                        fileBuffer = Buffer.from(imageData.data, 'base64');
                    }
                    
                    if (imageData.filename) {
                        fileName = imageData.filename;
                        if (fileName.includes('.')) {
                            extension = fileName.split('.').pop().toLowerCase();
                        }
                    } else {
                        fileName = `image-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${extension}`;
                    }
                } catch (error) {
                    console.error('Object data parsing error:', error.message);
                    throw new Error(`Invalid image data in object: ${error.message}`);
                }
            } else {
                throw new Error('Invalid image data format. Expected base64 data URL string or object with data property.');
            }

            const filePath = `assets/${targetFolder}/${fileName}`;
            
            // Convert file buffer to base64 for GitHub API
            const fileContent = fileBuffer.toString('base64');
            
            // Check if file already exists
            let sha = null;
            try {
                const checkResponse = await fetch(
                    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`,
                    {
                        headers: {
                            'Authorization': `Bearer ${GITHUB_TOKEN}`,
                            'Accept': 'application/vnd.github.v3+json',
                            'X-GitHub-Api-Version': '2022-11-28'
                        }
                    }
                );
                if (checkResponse.ok) {
                    const fileData = await checkResponse.json();
                    sha = fileData.sha;
                }
            } catch (error) {
                // File doesn't exist, that's fine
            }

            // Upload file to GitHub
            const uploadResponse = await fetch(
                `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${GITHUB_TOKEN}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json',
                        'X-GitHub-Api-Version': '2022-11-28'
                    },
                    body: JSON.stringify({
                        message: `Upload ${fileName} via admin panel - ${new Date().toISOString()}`,
                        content: fileContent,
                        sha: sha
                    })
                }
            );

            if (!uploadResponse.ok) {
                const error = await uploadResponse.json();
                console.error('GitHub upload error:', error);
                throw new Error(`Failed to upload ${fileName}: ${error.message || uploadResponse.statusText}`);
            }

            const uploadResult = await uploadResponse.json();
            
            // Generate the raw file URL
            // GitHub raw URL format: https://raw.githubusercontent.com/owner/repo/branch/path
            const rawUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/main/${filePath}`;
            
            uploadedFiles.push({
                filename: fileName,
                path: filePath,
                url: rawUrl,
                size: fileBuffer.length
            });
        }

        return res.status(200).json({
            success: true,
            files: uploadedFiles,
            message: `Successfully uploaded ${uploadedFiles.length} file(s)`
        });

    } catch (error) {
        console.error('Upload API Error:', error);
        return res.status(500).json({ error: error.message || 'Failed to upload files' });
    }
}

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
