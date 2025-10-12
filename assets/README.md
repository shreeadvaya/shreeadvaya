# Assets Folder

This folder contains all website assets organized by type.

## Folder Structure

```
assets/
├── css/
│   └── styles.css          # Main stylesheet (20 KB)
├── js/
│   └── script.js           # Main JavaScript file (13 KB)
├── images/
│   ├── hero-1.jpg through hero-4.jpg      # HD slideshow backgrounds
│   ├── product-1.jpg through product-6.jpg # Product card images
│   └── gallery-1.jpg through gallery-6.jpg # Gallery section images
└── README.md               # This file
```

## Directory Details

### `/css` - Stylesheets
- **styles.css** (20 KB) - Main stylesheet containing:
  - Hero slideshow animations
  - Responsive layouts (desktop, tablet, mobile)
  - Modern gradient designs
  - All component styles
  - Custom animations and transitions

### `/js` - JavaScript Files
- **script.js** (13 KB) - Main JavaScript file with:
  - Mobile navigation toggle
  - Product category filtering
  - Gallery lightbox functionality
  - WhatsApp integration
  - Form validation and handling
  - Scroll-triggered animations
  - Keyboard navigation support

### `/images` - All Website Images

#### Logo & Branding
- **logo.svg** (2.3 KB) - Main logo with mandala pattern and "SA" monogram
- **favicon.svg** (1.3 KB) - Favicon/shortcut icon for browser tabs

#### Hero Slideshow (1920px HD)
- **hero-1.jpg** (197 KB) - Traditional Red Silk Saree
- **hero-2.jpg** (912 KB) - Blue Handwoven Cotton Saree
- **hero-3.jpg** (197 KB) - Traditional Red Silk Saree variation
- **hero-4.jpg** (912 KB) - Blue Handwoven Cotton Saree variation

#### Product Cards (600px)
- **product-1.jpg** (22 KB) - Traditional Silk Saree
- **product-2.jpg** (122 KB) - Handwoven Cotton Saree
- **product-3.jpg** (22 KB) - Embroidered Designer Saree
- **product-4.jpg** (22 KB) - Bridal Red & Gold Saree
- **product-5.jpg** (34 KB) - Royal Purple Silk Saree
- **product-6.jpg** (34 KB) - Printed Cotton Saree

#### Gallery (800px)
- **gallery-1.jpg** (33 KB) - Elegant Red Silk Saree Collection
- **gallery-2.jpg** (202 KB) - Traditional Blue Saree Collection
- **gallery-3.jpg** (33 KB) - Designer Saree Collection
- **gallery-4.jpg** (202 KB) - Bridal Saree Collection
- **gallery-5.jpg** (50 KB) - Purple Silk Saree Collection
- **gallery-6.jpg** (50 KB) - Printed Cotton Saree Collection

## Total Size
**~3.1 MB** (all assets combined including 18 images + 2 SVG logos)

## Path References

### In index.html:
```html
<link rel="stylesheet" href="assets/css/styles.css">
<script src="assets/js/script.js"></script>
<img src="assets/images/product-1.jpg">
```

### In styles.css:
```css
background-image: url('../images/hero-1.jpg');
/* Relative to css/ folder, goes up to assets/ then into images/ */
```

## Image Sources
All images are sourced from Pexels (royalty-free) and saved locally for:
- ⚡ Faster loading times
- 🔒 Offline accessibility  
- 📦 Version control
- 🚫 No external dependencies

## Benefits of This Structure
- **Organized**: Clear separation of concerns (CSS, JS, Images)
- **Maintainable**: Easy to find and update files
- **Scalable**: Easy to add more files in respective folders
- **Professional**: Follows industry best practices
