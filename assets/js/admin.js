// Admin Panel JavaScript
const API_BASE = '/api';
const STORAGE_KEY = 'admin_token';

// Batch Save System - Track all changes locally
const pendingChanges = {
    products: { create: [], update: [], delete: [] },
    gallery: { create: [], update: [], delete: [] },
    hero: { create: [], update: [], delete: [] },
    content: { update: null }
};

// Original data cache
const originalData = {
    products: [],
    gallery: [],
    hero: [],
    content: {}
};

// Check authentication on load
document.addEventListener('DOMContentLoaded', async () => {
    const isAuthenticated = await checkAuth();
    if (isAuthenticated) {
        showDashboard();
        setupEventListeners();
        loadData();
    } else {
        showLogin();
    }
});

async function checkAuth() {
    const token = localStorage.getItem(STORAGE_KEY);
    if (!token) {
        return false;
    }

    try {
        const response = await fetch(`${API_BASE}/auth/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ token })
        });

        if (response.ok) {
            return true;
        } else {
            localStorage.removeItem(STORAGE_KEY);
            return false;
        }
    } catch (error) {
        console.error('Auth check error:', error);
        localStorage.removeItem(STORAGE_KEY);
        return false;
    }
}

function showLogin() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('adminDashboard').style.display = 'none';
}

function showDashboard() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminDashboard').style.display = 'block';
}

// Login form handler
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('loginError');
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    // Disable button during login
    submitBtn.disabled = true;
    submitBtn.textContent = 'Logging in...';
    errorMsg.classList.remove('show');

    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            localStorage.setItem(STORAGE_KEY, data.token);
            showDashboard();
            setupEventListeners();
            loadData();
            errorMsg.classList.remove('show');
        } else {
            errorMsg.textContent = data.error || 'Invalid password';
            errorMsg.classList.add('show');
        }
    } catch (error) {
        errorMsg.textContent = 'Login failed. Please try again.';
        errorMsg.classList.add('show');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Login';
    }
});

// Logout
document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEY);
    showLogin();
    document.getElementById('password').value = '';
});

// Tab navigation
document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
        e.preventDefault();
        const targetTab = tab.getAttribute('data-tab');
        
        // Update active tab
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Show correct content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${targetTab}Tab`).classList.add('active');
    });
});

// Upload images to GitHub and get URLs back
// Accepts File objects, Blob objects, or base64 data URL strings
async function uploadImages(files, folder = 'images') {
    try {
        const token = localStorage.getItem(STORAGE_KEY);
        if (!token) {
            throw new Error('Not authenticated');
        }

        // Convert File/Blob objects to base64 data URLs, or use strings as-is
        const imageDataArray = await Promise.all(
            files.map(file => {
                // If it's already a base64 data URL string, use it directly
                if (typeof file === 'string' && file.startsWith('data:image/')) {
                    return Promise.resolve(file);
                }
                
                // If it's a File or Blob, convert to base64
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            })
        );

        // Validate imageDataArray
        const validImages = imageDataArray.filter(img => {
            if (typeof img !== 'string' || !img.startsWith('data:image/')) {
                console.warn('Skipping invalid image data:', img?.substring(0, 50));
                return false;
            }
            return true;
        });
        
        if (validImages.length === 0) {
            throw new Error('No valid images to upload');
        }
        
        if (validImages.length !== imageDataArray.length) {
            console.warn(`Filtered out ${imageDataArray.length - validImages.length} invalid image(s)`);
        }
        
        // Upload to API
        const response = await fetch(`${API_BASE}/upload`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                images: validImages,
                folder: folder
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorMsg = 'Failed to upload images';
            try {
                const error = JSON.parse(errorText);
                errorMsg = error.error || errorMsg;
            } catch (e) {
                errorMsg = errorText || errorMsg;
            }
            throw new Error(errorMsg);
        }

        const result = await response.json();
        return result.files.map(f => f.url); // Return array of URLs
    } catch (error) {
        console.error('Upload error:', error);
        throw error;
    }
}

// Helper function to check if a string is a base64 data URL
function isBase64DataUrl(str) {
    if (typeof str !== 'string' || !str.startsWith('data:image/')) {
        return false;
    }
    
    // Validate format: data:image/<type>;base64,<data>
    const matches = str.match(/^data:image\/[a-zA-Z0-9+.-]+;base64,(.+)$/);
    if (!matches || matches.length < 2) {
        return false;
    }
    
    // Check that base64 data is not empty
    const base64Data = matches[1];
    return base64Data && base64Data.length > 10;
}

// API Functions
async function apiCall(endpoint, method = 'GET', data = null) {
    try {
        const token = localStorage.getItem(STORAGE_KEY);
        if (!token) {
            // Redirect to login if no token
            showLogin();
            throw new Error('Not authenticated');
        }

        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        };

        if (data) {
            options.body = JSON.stringify(data);
        }

        console.log('[DEBUG] API Call:', {
            endpoint: `${API_BASE}${endpoint}`,
            method: method,
            hasToken: !!token,
            hasData: !!data
        });
        
        const response = await fetch(`${API_BASE}${endpoint}`, options);
        
        console.log('[DEBUG] API Response:', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok
        });
        
        // Handle 401 Unauthorized
        if (response.status === 401) {
            console.log('[DEBUG] 401 Unauthorized - removing token');
            localStorage.removeItem(STORAGE_KEY);
            showLogin();
            throw new Error('Session expired. Please login again.');
        }

        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        let result;
        
        if (contentType && contentType.includes('application/json')) {
            try {
                const text = await response.text();
                console.log('[DEBUG] Response text:', text.substring(0, 200)); // Log first 200 chars
                if (!text || text.trim() === '') {
                    throw new Error('Empty response from server');
                }
                result = JSON.parse(text);
            } catch (parseError) {
                console.error('[DEBUG] JSON Parse Error:', parseError);
                console.error('[DEBUG] Response was:', await response.clone().text());
                throw new Error('Invalid JSON response from server: ' + parseError.message);
            }
        } else {
            const text = await response.text();
            console.error('[DEBUG] Non-JSON response:', text.substring(0, 500));
            throw new Error(`Server error: ${response.status} ${response.statusText}. Response: ${text.substring(0, 100)}`);
        }
        
        console.log('[DEBUG] API Response data:', result);

        if (!response.ok) {
            console.error('[DEBUG] API Error response:', result);
            throw new Error(result.error || `API request failed: ${response.status}`);
        }

        return result;
    } catch (error) {
        console.error('API Error:', error);
        showNotification(error.message, 'error');
        throw error;
    }
}

// Load all data
async function loadData() {
    try {
        await Promise.all([
            loadProducts(),
            loadGallery(),
            loadHeroImages(),
            loadContent()
        ]);
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

// Products Management
async function loadProducts() {
    try {
        const products = await apiCall('/products');
        originalData.products = JSON.parse(JSON.stringify(products)); // Deep copy
        
        // Merge with pending changes
        const displayProducts = getDisplayProducts();
        const container = document.getElementById('productsList');
        container.innerHTML = '';

        if (displayProducts.length === 0) {
            container.innerHTML = '<p>No products found. Add your first product!</p>';
            return;
        }

        displayProducts.forEach(product => {
            const card = createProductCard(product);
            container.appendChild(card);
        });
    } catch (error) {
        document.getElementById('productsList').innerHTML = 
            '<p class="error">Error loading products. Make sure API is configured.</p>';
    }
}

// Get products with pending changes applied
function getDisplayProducts() {
    let products = JSON.parse(JSON.stringify(originalData.products));
    
    // Apply updates
    pendingChanges.products.update.forEach(update => {
        const index = products.findIndex(p => p.id === update.id);
        if (index !== -1) {
            products[index] = { ...products[index], ...update };
        }
    });
    
    // Add new items
    products.push(...pendingChanges.products.create);
    
    // Remove deleted items
    products = products.filter(p => !pendingChanges.products.delete.includes(p.id));
    
    return products;
}

function createProductCard(product) {
    // Support both single image (backward compatibility) and multiple images
    const images = product.images || (product.image ? [product.image] : ['assets/images/product-1.webp']);
    const primaryImage = images[0];
    const imageCount = images.length;
    
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
        <img src="${primaryImage}" alt="${product.alt || product.name}" onerror="this.src='assets/images/product-1.webp'">
        ${imageCount > 1 ? `<div class="image-count-badge" style="position: absolute; top: 10px; right: 10px; background: rgba(212, 175, 55, 0.9); color: white; padding: 5px 10px; border-radius: 20px; font-size: 0.85rem; font-weight: 600;">
            <i class="fas fa-images"></i> ${imageCount} images
        </div>` : ''}
        <div class="item-card-body">
            <div class="item-card-title">${product.name}</div>
            <div class="item-card-info">
                <div>Category: ${product.category}</div>
                <div>Price: ₹${product.price}</div>
            </div>
            <div class="item-card-actions">
                <button class="btn btn-primary" onclick="editProduct('${product.id}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-danger" onclick="deleteProduct('${product.id}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `;
    return card;
}

function openProductModal(productId = null) {
    const modal = document.getElementById('productModal');
    const form = document.getElementById('productForm');
    const title = document.getElementById('productModalTitle');

    form.reset();
    document.getElementById('productImagePreview').innerHTML = '';
    document.getElementById('productImageUpload').value = ''; // Clear file input
    document.getElementById('productImagesContainer').innerHTML = '';
    
    // Add initial image field
    addProductImageField();

    if (productId) {
        title.textContent = 'Edit Product';
        // Load product data
        loadProductData(productId);
    } else {
        title.textContent = 'Add Product';
        document.getElementById('productId').value = '';
    }

    modal.classList.add('active');
}

// Add product image field
function addProductImageField(imageUrl = '') {
    const container = document.getElementById('productImagesContainer');
    const imageIndex = container.children.length;
    const imageFieldDiv = document.createElement('div');
    imageFieldDiv.className = 'product-image-field';
    imageFieldDiv.style.cssText = 'display: flex; gap: 10px; margin-bottom: 10px; align-items: flex-start;';
    imageFieldDiv.innerHTML = `
        <input type="text" class="product-image-url" placeholder="assets/images/product-X.webp" value="${imageUrl}" style="flex: 1;">
        <button type="button" class="btn btn-danger" onclick="removeProductImageField(this)" style="padding: 8px 15px;">
            <i class="fas fa-trash"></i>
        </button>
    `;
    container.appendChild(imageFieldDiv);
}

// Remove product image field
function removeProductImageField(button) {
    const container = document.getElementById('productImagesContainer');
    if (container.children.length > 1) {
        button.closest('.product-image-field').remove();
    } else {
        showNotification('At least one image is required', 'error');
    }
}

async function loadProductData(productId) {
    try {
        const displayProducts = getDisplayProducts();
        const product = displayProducts.find(p => p.id === productId);
        
        if (!product) {
            showNotification('Product not found', 'error');
            return;
        }
        
        document.getElementById('productId').value = product.id;
        document.getElementById('productName').value = product.name;
        document.getElementById('productCategory').value = product.category;
        document.getElementById('productPrice').value = product.price;
        document.getElementById('productAlt').value = product.alt || '';
        
        // Handle images - support both single image (backward compatibility) and multiple images
        const images = product.images || (product.image ? [product.image] : []);
        const container = document.getElementById('productImagesContainer');
        container.innerHTML = '';
        
        if (images.length > 0) {
            images.forEach(imageUrl => {
                addProductImageField(imageUrl);
            });
        } else {
            addProductImageField();
        }
    } catch (error) {
        showNotification('Error loading product', 'error');
    }
}

document.getElementById('productForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const productId = document.getElementById('productId').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.textContent;
    
    try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Uploading images...';
        
        // Collect images from URL inputs
        const imageUrlInputs = document.querySelectorAll('.product-image-url');
        const imageUrls = Array.from(imageUrlInputs)
            .map(input => input.value.trim())
            .filter(url => url.length > 0 && !isBase64DataUrl(url)); // Filter out base64 URLs
        
        // Collect images from file uploads
        const imageFiles = Array.from(document.getElementById('productImageUpload').files);
        
        // Upload files and get URLs
        let uploadedImageUrls = [];
        if (imageFiles.length > 0) {
            try {
                uploadedImageUrls = await uploadImages(imageFiles, 'images');
            } catch (uploadError) {
                showNotification('Error uploading images: ' + uploadError.message, 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
                return;
            }
        }
        
        // Check for any base64 URLs that need to be uploaded (from previous uploads that weren't saved)
        const base64Urls = Array.from(imageUrlInputs)
            .map(input => input.value.trim())
            .filter(url => isBase64DataUrl(url));
        
        if (base64Urls.length > 0) {
            try {
                const base64UploadedUrls = await uploadImages(base64Urls, 'images');
                uploadedImageUrls.push(...base64UploadedUrls);
            } catch (uploadError) {
                showNotification('Error uploading base64 images: ' + uploadError.message, 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
                return;
            }
        }
        
        // Combine URL images and uploaded images
        const allImages = [...imageUrls, ...uploadedImageUrls];
        
        // Validate that at least one image is provided
        if (allImages.length === 0) {
            showNotification('Please provide at least one image URL or upload an image file', 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
            return;
        }
        
        const productData = {
            name: document.getElementById('productName').value,
            category: document.getElementById('productCategory').value,
            price: document.getElementById('productPrice').value,
            images: allImages, // Store as array of URLs (no base64)
            alt: document.getElementById('productAlt').value
        };

        if (productId) {
            // Remove from create if it was a new item
            pendingChanges.products.create = pendingChanges.products.create.filter(p => p.id !== productId);
            
            // Add to update queue
            const existingUpdateIndex = pendingChanges.products.update.findIndex(p => p.id === productId);
            if (existingUpdateIndex !== -1) {
                pendingChanges.products.update[existingUpdateIndex] = { ...productData, id: productId };
            } else {
                pendingChanges.products.update.push({ ...productData, id: productId });
            }
            
            showNotification('Product changes saved locally. Click "Save All Changes" to commit.', 'info');
        } else {
            // Add new product with temporary ID
            const newId = 'temp_' + Date.now();
            pendingChanges.products.create.push({ ...productData, id: newId });
            showNotification('Product added locally. Click "Save All Changes" to commit.', 'info');
        }
        
        closeModal('productModal');
        loadProducts();
        updatePendingCount();
    } catch (error) {
        showNotification('Error saving product: ' + error.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
    }
});

async function deleteProduct(productId) {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
        // Remove from create queue if it's a new item
        pendingChanges.products.create = pendingChanges.products.create.filter(p => p.id !== productId);
        
        // Remove from update queue
        pendingChanges.products.update = pendingChanges.products.update.filter(p => p.id !== productId);
        
        // Add to delete queue (if not already there)
        if (!pendingChanges.products.delete.includes(productId) && !productId.startsWith('temp_')) {
            pendingChanges.products.delete.push(productId);
        }
        
        showNotification('Product marked for deletion. Click "Save All Changes" to commit.', 'info');
        loadProducts();
        updatePendingCount();
    } catch (error) {
        showNotification('Error deleting product', 'error');
    }
}

function editProduct(productId) {
    openProductModal(productId);
}

// Gallery Management
async function loadGallery() {
    try {
        const gallery = await apiCall('/gallery');
        originalData.gallery = JSON.parse(JSON.stringify(gallery)); // Deep copy
        
        const displayGallery = getDisplayGallery();
        const container = document.getElementById('galleryList');
        container.innerHTML = '';

        if (displayGallery.length === 0) {
            container.innerHTML = '<p>No gallery images found. Add your first image!</p>';
            return;
        }

        displayGallery.forEach(item => {
            const card = createGalleryCard(item);
            container.appendChild(card);
        });
    } catch (error) {
        document.getElementById('galleryList').innerHTML = 
            '<p class="error">Error loading gallery. Make sure API is configured.</p>';
    }
}

function getDisplayGallery() {
    let gallery = JSON.parse(JSON.stringify(originalData.gallery));
    
    pendingChanges.gallery.update.forEach(update => {
        const index = gallery.findIndex(g => g.id === update.id);
        if (index !== -1) {
            gallery[index] = { ...gallery[index], ...update };
        }
    });
    
    gallery.push(...pendingChanges.gallery.create);
    gallery = gallery.filter(g => !pendingChanges.gallery.delete.includes(g.id));
    
    return gallery;
}

function createGalleryCard(item) {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
        <img src="${item.image}" alt="${item.alt}" onerror="this.src='assets/images/new-1.webp'">
        <div class="item-card-body">
            <div class="item-card-title">${item.alt}</div>
            <div class="item-card-actions">
                <button class="btn btn-danger" onclick="deleteGalleryItem('${item.id}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `;
    return card;
}

function openGalleryModal(itemId = null) {
    const modal = document.getElementById('galleryModal');
    const form = document.getElementById('galleryForm');
    const title = document.getElementById('galleryModalTitle');

    form.reset();
    document.getElementById('galleryImagePreview').innerHTML = '';
    document.getElementById('galleryImageUpload').value = ''; // Clear file input

    if (itemId) {
        title.textContent = 'Edit Gallery Image';
        document.getElementById('galleryId').value = itemId;
        // Load gallery data
        loadGalleryData(itemId);
    } else {
        title.textContent = 'Add Gallery Image';
        document.getElementById('galleryId').value = '';
    }

    modal.classList.add('active');
}

async function loadGalleryData(itemId) {
    try {
        const displayGallery = getDisplayGallery();
        const item = displayGallery.find(g => g.id === itemId);
        
        if (!item) {
            showNotification('Gallery item not found', 'error');
            return;
        }
        
        document.getElementById('galleryImage').value = item.image;
        document.getElementById('galleryAlt').value = item.alt || '';
    } catch (error) {
        showNotification('Error loading gallery item', 'error');
    }
}

document.getElementById('galleryForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const itemId = document.getElementById('galleryId').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.textContent;
    
    try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Uploading image...';
        
        const imageUrl = document.getElementById('galleryImage').value.trim();
        const imageFile = document.getElementById('galleryImageUpload').files[0];
        
        // Validate that either URL or file is provided
        if (!imageUrl && !imageFile) {
            showNotification('Please provide either an image URL or upload an image file', 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
            return;
        }
        
        // Prioritize uploaded file over URL if both are provided
        let finalImageUrl = imageUrl;
        if (imageFile) {
            // Upload file and get URL
            const uploadedUrls = await uploadImages([imageFile], 'images');
            finalImageUrl = uploadedUrls[0];
        } else if (isBase64DataUrl(imageUrl)) {
            // Upload base64 data URL
            const uploadedUrls = await uploadImages([imageUrl], 'images');
            finalImageUrl = uploadedUrls[0];
        }
        // If imageUrl is already a regular URL (not base64), use it as-is
        
        const galleryData = {
            image: finalImageUrl,
            alt: document.getElementById('galleryAlt').value
        };

        if (itemId) {
            pendingChanges.gallery.create = pendingChanges.gallery.create.filter(g => g.id !== itemId);
            const existingUpdateIndex = pendingChanges.gallery.update.findIndex(g => g.id === itemId);
            if (existingUpdateIndex !== -1) {
                pendingChanges.gallery.update[existingUpdateIndex] = { ...galleryData, id: itemId };
            } else {
                pendingChanges.gallery.update.push({ ...galleryData, id: itemId });
            }
            showNotification('Gallery changes saved locally. Click "Save All Changes" to commit.', 'info');
        } else {
            const newId = 'temp_' + Date.now();
            pendingChanges.gallery.create.push({ ...galleryData, id: newId });
            showNotification('Gallery image added locally. Click "Save All Changes" to commit.', 'info');
        }
        
        closeModal('galleryModal');
        loadGallery();
        updatePendingCount();
    } catch (error) {
        showNotification('Error saving gallery image: ' + error.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
    }
});

async function deleteGalleryItem(itemId) {
    console.log('[DEBUG] deleteGalleryItem called with ID:', itemId);
    
    if (!confirm('Are you sure you want to delete this image?')) {
        console.log('[DEBUG] User cancelled deletion');
        return;
    }

    try {
        pendingChanges.gallery.create = pendingChanges.gallery.create.filter(g => g.id !== itemId);
        pendingChanges.gallery.update = pendingChanges.gallery.update.filter(g => g.id !== itemId);
        
        if (!pendingChanges.gallery.delete.includes(itemId) && !itemId.startsWith('temp_')) {
            pendingChanges.gallery.delete.push(itemId);
        }
        
        showNotification('Gallery image marked for deletion. Click "Save All Changes" to commit.', 'info');
        loadGallery();
        updatePendingCount();
    } catch (error) {
        console.error('[DEBUG] Error deleting gallery item:', error);
        showNotification('Error deleting gallery image: ' + error.message, 'error');
    }
}

// Hero Images Management
async function loadHeroImages() {
    try {
        const heroes = await apiCall('/hero');
        originalData.hero = JSON.parse(JSON.stringify(heroes)); // Deep copy
        
        const displayHeroes = getDisplayHeroes();
        const container = document.getElementById('heroList');
        container.innerHTML = '';

        if (displayHeroes.length === 0) {
            container.innerHTML = '<p>No hero images found. Add your first hero image!</p>';
            return;
        }

        displayHeroes.forEach(item => {
            const card = createHeroCard(item);
            container.appendChild(card);
        });
    } catch (error) {
        document.getElementById('heroList').innerHTML = 
            '<p class="error">Error loading hero images. Make sure API is configured.</p>';
    }
}

function getDisplayHeroes() {
    let heroes = JSON.parse(JSON.stringify(originalData.hero));
    
    pendingChanges.hero.update.forEach(update => {
        const index = heroes.findIndex(h => h.id === update.id);
        if (index !== -1) {
            heroes[index] = { ...heroes[index], ...update };
        }
    });
    
    heroes.push(...pendingChanges.hero.create);
    heroes = heroes.filter(h => !pendingChanges.hero.delete.includes(h.id));
    
    return heroes;
}

function createHeroCard(item) {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
        <img src="${item.image}" alt="Hero Image" onerror="this.src='assets/images/hero-1.webp'">
        <div class="item-card-body">
            <div class="item-card-title">Hero Image ${item.id}</div>
            <div class="item-card-actions">
                <button class="btn btn-danger" onclick="deleteHeroImage('${item.id}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `;
    return card;
}

function openHeroModal(itemId = null) {
    const modal = document.getElementById('heroModal');
    const form = document.getElementById('heroForm');
    const title = document.getElementById('heroModalTitle');

    form.reset();
    document.getElementById('heroImagePreview').innerHTML = '';
    document.getElementById('heroImageUpload').value = ''; // Clear file input

    if (itemId) {
        title.textContent = 'Edit Hero Image';
        document.getElementById('heroId').value = itemId;
        // Load hero data
        loadHeroData(itemId);
    } else {
        title.textContent = 'Add Hero Image';
        document.getElementById('heroId').value = '';
    }

    modal.classList.add('active');
}

async function loadHeroData(itemId) {
    try {
        const displayHeroes = getDisplayHeroes();
        const item = displayHeroes.find(h => h.id === itemId);
        
        if (!item) {
            showNotification('Hero image not found', 'error');
            return;
        }
        
        document.getElementById('heroImage').value = item.image;
    } catch (error) {
        showNotification('Error loading hero image', 'error');
    }
}

document.getElementById('heroForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const itemId = document.getElementById('heroId').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.textContent;
    
    try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Uploading image...';
        
        const imageUrl = document.getElementById('heroImage').value.trim();
        const imageFile = document.getElementById('heroImageUpload').files[0];
        
        // Validate that either URL or file is provided
        if (!imageUrl && !imageFile) {
            showNotification('Please provide either an image URL or upload an image file', 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
            return;
        }
        
        // Prioritize uploaded file over URL if both are provided
        let finalImageUrl = imageUrl;
        if (imageFile) {
            // Upload file and get URL
            const uploadedUrls = await uploadImages([imageFile], 'images');
            finalImageUrl = uploadedUrls[0];
        } else if (isBase64DataUrl(imageUrl)) {
            // Upload base64 data URL
            const uploadedUrls = await uploadImages([imageUrl], 'images');
            finalImageUrl = uploadedUrls[0];
        }
        // If imageUrl is already a regular URL (not base64), use it as-is
        
        const heroData = {
            image: finalImageUrl
        };

        if (itemId) {
            pendingChanges.hero.create = pendingChanges.hero.create.filter(h => h.id !== itemId);
            const existingUpdateIndex = pendingChanges.hero.update.findIndex(h => h.id === itemId);
            if (existingUpdateIndex !== -1) {
                pendingChanges.hero.update[existingUpdateIndex] = { ...heroData, id: itemId };
            } else {
                pendingChanges.hero.update.push({ ...heroData, id: itemId });
            }
            showNotification('Hero image changes saved locally. Click "Save All Changes" to commit.', 'info');
        } else {
            const newId = 'temp_' + Date.now();
            pendingChanges.hero.create.push({ ...heroData, id: newId });
            showNotification('Hero image added locally. Click "Save All Changes" to commit.', 'info');
        }
        
        closeModal('heroModal');
        loadHeroImages();
        updatePendingCount();
    } catch (error) {
        showNotification('Error saving hero image: ' + error.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
    }
});

async function deleteHeroImage(itemId) {
    if (!confirm('Are you sure you want to delete this hero image?')) return;

    try {
        pendingChanges.hero.create = pendingChanges.hero.create.filter(h => h.id !== itemId);
        pendingChanges.hero.update = pendingChanges.hero.update.filter(h => h.id !== itemId);
        
        if (!pendingChanges.hero.delete.includes(itemId) && !itemId.startsWith('temp_')) {
            pendingChanges.hero.delete.push(itemId);
        }
        
        showNotification('Hero image marked for deletion. Click "Save All Changes" to commit.', 'info');
        loadHeroImages();
        updatePendingCount();
    } catch (error) {
        showNotification('Error deleting hero image', 'error');
    }
}

// Content Management
async function loadContent() {
    try {
        const content = await apiCall('/content');
        originalData.content = JSON.parse(JSON.stringify(content)); // Deep copy
        
        // Show pending changes if any, otherwise show original
        const displayContent = pendingChanges.content.update || originalData.content;
        
        // Logo
        if (displayContent.logo) {
            document.getElementById('siteLogoUrl').value = displayContent.logo;
            // Show preview
            const logoPreview = document.getElementById('logoPreview');
            if (logoPreview) {
                logoPreview.innerHTML = `<img src="${displayContent.logo}" alt="Logo Preview" style="max-width: 200px; max-height: 100px; object-fit: contain;">`;
            }
        }
        
        // Hero section
        if (displayContent.hero) {
            if (displayContent.hero.title) document.getElementById('heroTitle').value = displayContent.hero.title;
            if (displayContent.hero.subtitle) document.getElementById('heroSubtitle').value = displayContent.hero.subtitle;
        }
        
        // Features section
        if (displayContent.features && Array.isArray(displayContent.features)) {
            renderFeaturesForm(displayContent.features);
        } else {
            renderFeaturesForm([]);
        }
        
        // Social links
        if (displayContent.social) {
            if (displayContent.social.facebook) document.getElementById('socialFacebook').value = displayContent.social.facebook;
            if (displayContent.social.instagram) document.getElementById('socialInstagram').value = displayContent.social.instagram;
            if (displayContent.social.twitter) document.getElementById('socialTwitter').value = displayContent.social.twitter;
            if (displayContent.social.youtube) document.getElementById('socialYouTube').value = displayContent.social.youtube;
            if (displayContent.social.pinterest) document.getElementById('socialPinterest').value = displayContent.social.pinterest;
        }
        
        // Contact information
        if (displayContent.about) document.getElementById('aboutText').value = displayContent.about;
        if (displayContent.email) document.getElementById('contactEmail').value = displayContent.email;
        if (displayContent.phone) document.getElementById('contactPhone').value = displayContent.phone;
        if (displayContent.whatsapp) document.getElementById('whatsappNumber').value = displayContent.whatsapp;
    } catch (error) {
        console.error('Error loading content:', error);
    }
}

function renderFeaturesForm(features) {
    const container = document.getElementById('featuresForm');
    container.innerHTML = '';
    
    features.forEach((feature, index) => {
        const featureDiv = document.createElement('div');
        featureDiv.className = 'feature-form-item';
        featureDiv.style.cssText = 'border: 2px solid #e0e0e0; padding: 20px; margin-bottom: 15px; border-radius: 8px; background: #f9f9f9;';
        featureDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h4 style="margin: 0; color: #2c1810;">Feature ${index + 1}</h4>
                <button type="button" class="btn btn-danger" onclick="removeFeatureField(this)" style="padding: 5px 15px; font-size: 0.85rem;">
                    <i class="fas fa-trash"></i> Remove
                </button>
            </div>
            <div class="form-group">
                <label>Icon Class (Font Awesome)</label>
                <input type="text" class="feature-icon" value="${feature.icon || ''}" placeholder="fas fa-gem">
                <small>Example: fas fa-gem, fas fa-palette, fas fa-shipping-fast</small>
            </div>
            <div class="form-group">
                <label>Title</label>
                <input type="text" class="feature-title" value="${feature.title || ''}" placeholder="Premium Quality">
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea class="feature-description" rows="2" placeholder="Handpicked finest materials...">${feature.description || ''}</textarea>
            </div>
        `;
        container.appendChild(featureDiv);
    });
}

function addFeatureField() {
    const container = document.getElementById('featuresForm');
    const features = getFeaturesFromForm();
    features.push({ icon: '', title: '', description: '' });
    renderFeaturesForm(features);
}

function removeFeatureField(button) {
    const featureDiv = button.closest('.feature-form-item');
    featureDiv.remove();
}

function getFeaturesFromForm() {
    const features = [];
    const featureItems = document.querySelectorAll('.feature-form-item');
    featureItems.forEach(item => {
        const icon = item.querySelector('.feature-icon').value.trim();
        const title = item.querySelector('.feature-title').value.trim();
        const description = item.querySelector('.feature-description').value.trim();
        if (icon || title || description) {
            features.push({ icon, title, description });
        }
    });
    return features;
}

document.getElementById('contentForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.textContent;
    
    try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Uploading logo...';
        
        const logoUrl = document.getElementById('siteLogoUrl').value.trim();
        const logoFile = document.getElementById('logoUpload').files[0];
        
        // Handle logo - prioritize uploaded file over URL if both are provided
        let finalLogoUrl = logoUrl;
        if (logoFile) {
            // Upload file and get URL
            const uploadedUrls = await uploadImages([logoFile], 'images');
            finalLogoUrl = uploadedUrls[0];
        } else if (isBase64DataUrl(logoUrl)) {
            // Upload base64 data URL
            const uploadedUrls = await uploadImages([logoUrl], 'images');
            finalLogoUrl = uploadedUrls[0];
        }
        // If logoUrl is already a regular URL (not base64), use it as-is
        
        const contentData = {
            logo: finalLogoUrl || 'assets/images/logo.svg', // Default fallback
            hero: {
                title: document.getElementById('heroTitle').value.trim(),
                subtitle: document.getElementById('heroSubtitle').value.trim()
            },
            features: getFeaturesFromForm(),
            social: {
                facebook: document.getElementById('socialFacebook').value.trim(),
                instagram: document.getElementById('socialInstagram').value.trim(),
                twitter: document.getElementById('socialTwitter').value.trim(),
                youtube: document.getElementById('socialYouTube').value.trim(),
                pinterest: document.getElementById('socialPinterest').value.trim()
            },
            about: document.getElementById('aboutText').value.trim(),
            email: document.getElementById('contactEmail').value.trim(),
            phone: document.getElementById('contactPhone').value.trim(),
            whatsapp: document.getElementById('whatsappNumber').value.trim()
        };

        pendingChanges.content.update = contentData;
        showNotification('Content changes saved locally. Click "Save All Changes" to commit.', 'info');
        updatePendingCount();
    } catch (error) {
        showNotification('Error updating content: ' + error.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
    }
});

// Modal functions
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Close modal on outside click
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
}

// Image preview handlers
document.getElementById('productImageUpload')?.addEventListener('change', (e) => {
    handleMultipleImagePreview(e, 'productImagePreview');
});

document.getElementById('galleryImageUpload')?.addEventListener('change', (e) => {
    handleImagePreview(e, 'galleryImagePreview', 'galleryImage');
});

document.getElementById('heroImageUpload')?.addEventListener('change', (e) => {
    handleImagePreview(e, 'heroImagePreview', 'heroImage');
});

document.getElementById('logoUpload')?.addEventListener('change', (e) => {
    handleImagePreview(e, 'logoPreview', 'siteLogoUrl');
});

function handleImagePreview(event, previewId, inputId) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById(previewId);
            preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
            // Auto-fill the URL field with the base64 data URL
            const urlInput = document.getElementById(inputId);
            if (urlInput) {
                urlInput.value = e.target.result;
                // Visual feedback: mark the field as auto-filled
                urlInput.style.backgroundColor = '#e8f5e9';
                setTimeout(() => {
                    urlInput.style.backgroundColor = '';
                }, 2000);
            }
        };
        reader.readAsDataURL(file);
    } else {
        // Clear preview and reset URL field if file is removed
        const preview = document.getElementById(previewId);
        if (preview) preview.innerHTML = '';
        const urlInput = document.getElementById(inputId);
        if (urlInput && !urlInput.value.startsWith('data:')) {
            urlInput.value = '';
        }
    }
}

function handleMultipleImagePreview(event, previewId) {
    const files = Array.from(event.target.files);
    if (files.length > 0) {
        const preview = document.getElementById(previewId);
        preview.innerHTML = '';
        
        files.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const imgDiv = document.createElement('div');
                imgDiv.style.cssText = 'display: inline-block; margin: 5px; position: relative;';
                imgDiv.innerHTML = `
                    <img src="${e.target.result}" alt="Preview ${index + 1}" style="width: 100px; height: 100px; object-fit: cover; border-radius: 5px;">
                    <div style="text-align: center; font-size: 0.75rem; color: #666; margin-top: 5px;">Image ${index + 1}</div>
                `;
                preview.appendChild(imgDiv);
                
                // Auto-add to image fields if there's an empty field
                const imageFields = document.querySelectorAll('.product-image-url');
                let added = false;
                imageFields.forEach(field => {
                    if (!field.value.trim() && !added) {
                        field.value = e.target.result;
                        field.style.backgroundColor = '#e8f5e9';
                        setTimeout(() => {
                            field.style.backgroundColor = '';
                        }, 2000);
                        added = true;
                    }
                });
                
                // If no empty field, add a new one
                if (!added) {
                    addProductImageField(e.target.result);
                }
            };
            reader.readAsDataURL(file);
        });
    } else {
        const preview = document.getElementById(previewId);
        if (preview) preview.innerHTML = '';
    }
}

// Notification system
function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.classList.add('show');

    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

function setupEventListeners() {
    // Save All Changes button
    document.getElementById('saveAllBtn')?.addEventListener('click', saveAllChanges);
    // Discard All Changes button
    document.getElementById('discardAllBtn')?.addEventListener('click', discardAllChanges);
}

// Update pending changes count
function updatePendingCount() {
    let count = 0;
    count += pendingChanges.products.create.length + pendingChanges.products.update.length + pendingChanges.products.delete.length;
    count += pendingChanges.gallery.create.length + pendingChanges.gallery.update.length + pendingChanges.gallery.delete.length;
    count += pendingChanges.hero.create.length + pendingChanges.hero.update.length + pendingChanges.hero.delete.length;
    if (pendingChanges.content.update) count += 1;
    
    const saveBtn = document.getElementById('saveAllBtn');
    const discardBtn = document.getElementById('discardAllBtn');
    const countBadge = document.getElementById('pendingCount');
    
    if (count > 0) {
        saveBtn.style.display = 'inline-flex';
        discardBtn.style.display = 'block';
        countBadge.textContent = count;
    } else {
        saveBtn.style.display = 'none';
        discardBtn.style.display = 'none';
    }
}

// Discard all pending changes
async function discardAllChanges() {
    if (!confirm('Are you sure you want to discard all pending changes? This action cannot be undone.')) {
        return;
    }

    try {
        // Clear all pending changes
        pendingChanges.products = { create: [], update: [], delete: [] };
        pendingChanges.gallery = { create: [], update: [], delete: [] };
        pendingChanges.hero = { create: [], update: [], delete: [] };
        pendingChanges.content.update = null;
        
        // Update UI
        updatePendingCount();
        
        // Reload data to show original state
        await loadData();
        
        showNotification('All pending changes have been discarded.', 'success');
    } catch (error) {
        console.error('Error discarding changes:', error);
        showNotification('Error discarding changes: ' + error.message, 'error');
    }
}

// Save all pending changes in a single batch commit
async function saveAllChanges() {
    const saveBtn = document.getElementById('saveAllBtn');
    const originalText = saveBtn.innerHTML;
    
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    
    try {
        // Prepare batch payload
        const batchData = {};
        
        // Products
        if (pendingChanges.products.create.length > 0 || 
            pendingChanges.products.update.length > 0 || 
            pendingChanges.products.delete.length > 0) {
            batchData.products = {
                create: pendingChanges.products.create.map(item => {
                    const { id, ...itemData } = item; // Remove temp ID
                    return itemData;
                }),
                update: pendingChanges.products.update,
                delete: pendingChanges.products.delete.filter(id => !id.startsWith('temp_'))
            };
        }
        
        // Gallery
        if (pendingChanges.gallery.create.length > 0 || 
            pendingChanges.gallery.update.length > 0 || 
            pendingChanges.gallery.delete.length > 0) {
            batchData.gallery = {
                create: pendingChanges.gallery.create.map(item => {
                    const { id, ...itemData } = item; // Remove temp ID
                    return itemData;
                }),
                update: pendingChanges.gallery.update,
                delete: pendingChanges.gallery.delete.filter(id => !id.startsWith('temp_'))
            };
        }
        
        // Hero Images
        if (pendingChanges.hero.create.length > 0 || 
            pendingChanges.hero.update.length > 0 || 
            pendingChanges.hero.delete.length > 0) {
            batchData.hero = {
                create: pendingChanges.hero.create.map(item => {
                    const { id, ...itemData } = item; // Remove temp ID
                    return itemData;
                }),
                update: pendingChanges.hero.update,
                delete: pendingChanges.hero.delete.filter(id => !id.startsWith('temp_'))
            };
        }
        
        // Content
        if (pendingChanges.content.update) {
            batchData.content = {
                update: pendingChanges.content.update
            };
        }
        
        // Send batch request
        const result = await apiCall('/batch', 'POST', batchData);
        
        // Clear pending changes
        pendingChanges.products = { create: [], update: [], delete: [] };
        pendingChanges.gallery = { create: [], update: [], delete: [] };
        pendingChanges.hero = { create: [], update: [], delete: [] };
        pendingChanges.content.update = null;
        
        updatePendingCount();
        showNotification('All changes saved successfully in a single commit!', 'success');
        
        // Reload data to reflect changes
        await loadData();
        
    } catch (error) {
        console.error('Error saving changes:', error);
        showNotification('Error saving changes: ' + error.message, 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
    }
}
