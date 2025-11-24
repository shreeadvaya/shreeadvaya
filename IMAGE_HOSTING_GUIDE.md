# Image Hosting Guide

Instead of uploading images directly, use external image hosting services. This avoids upload size limits and makes the site faster.

## Recommended Services

### 1. **Google Drive** (Best for large collections)

1. Upload your image to Google Drive
2. Right-click → Share → Change to "Anyone with the link"
3. Copy the sharing link (looks like: `https://drive.google.com/file/d/FILE_ID/view`)
4. Convert to direct link: `https://drive.google.com/uc?export=view&id=FILE_ID`
5. Paste the direct link in the admin panel

**Example:**
- Sharing link: `https://drive.google.com/file/d/1ABC123xyz/view?usp=sharing`
- Direct link: `https://drive.google.com/uc?export=view&id=1ABC123xyz`

### 2. **Imgur** (Easiest, free)

1. Go to [imgur.com](https://imgur.com)
2. Click "New post" and upload your image
3. Right-click the uploaded image → "Copy image address"
4. Paste the URL in the admin panel

### 3. **ImgBB** (No account needed)

1. Go to [imgbb.com](https://imgbb.com)
2. Drag and drop your image
3. Copy the "Direct link"
4. Paste in the admin panel

### 4. **Cloudinary** (Professional, CDN)

1. Sign up at [cloudinary.com](https://cloudinary.com) (free tier available)
2. Upload images to Media Library
3. Copy the image URL
4. Paste in the admin panel

## Tips

- ✅ Use high-quality images (they'll be displayed at full size)
- ✅ JPEG for photos, PNG for logos/graphics with transparency
- ✅ WebP for best compression (if your hosting service supports it)
- ✅ Keep original aspect ratios
- ⚠️ Make sure images are publicly accessible (not behind login)
- ⚠️ Don't use temporary/expiring links

## Multiple Images for Products

You can add multiple image URLs for each product:
1. Click "Add Another Image URL" button
2. Paste each image URL in a separate field
3. Images will appear as a carousel on the website

## Testing

After pasting a URL, the admin panel will show a preview. If the image doesn't load:
- Check if the URL is publicly accessible
- Make sure it's a direct link to the image file
- Try opening the URL in a new browser tab

