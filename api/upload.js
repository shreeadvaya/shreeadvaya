// API route: /api/upload
// Handles file uploads and saves them to GitHub repository
// Supports both multipart/form-data (file uploads) and JSON (base64)

import formidable from 'formidable';
import fs from 'fs';

export const config = {
    api: {
        bodyParser: false, // Disable default body parser to handle multipart/form-data
    },
};

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
        const contentType = req.headers['content-type'] || '';
        let images = [];
        let folder = 'images';

        // Handle multipart/form-data (actual file uploads)
        if (contentType.includes('multipart/form-data')) {
            const form = formidable({
                maxFileSize: 10 * 1024 * 1024, // 10MB max per file
                allowEmptyFiles: false,
                multiples: true,
            });

            const [fields, files] = await new Promise((resolve, reject) => {
                form.parse(req, (err, fields, files) => {
                    if (err) reject(err);
                    else resolve([fields, files]);
                });
            });

            folder = fields.folder?.[0] || fields.folder || 'images';
            
            // Get uploaded files
            const uploadedFiles = files.images ? (Array.isArray(files.images) ? files.images : [files.images]) : [];
            
            if (uploadedFiles.length === 0) {
                return res.status(400).json({ error: 'No files uploaded' });
            }

            // Convert uploaded files to buffer format
            images = await Promise.all(uploadedFiles.map(async (file) => {
                const fileBuffer = fs.readFileSync(file.filepath);
                const extension = file.originalFilename?.split('.').pop()?.toLowerCase() || 
                                 file.mimetype?.split('/')[1] || 'jpg';
                
                return {
                    buffer: fileBuffer,
                    filename: file.originalFilename || `image-${Date.now()}.${extension}`,
                    mimetype: file.mimetype || 'image/jpeg'
                };
            }));
        } 
        // Handle JSON (base64 data URLs) - legacy support
        else {
            let body = {};
            try {
                body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
            } catch (e) {
                return res.status(400).json({ error: 'Invalid request body' });
            }

            const { images: imageData, folder: folderData } = body;
            folder = folderData || 'images';
            
            if (!imageData || !Array.isArray(imageData) || imageData.length === 0) {
                return res.status(400).json({ error: 'No images provided' });
            }

            // Convert base64 data URLs to buffer format
            images = imageData.map((data) => {
                if (typeof data === 'string' && data.startsWith('data:')) {
                    const matches = data.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
                    if (!matches) {
                        throw new Error('Invalid base64 data URL format');
                    }
                    
                    let extension = matches[1].toLowerCase();
                    if (extension === 'jpeg') extension = 'jpg';
                    if (extension === 'svg+xml') extension = 'svg';
                    
                    const base64Data = matches[2];
                    const fileBuffer = Buffer.from(base64Data, 'base64');
                    
                    return {
                        buffer: fileBuffer,
                        filename: `image-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${extension}`,
                        mimetype: `image/${extension}`
                    };
                } else {
                    throw new Error('Invalid image data format');
                }
            });
        }

        const targetFolder = folder || 'images';
        const uploadedFiles = [];

        // Process each image
        for (const imageData of images) {
            let fileBuffer = imageData.buffer;
            let fileName = imageData.filename;
            let extension = fileName.split('.').pop().toLowerCase();

            // Validate file extension - support all common image formats
            const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'tif', 'heic', 'heif', 'avif'];
            if (!validExtensions.includes(extension)) {
                console.warn(`Uncommon extension: ${extension}, converting to jpg`);
                extension = 'jpg'; // Default fallback for unknown types
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
