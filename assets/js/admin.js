// Admin Panel JavaScript
const API_BASE = '/api';
const STORAGE_KEY = 'admin_token';

// Batch Save System - Track all changes locally
const pendingChanges = {
    products: { create: [], update: [], delete: [] },
    categories: { create: [], update: [], delete: [] },
    hero: { create: [], update: [], delete: [] },
    content: { update: null }
};

// Original data cache
const originalData = {
    products: [],
    categories: [],
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

// Image Upload Functionality

/**
 * Upload images to GitHub via API using FormData
 */
async function uploadImagesToAPI(files, folder = 'images') {
    try {
        const token = localStorage.getItem(STORAGE_KEY);
        if (!token) {
            showNotification('Not authenticated. Please login again.', 'error');
            return null;
        }

        // Create FormData with files
        const formData = new FormData();
        for (const file of files) {
            formData.append('images', file);
        }
        formData.append('folder', folder);

        // Upload to API
        const response = await fetch(`${API_BASE}/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        console.log('Upload response status:', response.status);
        console.log('Upload response content-type:', response.headers.get('content-type'));

        if (!response.ok) {
            let errorMessage = 'Upload failed';
            try {
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    const error = await response.json();
                    errorMessage = error.error || errorMessage;
                } else {
                    const text = await response.text();
                    console.error('Upload error response:', text);
                    errorMessage = text || `Upload failed with status ${response.status}`;
                }
            } catch (e) {
                console.error('Error parsing response:', e);
                errorMessage = `Upload failed with status ${response.status}`;
            }
            throw new Error(errorMessage);
        }

        const result = await response.json();
        return result.files; // Array of { filename, path, url, size }
    } catch (error) {
        console.error('Upload error:', error);
        showNotification('Upload failed: ' + error.message, 'error');
        return null;
    }
}

/**
 * Upload product images
 */
async function uploadProductImages() {
    const fileInput = document.getElementById('productImageFiles');
    const files = fileInput.files;
    
    if (!files || files.length === 0) {
        showNotification('Please select at least one image file', 'warning');
        return;
    }

    // Show loading
    const uploadBtn = event.target;
    const originalText = uploadBtn.innerHTML;
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';

    try {
        const uploadedFiles = await uploadImagesToAPI(Array.from(files), 'images');
        
        if (uploadedFiles && uploadedFiles.length > 0) {
            // Add uploaded image URLs to the container
            const container = document.getElementById('productImagesContainer');
            
            uploadedFiles.forEach(file => {
                addProductImageField(file.url);
            });
            
            showNotification(`Successfully uploaded ${uploadedFiles.length} image(s)`, 'success');
            
            // Clear file input
            fileInput.value = '';
        }
    } catch (error) {
        showNotification('Error uploading images: ' + error.message, 'error');
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = originalText;
    }
}

/**
 * Upload logo image
 */
async function uploadLogoImage() {
    const fileInput = document.getElementById('logoImageFile');
    const file = fileInput.files[0];
    
    if (!file) {
        showNotification('Please select an image file', 'warning');
        return;
    }

    // Show loading
    const uploadBtn = event.target;
    const originalText = uploadBtn.innerHTML;
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';

    try {
        const uploadedFiles = await uploadImagesToAPI([file], 'images');
        
        if (uploadedFiles && uploadedFiles.length > 0) {
            const imageUrl = uploadedFiles[0].url;
            document.getElementById('siteLogoUrl').value = imageUrl;
            
            // Show preview
            const preview = document.getElementById('logoPreview');
            preview.innerHTML = `<img src="${imageUrl}" alt="Logo Preview" style="max-height: 100px; border-radius: 8px;">`;
            
            showNotification('Logo uploaded successfully', 'success');
            
            // Clear file input
            fileInput.value = '';
        }
    } catch (error) {
        showNotification('Error uploading logo: ' + error.message, 'error');
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = originalText;
    }
}

/**
 * Upload hero image
 */
async function uploadHeroImage() {
    const fileInput = document.getElementById('heroImageFile');
    const file = fileInput.files[0];
    
    if (!file) {
        showNotification('Please select an image file', 'warning');
        return;
    }

    // Show loading
    const uploadBtn = event.target;
    const originalText = uploadBtn.innerHTML;
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';

    try {
        const uploadedFiles = await uploadImagesToAPI([file], 'images');
        
        if (uploadedFiles && uploadedFiles.length > 0) {
            const imageUrl = uploadedFiles[0].url;
            document.getElementById('heroImage').value = imageUrl;
            
            // Show preview
            const preview = document.getElementById('heroImagePreview');
            preview.innerHTML = `<img src="${imageUrl}" alt="Preview" style="max-width: 100%; max-height: 300px; border-radius: 8px;">`;
            
            showNotification('Image uploaded successfully', 'success');
            
            // Clear file input
            fileInput.value = '';
        }
    } catch (error) {
        showNotification('Error uploading image: ' + error.message, 'error');
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = originalText;
    }
}

/**
 * Setup image preview on URL input change
 */
function setupImagePreviewListeners() {
    // Hero image preview
    const heroImageInput = document.getElementById('heroImage');
    if (heroImageInput) {
        heroImageInput.addEventListener('input', (e) => {
            const url = e.target.value.trim();
            const preview = document.getElementById('heroImagePreview');
            if (url && (url.startsWith('http') || url.startsWith('assets/'))) {
                preview.innerHTML = `<img src="${url}" alt="Preview" style="max-width: 100%; max-height: 300px; border-radius: 8px;" onerror="this.parentElement.innerHTML='<p style=\\'color: #e74c3c;\\'>Invalid image URL</p>'">`;
            } else {
                preview.innerHTML = '';
            }
        });
    }

    // Logo preview
    const logoInput = document.getElementById('siteLogoUrl');
    if (logoInput) {
        logoInput.addEventListener('input', (e) => {
            const url = e.target.value.trim();
            const preview = document.getElementById('logoPreview');
            if (url && (url.startsWith('http') || url.startsWith('assets/'))) {
                preview.innerHTML = `<img src="${url}" alt="Logo Preview" style="max-height: 100px; border-radius: 8px;" onerror="this.parentElement.innerHTML='<p style=\\'color: #e74c3c;\\'>Invalid image URL</p>'">`;
            } else {
                preview.innerHTML = '';
            }
        });
    }
}

/**
 * Setup drag and drop for file inputs
 */
function setupDragAndDrop() {
    const fileInputs = ['productImageFiles', 'heroImageFile', 'logoImageFile'];
    
    fileInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (!input) return;
        
        const container = input.parentElement;
        
        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            container.addEventListener(eventName, preventDefaults, false);
        });
        
        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        // Highlight drop area
        ['dragenter', 'dragover'].forEach(eventName => {
            container.addEventListener(eventName, () => {
                container.style.background = '#fff3cd';
                container.style.borderColor = '#ffc107';
            }, false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            container.addEventListener(eventName, () => {
                container.style.background = '#f8f9fa';
                container.style.borderColor = '#d4af37';
            }, false);
        });
        
        // Handle dropped files
        container.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            input.files = files;
            
            // Show file count
            if (files.length > 0) {
                showNotification(`${files.length} file(s) selected`, 'info');
            }
        }, false);
    });
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
            loadCategories(),
            loadCollections(),
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
    document.getElementById('productImagesContainer').innerHTML = '';
    
    // Don't add initial empty field - user can upload or manually add URL
    // addProductImageField();

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
        <input type="text" class="product-image-url" placeholder="https://... or assets/images/product.webp" value="${imageUrl}" style="flex: 1;">
        <button type="button" class="btn btn-danger" onclick="removeProductImageField(this)" style="padding: 8px 15px;">
            <i class="fas fa-trash"></i>
        </button>
    `;
    container.appendChild(imageFieldDiv);
    
    // If no URL provided, don't add an empty field initially
    if (!imageUrl && container.children.length === 1) {
        // This is the first empty field, keep it for manual URL entry
    }
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
        document.getElementById('productDescription').value = product.description || '';
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
    
    // Collect images from URL inputs
    const imageUrlInputs = document.querySelectorAll('.product-image-url');
    const allImages = Array.from(imageUrlInputs)
        .map(input => input.value.trim())
        .filter(url => url.length > 0);
    
    // Validate that at least one image is provided
    if (allImages.length === 0) {
        showNotification('Please upload at least one image or add an image URL', 'error');
        return;
    }
    
    try {
        const productData = {
            name: document.getElementById('productName').value,
            category: document.getElementById('productCategory').value,
            price: document.getElementById('productPrice').value,
            description: document.getElementById('productDescription').value.trim(),
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

// Categories Management
async function loadCategories() {
    try {
        const categories = await apiCall('/categories');
        originalData.categories = JSON.parse(JSON.stringify(categories)); // Deep copy
        
        // Merge with pending changes
        const displayCategories = getDisplayCategories();
        const container = document.getElementById('categoriesList');
        
        if (container) {
            container.innerHTML = '';

            if (displayCategories.length === 0) {
                container.innerHTML = '<p>No categories found. Add your first category!</p>';
                return;
            }

            displayCategories.forEach(category => {
                const card = createCategoryCard(category);
                container.appendChild(card);
            });
        }
        
        // Also update the product form dropdown
        updateProductCategoryDropdown(displayCategories);
    } catch (error) {
        const container = document.getElementById('categoriesList');
        if (container) {
            container.innerHTML = '<p class="error">Error loading categories. Make sure API is configured.</p>';
        }
    }
}

// Get categories with pending changes applied
function getDisplayCategories() {
    let categories = JSON.parse(JSON.stringify(originalData.categories));
    
    // Apply updates
    pendingChanges.categories.update.forEach(update => {
        const index = categories.findIndex(c => c.id === update.id);
        if (index !== -1) {
            categories[index] = { ...categories[index], ...update };
        }
    });
    
    // Add new items
    categories.push(...pendingChanges.categories.create);
    
    // Remove deleted items
    categories = categories.filter(c => !pendingChanges.categories.delete.includes(c.id));
    
    // Sort by order
    categories.sort((a, b) => (a.order || 0) - (b.order || 0));
    
    return categories;
}

function createCategoryCard(category) {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.style.cssText = 'padding: 20px; text-align: center;';
    card.innerHTML = `
        <div class="item-card-body">
            <div style="font-size: 2rem; margin-bottom: 10px; color: #d4af37;">
                <i class="fas fa-tag"></i>
            </div>
            <div class="item-card-title">${category.name}</div>
            <div class="item-card-info">
                <div style="color: #666; font-size: 0.9rem; margin: 5px 0;">ID: ${category.id}</div>
                <div style="color: #666; font-size: 0.9rem;">Order: ${category.order || 'N/A'}</div>
            </div>
            <div class="item-card-actions">
                <button class="btn btn-primary" onclick="editCategory('${category.id}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-primary" onclick="deleteCategory('${category.id}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `;
    return card;
}

function openCategoryModal(categoryId = null) {
    const modal = document.getElementById('categoryModal');
    const form = document.getElementById('categoryForm');
    const title = document.getElementById('categoryModalTitle');

    form.reset();

    if (categoryId) {
        title.textContent = 'Edit Category';
        loadCategoryData(categoryId);
    } else {
        title.textContent = 'Add Category';
        document.getElementById('categoryId').value = '';
    }

    modal.classList.add('active');
}

async function loadCategoryData(categoryId) {
    try {
        const displayCategories = getDisplayCategories();
        const category = displayCategories.find(c => c.id === categoryId);
        
        if (!category) {
            showNotification('Category not found', 'error');
            return;
        }
        
        document.getElementById('categoryId').value = category.id;
        document.getElementById('categoryName').value = category.name;
        document.getElementById('categoryOrder').value = category.order || '';
    } catch (error) {
        showNotification('Error loading category', 'error');
    }
}

document.getElementById('categoryForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const categoryId = document.getElementById('categoryId').value;
    const categoryName = document.getElementById('categoryName').value.trim();
    const categoryOrder = document.getElementById('categoryOrder').value;
    
    if (!categoryName) {
        showNotification('Category name is required', 'error');
        return;
    }
    
    try {
        const categoryData = {
            name: categoryName,
            order: categoryOrder ? parseInt(categoryOrder) : undefined
        };

        if (categoryId) {
            // Update existing category
            pendingChanges.categories.create = pendingChanges.categories.create.filter(c => c.id !== categoryId);
            
            const existingUpdateIndex = pendingChanges.categories.update.findIndex(c => c.id === categoryId);
            if (existingUpdateIndex !== -1) {
                pendingChanges.categories.update[existingUpdateIndex] = { ...categoryData, id: categoryId };
            } else {
                pendingChanges.categories.update.push({ ...categoryData, id: categoryId });
            }
            
            showNotification('Category changes saved locally. Click "Save All Changes" to commit.', 'info');
        } else {
            // Add new category with temporary ID
            const tempId = 'temp_' + Date.now();
            pendingChanges.categories.create.push({ ...categoryData, id: tempId });
            showNotification('Category added locally. Click "Save All Changes" to commit.', 'info');
        }
        
        closeModal('categoryModal');
        loadCategories();
        updatePendingCount();
    } catch (error) {
        showNotification('Error saving category: ' + error.message, 'error');
    }
});

async function deleteCategory(categoryId) {
    if (!confirm('Are you sure you want to delete this category? Products using this category will need to be updated.')) return;

    try {
        // Remove from create queue if it's a new item
        pendingChanges.categories.create = pendingChanges.categories.create.filter(c => c.id !== categoryId);
        
        // Remove from update queue
        pendingChanges.categories.update = pendingChanges.categories.update.filter(c => c.id !== categoryId);
        
        // Add to delete queue (if not already there)
        if (!pendingChanges.categories.delete.includes(categoryId) && !categoryId.startsWith('temp_')) {
            pendingChanges.categories.delete.push(categoryId);
        }
        
        showNotification('Category marked for deletion. Click "Save All Changes" to commit.', 'info');
        loadCategories();
        updatePendingCount();
    } catch (error) {
        showNotification('Error deleting category', 'error');
    }
}

function editCategory(categoryId) {
    openCategoryModal(categoryId);
}

// Update product category dropdown with current categories
function updateProductCategoryDropdown(categories) {
    const dropdown = document.getElementById('productCategory');
    if (!dropdown) return;
    
    const currentValue = dropdown.value;
    dropdown.innerHTML = '';
    
    if (categories.length === 0) {
        dropdown.innerHTML = '<option value="">No categories available</option>';
        return;
    }
    
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = category.name;
        dropdown.appendChild(option);
    });
    
    // Restore previous selection if it still exists
    if (currentValue && categories.find(c => c.id === currentValue)) {
        dropdown.value = currentValue;
    }
}

// Update product category dropdown with collections and subcategories
function updateProductCategoryFromCollections(collections) {
    const dropdown = document.getElementById('productCategory');
    if (!dropdown) return;
    
    const currentValue = dropdown.value;
    dropdown.innerHTML = '';
    
    if (!collections || collections.length === 0) {
        dropdown.innerHTML = '<option value="">No collections available</option>';
        return;
    }
    
    // Sort collections by order
    collections.sort((a, b) => (a.order || 0) - (b.order || 0));
    
    collections.forEach(collection => {
        // Add collection as optgroup
        const optgroup = document.createElement('optgroup');
        optgroup.label = collection.name;
        
        if (collection.subcategories && collection.subcategories.length > 0) {
            collection.subcategories
                .sort((a, b) => (a.order || 0) - (b.order || 0))
                .forEach(sub => {
                    const option = document.createElement('option');
                    option.value = sub.id;
                    option.textContent = sub.name;
                    optgroup.appendChild(option);
                });
        }
        
        dropdown.appendChild(optgroup);
    });
    
    // Restore previous selection if it still exists
    if (currentValue) {
        dropdown.value = currentValue;
    }
}

// Collections Management
async function loadCollections() {
    try {
        const collections = await apiCall('/collections');
        originalData.collections = JSON.parse(JSON.stringify(collections)); // Deep copy
        
        const container = document.getElementById('collectionsList');
        if (!container) return;
        
        container.innerHTML = '';

        if (collections.length === 0) {
            container.innerHTML = '<p>No collections found. Add your first collection!</p>';
            return;
        }

        collections.sort((a, b) => (a.order || 0) - (b.order || 0));
        
        collections.forEach(collection => {
            const card = createCollectionCard(collection);
            container.appendChild(card);
        });
        
        // Update the product form dropdown with collections
        updateProductCategoryFromCollections(collections);
    } catch (error) {
        console.error('Error loading collections:', error);
        const container = document.getElementById('collectionsList');
        if (container) {
            container.innerHTML = '<p class="error">Error loading collections.</p>';
        }
    }
}

function createCollectionCard(collection) {
    const div = document.createElement('div');
    div.className = 'item-card collection-card';
    div.style.cssText = 'background: white; border-radius: 10px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-bottom: 15px;';
    
    const subcategoriesHtml = collection.subcategories && collection.subcategories.length > 0
        ? collection.subcategories
            .sort((a, b) => (a.order || 0) - (b.order || 0))
            .map(sub => `<span style="background: #f0f0f0; padding: 4px 10px; border-radius: 15px; font-size: 0.85rem; margin: 3px;">${sub.name}</span>`)
            .join('')
        : '<span style="color: #999; font-size: 0.9rem;">No sub-categories</span>';
    
    div.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
            <div>
                <h3 style="margin: 0 0 5px 0; color: #2c1810;">${collection.name}</h3>
                <small style="color: #666;">Order: ${collection.order || 'Not set'}</small>
            </div>
            <div class="item-actions" style="display: flex; gap: 8px;">
                <button class="btn btn-secondary" onclick="editCollection('${collection.id}')" style="padding: 6px 12px; font-size: 0.85rem;">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-danger" onclick="deleteCollection('${collection.id}')" style="padding: 6px 12px; font-size: 0.85rem;">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 5px;">
            ${subcategoriesHtml}
        </div>
    `;
    return div;
}

function openCollectionModal(collectionId = null) {
    const modal = document.getElementById('collectionModal');
    const title = document.getElementById('collectionModalTitle');
    const form = document.getElementById('collectionForm');
    
    form.reset();
    document.getElementById('collectionId').value = '';
    document.getElementById('subcategoriesForm').innerHTML = '';
    
    if (collectionId) {
        title.textContent = 'Edit Collection';
        loadCollectionData(collectionId);
    } else {
        title.textContent = 'Add Collection';
        // Add one empty subcategory field
        addSubcategoryField();
    }
    
    modal.classList.add('active');
}

async function loadCollectionData(collectionId) {
    try {
        const collection = originalData.collections.find(c => c.id === collectionId);
        
        if (!collection) {
            showNotification('Collection not found', 'error');
            return;
        }
        
        document.getElementById('collectionId').value = collection.id;
        document.getElementById('collectionName').value = collection.name;
        document.getElementById('collectionOrder').value = collection.order || '';
        
        // Render subcategories
        const subcategoriesContainer = document.getElementById('subcategoriesForm');
        subcategoriesContainer.innerHTML = '';
        
        if (collection.subcategories && collection.subcategories.length > 0) {
            collection.subcategories.forEach(sub => {
                addSubcategoryField(sub.name, sub.order);
            });
        } else {
            addSubcategoryField();
        }
    } catch (error) {
        showNotification('Error loading collection', 'error');
    }
}

function addSubcategoryField(name = '', order = '') {
    const container = document.getElementById('subcategoriesForm');
    const index = container.children.length;
    
    const div = document.createElement('div');
    div.className = 'subcategory-item';
    div.style.cssText = 'display: flex; gap: 10px; margin-bottom: 10px; align-items: center;';
    div.innerHTML = `
        <input type="text" class="subcategory-name" value="${name}" placeholder="Sub-category name (e.g., Kancheepuram Silk)" style="flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
        <input type="number" class="subcategory-order" value="${order}" placeholder="#" style="width: 60px; padding: 10px; border: 1px solid #ddd; border-radius: 5px;" min="1">
        <button type="button" class="btn btn-danger" onclick="this.parentElement.remove()" style="padding: 8px 12px;">
            <i class="fas fa-times"></i>
        </button>
    `;
    container.appendChild(div);
}

function getSubcategoriesFromForm() {
    const items = document.querySelectorAll('#subcategoriesForm .subcategory-item');
    const subcategories = [];
    
    items.forEach((item, index) => {
        const name = item.querySelector('.subcategory-name').value.trim();
        const order = item.querySelector('.subcategory-order').value;
        
        if (name) {
            subcategories.push({
                id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
                name: name,
                order: order ? parseInt(order) : index + 1
            });
        }
    });
    
    return subcategories;
}

document.getElementById('collectionForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const collectionId = document.getElementById('collectionId').value;
    const collectionName = document.getElementById('collectionName').value.trim();
    const collectionOrder = document.getElementById('collectionOrder').value;
    const subcategories = getSubcategoriesFromForm();
    
    if (!collectionName) {
        showNotification('Collection name is required', 'error');
        return;
    }
    
    try {
        const collectionData = {
            name: collectionName,
            order: collectionOrder ? parseInt(collectionOrder) : undefined,
            subcategories: subcategories
        };

        if (collectionId) {
            // Update existing collection
            await apiCall(`/collections?id=${collectionId}`, 'PUT', collectionData);
            showNotification('Collection updated successfully!', 'success');
        } else {
            // Add new collection
            await apiCall('/collections', 'POST', collectionData);
            showNotification('Collection added successfully!', 'success');
        }
        
        closeModal('collectionModal');
        loadCollections();
    } catch (error) {
        showNotification('Error saving collection: ' + error.message, 'error');
    }
});

async function deleteCollection(collectionId) {
    if (!confirm('Are you sure you want to delete this collection and all its sub-categories?')) return;

    try {
        await apiCall(`/collections?id=${collectionId}`, 'DELETE');
        showNotification('Collection deleted successfully!', 'success');
        loadCollections();
    } catch (error) {
        showNotification('Error deleting collection: ' + error.message, 'error');
    }
}

function editCollection(collectionId) {
    openCollectionModal(collectionId);
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
        submitBtn.textContent = 'Saving hero image...';
        
        const imageUrl = document.getElementById('heroImage').value.trim();
        
        // Validate that URL is provided (either uploaded or manually entered)
        if (!imageUrl) {
            showNotification('Please upload an image or provide an image URL', 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
            return;
        }
        
        const finalImageUrl = imageUrl;
        
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
        
        // Site Name
        if (displayContent.siteName) {
            const siteNameInput = document.getElementById('siteName');
            if (siteNameInput) siteNameInput.value = displayContent.siteName;
        }
        
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
        
        // Policies
        if (displayContent.policies) {
            const policyDisclaimer = document.getElementById('policyDisclaimer');
            const policyShipping = document.getElementById('policyShipping');
            const policyReturns = document.getElementById('policyReturns');
            const policyRefund = document.getElementById('policyRefund');
            
            if (policyDisclaimer && displayContent.policies.disclaimer) {
                policyDisclaimer.value = displayContent.policies.disclaimer.content || '';
            }
            if (policyShipping && displayContent.policies.shipping) {
                policyShipping.value = displayContent.policies.shipping.content || '';
            }
            if (policyReturns && displayContent.policies.returns) {
                policyReturns.value = displayContent.policies.returns.content || '';
            }
            if (policyRefund && displayContent.policies.refund) {
                policyRefund.value = displayContent.policies.refund.content || '';
            }
        }
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
        
        const finalLogoUrl = document.getElementById('siteLogoUrl').value.trim() || 'assets/images/logo.svg';
        
        const contentData = {
            siteName: document.getElementById('siteName')?.value.trim() || 'ShreeAdvaya',
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
            whatsapp: document.getElementById('whatsappNumber').value.trim(),
            policies: {
                disclaimer: {
                    title: 'Disclaimer',
                    content: document.getElementById('policyDisclaimer')?.value.trim() || ''
                },
                shipping: {
                    title: 'Shipping & Delivery',
                    content: document.getElementById('policyShipping')?.value.trim() || ''
                },
                returns: {
                    title: 'Return & Exchange Policy',
                    content: document.getElementById('policyReturns')?.value.trim() || ''
                },
                refund: {
                    title: 'Refund Policy',
                    content: document.getElementById('policyRefund')?.value.trim() || ''
                }
            }
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

// Image preview handlers removed - using URL-based images only

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
    
    // Setup image preview and drag-and-drop
    setupImagePreviewListeners();
    setupDragAndDrop();
}

// Update pending changes count
function updatePendingCount() {
    let count = 0;
    count += pendingChanges.products.create.length + pendingChanges.products.update.length + pendingChanges.products.delete.length;
    count += pendingChanges.categories.create.length + pendingChanges.categories.update.length + pendingChanges.categories.delete.length;
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
        pendingChanges.categories = { create: [], update: [], delete: [] };
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
        
        // Categories
        if (pendingChanges.categories.create.length > 0 || 
            pendingChanges.categories.update.length > 0 || 
            pendingChanges.categories.delete.length > 0) {
            batchData.categories = {
                create: pendingChanges.categories.create.map(item => {
                    const { id, ...itemData } = item; // Remove temp ID
                    return itemData;
                }),
                update: pendingChanges.categories.update,
                delete: pendingChanges.categories.delete.filter(id => !id.startsWith('temp_'))
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
        pendingChanges.categories = { create: [], update: [], delete: [] };
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
