// Load and parse markdown front matter
async function parseFrontMatter(text) {
    const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---/;
    const match = text.match(frontMatterRegex);
    
    if (!match) return null;
    
    const frontMatter = {};
    const lines = match[1].split('\n');
    
    for (const line of lines) {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length) {
            let value = valueParts.join(':').trim();
            // Remove quotes
            value = value.replace(/^["']|["']$/g, '');
            // Convert to number if applicable
            if (!isNaN(value) && value !== '') {
                value = Number(value);
            }
            // Convert to boolean if applicable
            if (value === 'true') value = true;
            if (value === 'false') value = false;
            
            frontMatter[key.trim()] = value;
        }
    }
    
    return frontMatter;
}

// Load all products from markdown files
async function loadProducts() {
    try {
        const productFiles = [
            'traditional-silk-saree.md',
            'handwoven-cotton-saree.md',
            'embroidered-designer-saree.md',
            'bridal-red-gold-saree.md',
            'royal-purple-silk-saree.md',
            'printed-green-cotton-saree.md'
        ];
        
        const products = [];
        
        for (const file of productFiles) {
            try {
                const response = await fetch(`data/products/${file}`);
                if (response.ok) {
                    const text = await response.text();
                    const product = await parseFrontMatter(text);
                    if (product) {
                        product.id = file.replace('.md', '');
                        products.push(product);
                    }
                }
            } catch (error) {
                console.error(`Error loading ${file}:`, error);
            }
        }
        
        return products;
    } catch (error) {
        console.error('Error loading products:', error);
        return [];
    }
}

// Load hero content
async function loadHeroContent() {
    try {
        const response = await fetch('data/hero.json');
        if (response.ok) {
            return await response.json();
        }
    } catch (error) {
        console.error('Error loading hero content:', error);
    }
    return null;
}

// Load about content
async function loadAboutContent() {
    try {
        const response = await fetch('data/about.json');
        if (response.ok) {
            return await response.json();
        }
    } catch (error) {
        console.error('Error loading about content:', error);
    }
    return null;
}

// Render products on the page
function renderProducts(products) {
    const productsGrid = document.querySelector('.products-grid');
    if (!productsGrid) return;
    
    productsGrid.innerHTML = '';
    
    products.forEach(product => {
        const productCard = document.createElement('div');
        productCard.className = 'product-card';
        productCard.setAttribute('data-category', product.category);
        
        productCard.innerHTML = `
            <div class="product-image">
                <img src="${product.image}" alt="${product.name}" loading="lazy">
                <div class="product-overlay">
                    <button class="btn btn-primary" onclick="openWhatsApp('${product.name}')">
                        Inquire Now
                    </button>
                </div>
            </div>
            <div class="product-info">
                <h3>${product.name}</h3>
                <p class="product-price">₹${product.price.toLocaleString('en-IN')}</p>
            </div>
        `;
        
        productsGrid.appendChild(productCard);
    });
    
    // Re-initialize product cards for filtering
    window.productCards = document.querySelectorAll('.product-card');
}

// Update hero section
function updateHeroContent(hero) {
    if (!hero) return;
    
    const heroTitle = document.querySelector('.hero-title');
    const heroSubtitle = document.querySelector('.hero-subtitle');
    const primaryBtn = document.querySelector('.hero-buttons .btn-primary');
    const secondaryBtn = document.querySelector('.hero-buttons .btn-secondary');
    
    if (heroTitle) heroTitle.textContent = hero.title;
    if (heroSubtitle) heroSubtitle.textContent = hero.subtitle;
    if (primaryBtn) primaryBtn.textContent = hero.primaryButtonText;
    if (secondaryBtn) secondaryBtn.textContent = hero.secondaryButtonText;
}

// Update about section
function updateAboutContent(about) {
    if (!about) return;
    
    const sectionTitle = document.querySelector('#about .section-title');
    const sectionSubtitle = document.querySelector('#about .section-subtitle');
    const aboutDescription = document.querySelector('.about-description');
    
    if (sectionTitle) sectionTitle.textContent = about.title;
    if (sectionSubtitle) sectionSubtitle.textContent = about.subtitle;
    if (aboutDescription) aboutDescription.textContent = about.description;
}

// Initialize dynamic content
async function initializeDynamicContent() {
    const [products, hero, about] = await Promise.all([
        loadProducts(),
        loadHeroContent(),
        loadAboutContent()
    ]);
    
    if (products.length > 0) {
        renderProducts(products);
    }
    
    if (hero) {
        updateHeroContent(hero);
    }
    
    if (about) {
        updateAboutContent(about);
    }
}

// Run when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeDynamicContent);
} else {
    initializeDynamicContent();
}
