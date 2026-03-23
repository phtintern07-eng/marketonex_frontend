document.addEventListener('DOMContentLoaded', () => {
    // Check if we should auto-open Add Product modal (after login redirect)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('openAddProduct') === 'true') {
        // Wait for modal elements to be ready
        setTimeout(() => {
            const productFormModal = document.getElementById('product-form-modal');
            const step1 = document.getElementById('step-1');

            if (productFormModal && step1) {
                // Hide all steps first
                const allSteps = document.querySelectorAll('[id^="step-"]');
                allSteps.forEach(step => step.classList.add('hidden'));

                // Show step 1
                step1.classList.remove('hidden');

                // Show modal
                productFormModal.classList.remove('hidden');
                document.body.style.overflow = 'hidden';

                // Clean up URL
                window.history.replaceState({}, document.title, window.location.pathname);
            } else {
                console.error('[AUTO-OPEN] Modal or step elements not found');
            }
        }, 500);
    }

    // --- 1. Theme Toggle ---
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const themeDropdown = document.getElementById('theme-dropdown');

    // Always apply to <html> so that [data-theme] CSS selectors work correctly
    const savedTheme = localStorage.getItem('marketonex-theme') || 'dark';
    setTheme(savedTheme);

    function setTheme(theme) {
        // Apply to <html> (documentElement) so CSS [data-theme] selectors match
        document.documentElement.setAttribute('data-theme', theme);
        try { localStorage.setItem('marketonex-theme', theme); } catch (e) { }

        // Update toggle button icon
        if (themeToggleBtn) {
            const icon = themeToggleBtn.querySelector('i');
            if (icon) {
                if (theme === 'dark') icon.className = 'fas fa-moon';
                else if (theme === 'brown') icon.className = 'fas fa-coffee';
                else icon.className = 'fas fa-sun';
            }
        }

        // Mark active button in dropdown
        if (themeDropdown) {
            themeDropdown.querySelectorAll('button').forEach(btn => {
                if (btn.getAttribute('data-theme') === theme) {
                    btn.classList.add('theme-active');
                } else {
                    btn.classList.remove('theme-active');
                }
            });
        }
    }

    if (themeToggleBtn && themeDropdown) {
        themeToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            themeDropdown.classList.toggle('hidden');
        });

        themeDropdown.querySelectorAll('button').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const theme = button.getAttribute('data-theme');
                setTheme(theme);
                themeDropdown.classList.add('hidden');
            });
        });

        document.addEventListener('click', (e) => {
            if (!themeToggleBtn.contains(e.target) && !themeDropdown.contains(e.target)) {
                themeDropdown.classList.add('hidden');
            }
        });
    }

    // --- 2. Filter Collapsible Headers ---
    const collapsibleHeaders = document.querySelectorAll('.collapsible-header');

    collapsibleHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const filterList = header.nextElementSibling;
            const icon = header.querySelector('i');

            if (filterList) {
                if (filterList.style.maxHeight) {
                    filterList.style.maxHeight = null;
                    icon.classList.remove('fa-chevron-down');
                    icon.classList.add('fa-chevron-up');
                } else {
                    filterList.style.maxHeight = filterList.scrollHeight + "px";
                    icon.classList.remove('fa-chevron-up');
                    icon.classList.add('fa-chevron-down');
                }
            }
        });
    })

    // --- API Product Fetching (Load from Backend Database) ---
    let cachedProducts = null;
    let cacheTimestamp = null;
    const CACHE_DURATION = 30000; // 30 seconds cache

    /**
     * Fetch all products from backend API
     * @param {boolean} forceRefresh - Force refresh cache
     * @returns {Promise<Array>} Array of products from database
     */
    async function fetchProductsFromAPI(forceRefresh = false) {
        try {
            // Return cached data if valid and not forcing refresh
            const now = Date.now();
            if (!forceRefresh && cachedProducts && cacheTimestamp && (now - cacheTimestamp < CACHE_DURATION)) {
                return cachedProducts;
            }

            // Use dynamic base URL
            const baseUrl = window.API_BASE_URL || '';
            const response = await fetch(`${baseUrl}/api/marketonex/products`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('[API] Received response:', data);

            // Extract products array from response
            const products = data.products || [];

            // Transform backend product format to frontend format
            const transformedProducts = products.map(p => ({
                id: p.id || p.product_id,
                product_id: p.product_id || p.id,
                name: p.product_name || p.name,
                product_name: p.product_name || p.name,
                description: p.product_description || p.description || '',
                price: parseFloat(p.price) || 0,
                stock: parseInt(p.available_stock) || 0,
                available_stock: parseInt(p.available_stock) || 0,
                category: p.product_category || p.category || 'General',
                product_category: p.product_category || p.category || 'General',
                component: p.product_component || p.component || '',
                product_component: p.product_component || p.component || '',
                brand: p.brand_name || p.brand || '',
                brand_name: p.brand_name || p.brand || '',
                model: p.model_number || p.model || '',
                model_number: p.model_number || p.model || '',
                warranty: p.warranty_details || p.warranty || '',
                warranty_details: p.warranty_details || p.warranty || '',
                vendor: p.company_name || p.vendor || 'Unknown Vendor',
                company_name: p.company_name || p.vendor || 'Unknown Vendor',
                vendor_id: p.vendor_id || p.user_id,
                user_id: p.user_id || p.vendor_id,
                ownerEmail: p.registered_user || '',
                rating: parseFloat(p.rating) || 4.5,
                discount: parseFloat(p.discount) || 0,
                // Handle images - parse JSON if string
                images: (() => {
                    try {
                        const imgs = typeof p.product_images === 'string' ? JSON.parse(p.product_images) : p.product_images;
                        return Array.isArray(imgs) ? imgs : [];
                    } catch {
                        return [];
                    }
                })(),
                image: (() => {
                    try {
                        const imgs = typeof p.product_images === 'string' ? JSON.parse(p.product_images) : p.product_images;
                        const imgArray = Array.isArray(imgs) ? imgs : [];
                        return imgArray.length > 0 ? imgArray[0] : `https://picsum.photos/400/400?random=${Math.random()}`;
                    } catch {
                        return `https://picsum.photos/400/400?random=${Math.random()}`;
                    }
                })(),
                // Handle colors
                colors: (() => {
                    try {
                        const colors = typeof p.color_variants === 'string' ? JSON.parse(p.color_variants) : p.color_variants;
                        return Array.isArray(colors) ? colors : [];
                    } catch {
                        return [];
                    }
                })(),
                // Handle features
                features: (() => {
                    if (typeof p.features === 'string') {
                        return p.features.split('\n').filter(f => f.trim());
                    }
                    return Array.isArray(p.features) ? p.features : [];
                })(),
                dateAdded: p.created_at || p.dateAdded || new Date().toISOString(),
                created_at: p.created_at || p.dateAdded || new Date().toISOString(),
                reviews: [] // Reviews would be fetched separately if needed
            }));

            // Update cache
            cachedProducts = transformedProducts;
            cacheTimestamp = now;

            return transformedProducts;

        } catch (error) {
            console.error('[API] Error fetching products:', error);
            // Return cached data if available, otherwise empty array
            if (cachedProducts) {
                console.warn('[API] Returning stale cached data due to error');
                return cachedProducts;
            }
            return [];
        }
    }

    /**
     * Invalidate product cache (call after adding/deleting products)
     */
    function invalidateProductCache() {
        console.log('[API] Cache invalidated');
        cachedProducts = null;
        cacheTimestamp = null;
    }




    // --- 3. Price Range Slider Interaction ---
    const priceSlider = document.getElementById('price-range-slider');
    const priceLabels = document.querySelector('.price-labels');

    const updatePriceLabels = (value) => {
        if (!priceLabels) return;
        const maxLabelSpan = priceLabels.querySelectorAll('span')[1];
        if (maxLabelSpan) {
            maxLabelSpan.textContent = `₹${value}`;
        }
    };

    if (priceSlider) {
        updatePriceLabels(priceSlider.value);
        priceSlider.addEventListener('input', (e) => {
            updatePriceLabels(e.target.value);
        });
    }

    // --- 4. Product Carousel Scrolling (for Trending Section) ---
    const carousel = document.querySelector('.product-carousel');
    const leftBtn = document.querySelector('.slider-btn.left');
    const rightBtn = document.querySelector('.slider-btn.right');

    if (carousel && leftBtn && rightBtn) {
        const scrollDistance = 300;

        leftBtn.addEventListener('click', () => {
            carousel.scrollBy({ left: -scrollDistance, behavior: 'smooth' });
        });

        rightBtn.addEventListener('click', () => {
            carousel.scrollBy({ left: scrollDistance, behavior: 'smooth' });
        });
    }

    // --- 4a. Render Trending Products ---
    async function renderTrendingProducts() {
        if (!carousel) return;

        try {
            // Fetch products from backend API
            const allProducts = await fetchProductsFromAPI();

            if (allProducts.length === 0) {
                carousel.innerHTML = '<p style="padding: 40px; text-align: center; color: #999;">No products available yet. Add products to see them here!</p>';
                return;
            }

            // Calculate trending score based on rating and recent activity
            const productsWithScore = allProducts.map(product => {
                const rating = parseFloat(product.rating) || 0;
                const reviewCount = (product.reviews && product.reviews.length) || 0;
                // Simple trending score: rating * (1 + log(reviewCount + 1))
                const trendingScore = rating * (1 + Math.log10(reviewCount + 1));
                return { ...product, trendingScore };
            });

            // Sort by trending score
            productsWithScore.sort((a, b) => b.trendingScore - a.trendingScore);

            // Take top 8 trending products
            const displayProducts = productsWithScore.slice(0, 8);

            if (displayProducts.length === 0) {
                carousel.innerHTML = '<p style="padding: 40px; text-align: center; color: #999;">No trending products yet. Products with high ratings and recent reviews will appear here!</p>';
                return;
            }

            carousel.innerHTML = displayProducts.map(product => {
                const hasDiscount = product.discount && product.discount > 0;
                const discountPrice = hasDiscount ? (product.price * (1 - product.discount / 100)).toFixed(2) : product.price;

                return `
                    <div class="trending-card" data-id="${product.id}">
                        <div class="trending-image">
                            <img src="${product.image || 'https://picsum.photos/300/300?random=' + Math.random()}" alt="${product.name}">
                            ${hasDiscount ? `<span class="trending-badge discount">-${product.discount}%</span>` : ''}
                            <span class="trending-badge hot">🔥 Trending</span>
                        </div>
                        <div class="trending-info">
                            <span class="trending-category">${product.category}</span>
                            <h3 class="trending-name">${product.name}</h3>
                            <p class="trending-vendor">${product.vendor || 'Unknown Vendor'}</p>
                            <div class="trending-footer">
                                <div class="trending-price-section">
                                    <span class="trending-price">₹${discountPrice}</span>
                                    ${hasDiscount ? `<span class="trending-original-price">₹${product.price}</span>` : ''}
                                </div>
                                <div class="trending-rating">
                                    <i class="fas fa-star"></i>
                                    <span>${product.rating}</span>
                                    <span class="review-count">(${product.reviews ? product.reviews.length : 0})</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            // Add click handlers to trending cards
            carousel.querySelectorAll('.trending-card').forEach(card => {
                card.addEventListener('click', async (e) => {
                    const productId = card.dataset.id;
                    const product = displayProducts.find(p => p.id == productId);
                    if (product) {
                        openProductDetail(product);
                    }
                });
            });

            console.log(`Rendered ${displayProducts.length} trending products from database`);
        } catch (error) {
            console.error('Error rendering trending products:', error);
            carousel.innerHTML = '<p style="padding: 40px; text-align: center; color: #999;">Unable to load trending products</p>';
        }
    }



    // --- 5. Add Product Form Modal Logic ---
    const addProductBtn = document.getElementById('add-product-btn');
    const productFormModal = document.getElementById('product-form-modal');
    const confirmVendorBtn = document.getElementById('confirm-vendor-btn');
    const nextStepBtn = document.getElementById('next-step-btn'); // New button for step 2 to 3

    const formSteps = {
        1: document.getElementById('step-1'),
        2: document.getElementById('step-2'),
        3: document.getElementById('step-3')
    };

    let currentStep = 1;

    // Function to navigate form steps
    function goToStep(stepNumber) {
        Object.values(formSteps).forEach(step => step.classList.add('hidden'));
        if (formSteps[stepNumber]) {
            formSteps[stepNumber].classList.remove('hidden');
            currentStep = stepNumber;
        }
    }

    // Show the Add Product page (redirect to dedicated page)
    if (addProductBtn) {
        addProductBtn.addEventListener('click', async (e) => {

            // Check authentication status from backend
            try {
                const baseUrl = window.API_BASE_URL || '';
                const authResponse = await fetch(`${baseUrl}/api/auth/status`, {
                    credentials: 'include'
                });
                const authStatus = await authResponse.json();

                if (!authStatus.isAuthenticated) {
                    console.log('[ADD PRODUCT] Not authenticated - redirecting to login');
                    alert('Please log in to add products.');
                    sessionStorage.setItem('returnAfterLogin', 'add_product_marketonex.html');
                    window.location.href = 'login.html';
                    return;
                }

                console.log('[ADD PRODUCT] User authenticated:', authStatus.user);

                // Check if user is a vendor
                if (authStatus.user.role !== 'vendor') {
                    console.log('[ADD PRODUCT] User is not a vendor');
                    alert('Only vendors can add products. Please create a vendor account.');
                    return;
                }

                // Check if vendor is verified
                if (!authStatus.user.verified) {
                    console.log('[ADD PRODUCT] Vendor not verified');
                    alert('Your vendor account is pending admin approval. Please wait for verification or complete your KYC.');
                    window.location.href = '../vendor/verification_biz_verification_website_editor.html';
                    return;
                }

                // All checks passed - redirect to Add Product page
                console.log('[ADD PRODUCT] All checks passed - redirecting to add product page');
                sessionStorage.setItem('canAddProduct', 'true'); // Set permission for the add product page
                window.location.href = 'add_product_marketonex.html';

            } catch (err) {
                console.error('[ADD PRODUCT] Auth check failed:', err);
                alert('Please log in to add products.');
                sessionStorage.setItem('returnAfterLogin', 'add_product_marketonex.html');
                window.location.href = 'login.html';
                return;
            }
        });
    }


    // Function to generate unique Product ID: DDMMYYYY + 6 random digits
    function generateProductId() {
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();

        // Generate 6 random digits
        const randomDigits = Math.floor(100000 + Math.random() * 900000);

        return `${day}${month}${year}${randomDigits}`;
    }

    // --- Category-Component Dropdown System ---
    // Component values MUST match PC Builder expectations exactly
    // PC Builder uses: cpu, cpu_cooler, motherboard, memory, storage, video_card, case, power_supply, os, monitor, peripherals, accessories
    const categoryComponentMap = {
        'Input Devices': ['peripherals'],
        'Output Devices': ['monitor', 'peripherals'],
        'Processing Devices': ['cpu', 'video_card'],
        'Storage Devices': ['storage'],
        'Memory Devices': ['memory'],
        'Networking Devices': ['peripherals'],
        'Power Components': ['power_supply'],
        'Cooling Components': ['cpu_cooler'],
        'Expansion Components': ['motherboard', 'peripherals'],
        'Peripheral Devices': ['peripherals'],
        'Multimedia Devices': ['peripherals'],
        'Computer Cases': ['case'],
        'Operating Systems': ['os'],
        'Accessories': ['accessories']
    };

    const productCategorySelect = document.getElementById('product-category');
    const productComponentSelect = document.getElementById('product-component');

    if (productCategorySelect && productComponentSelect) {
        productCategorySelect.addEventListener('change', function () {
            const selectedCategory = this.value;

            // Clear existing options
            productComponentSelect.innerHTML = '<option value="">Select a component</option>';

            if (selectedCategory && categoryComponentMap[selectedCategory]) {
                // Enable the component dropdown
                productComponentSelect.disabled = false;

                // Populate with components for the selected category
                categoryComponentMap[selectedCategory].forEach(component => {
                    const option = document.createElement('option');
                    option.value = component;
                    // Display human-readable name but store PC Builder value
                    const displayNames = {
                        'cpu': 'CPU',
                        'cpu_cooler': 'CPU Cooler',
                        'motherboard': 'Motherboard',
                        'memory': 'Memory (RAM)',
                        'storage': 'Storage (HDD/SSD)',
                        'video_card': 'Video Card (GPU)',
                        'case': 'Case',
                        'power_supply': 'Power Supply (PSU)',
                        'os': 'Operating System',
                        'monitor': 'Monitor',
                        'peripherals': 'Peripherals',
                        'accessories': 'Accessories'
                    };
                    option.textContent = displayNames[component] || component;
                    productComponentSelect.appendChild(option);
                });
            } else {
                // Disable if no category selected
                productComponentSelect.disabled = true;
                productComponentSelect.innerHTML = '<option value="">Select category first</option>';
            }
        });
    }


    // --- Build PC Button Navigation ---
    const buildPcBtn = document.getElementById('build-pc-btn');
    if (buildPcBtn) {
        buildPcBtn.addEventListener('click', () => {
            window.location.href = 'builder.html';
        });
    }

    // Handle "Back" button on Step 1 (Closes modal without clearing data)
    const backToMarketonexBtn = document.getElementById('back-to-marketonex-btn');
    if (backToMarketonexBtn) {
        backToMarketonexBtn.addEventListener('click', () => {
            productFormModal.classList.add('hidden');
            document.body.style.overflow = '';
        });
    }

    // Handle vendor verification button click (Step 1 to Step 2)
    if (confirmVendorBtn) {
        confirmVendorBtn.addEventListener('click', () => {
            if (currentStep === 1) {
                // Generate and populate Product ID
                const productId = generateProductId();
                const productIdInput = document.getElementById('product-id');
                if (productIdInput) {
                    productIdInput.value = productId;
                }

                goToStep(2);
                if (productFormModal) {
                    productFormModal.scrollTo(0, 0);
                }
            }
        });
    }

    // Handle "Next Step" button click (Step 2 to Step 3)
    if (nextStepBtn) {
        nextStepBtn.addEventListener('click', () => {
            if (currentStep === 2) {
                goToStep(3);
                if (productFormModal) {
                    productFormModal.scrollTo(0, 0);
                }
            }
        });
    }

    // Handle "Back" buttons
    const backToStep1Btn = document.getElementById('back-to-step-1-btn');
    if (backToStep1Btn) {
        backToStep1Btn.addEventListener('click', () => {
            goToStep(1);
            productFormModal.scrollTo(0, 0);
        });
    }

    const backToStep2Btn = document.getElementById('back-to-step-2-btn');
    if (backToStep2Btn) {
        backToStep2Btn.addEventListener('click', () => {
            goToStep(2);
            productFormModal.scrollTo(0, 0);
        });
    }

    // --- 6. Image Upload Functionality ---
    const imageInput = document.getElementById('product-images');
    const imageUploadTrigger = document.getElementById('image-upload-trigger');
    const imagePreviewContainer = document.getElementById('image-preview-container');
    let selectedImages = []; // Store selected image files

    // Trigger file input when clicking the upload box
    if (imageUploadTrigger && imageInput) {
        imageUploadTrigger.addEventListener('click', () => {
            imageInput.click();
        });

        // Handle image selection
        imageInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);

            // Limit to 6 images
            if (selectedImages.length + files.length > 6) {
                alert('You can only upload up to 6 images');
                return;
            }

            files.forEach(file => {
                if (file.type.startsWith('image/')) {
                    selectedImages.push(file);
                    displayImagePreview(file);
                }
            });

            // Reset input to allow selecting the same file again
            imageInput.value = '';
        });
    }

    // Display image preview
    function displayImagePreview(file) {
        const reader = new FileReader();

        reader.onload = (e) => {
            const previewItem = document.createElement('div');
            previewItem.className = 'image-preview-item';

            const img = document.createElement('img');
            img.src = e.target.result;

            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-image';
            removeBtn.innerHTML = '×';
            removeBtn.onclick = () => removeImage(file, previewItem);

            previewItem.appendChild(img);
            previewItem.appendChild(removeBtn);
            imagePreviewContainer.appendChild(previewItem);
        };

        reader.readAsDataURL(file);
    }

    // Remove image from selection
    function removeImage(file, previewElement) {
        selectedImages = selectedImages.filter(img => img !== file);
        previewElement.remove();
    }


    // --- 6. Product Storage and Display Functions ---

    // Global Edit Product Function
    window.editProduct = async function (productId, event) {
        if (event) event.stopPropagation(); // Prevent card click

        // Store product ID in sessionStorage for the edit page
        sessionStorage.setItem('editProductId', productId);

        // Redirect to add product page in edit mode
        window.location.href = 'add_product_marketonex.html?edit=' + productId;
    };

    // Global Delete Product Function
    window.deleteProduct = async function (productId, productName, event) {
        if (event) event.stopPropagation(); // Prevent card click

        if (!confirm(`Are you sure you want to delete "${productName}"? This action cannot be undone.`)) {
            return;
        }

        try {
            // Call backend DELETE API
            const baseUrl = window.API_BASE_URL || '';
            const response = await fetch(`${baseUrl}/api/marketonex/products/${productId}`, {
                method: 'DELETE',
                credentials: 'include' // Important for session cookies
            });

            // Handle response
            if (response.ok) {
                const data = await response.json();
                console.log(`[DELETE] Success! Response:`, data);

                // Invalidate cache to force refresh from database
                invalidateProductCache();

                alert('Product deleted successfully.');

                // Reload page to refresh product list from database
                window.location.reload();

            } else if (response.status === 404) {
                // Product not in database
                console.warn(`[DELETE] Product ${productId} not found in backend (404).`);
                alert('Product not found in database. It may have already been deleted.');

                // Invalidate cache and reload to sync with database
                invalidateProductCache();
                window.location.reload();

            } else if (response.status === 401) {
                // Not authenticated
                const data = await response.json();
                alert('You must be logged in to delete products. Please log in and try again.');
                console.error('[DELETE] Authentication required:', data);

            } else if (response.status === 403) {
                // Not authorized (not owner)
                const data = await response.json();
                alert('You can only delete your own products.');
                console.error('[DELETE] Authorization failed:', data);

            } else {
                // Other errors
                const data = await response.json();
                const errorMsg = data.error || data.message || 'Failed to delete product';
                throw new Error(errorMsg);
            }

        } catch (error) {
            console.error('[DELETE] Error:', error);
            alert(`Failed to delete product: ${error.message}`);
        }
    };
    // Function to create a product card HTML
    function createProductCard(product) {
        const hasDiscount = product.discount && product.discount > 0;
        const discountPrice = hasDiscount ? (product.price * (1 - product.discount / 100)).toFixed(2) : product.price;

        // Check if current user owns this product
        // Note: ownerEmail is populated from API based on registered_user
        // We rely on backend 'isOwner' flag ideally, but here we can check if localStorage email matches ownerEmail
        const currentUserEmail = localStorage.getItem('vendorEmail');
        const isOwner = product.ownerEmail && currentUserEmail && product.ownerEmail === currentUserEmail;

        // Only show Edit and Delete buttons if user owns the product
        const productId = product.product_id || product.id;
        const productName = product.product_name || product.name;
        const ownerActionsHtml = isOwner ? `
        <div class="owner-actions" style="position: absolute; top: 10px; right: 10px; display: flex; gap: 0.5rem; z-index: 10;">
            <button class="edit-product-btn" onclick="window.editProduct('${productId}', event)" title="Edit Product" style="background: rgba(59, 130, 246, 0.9); color: white; border: none; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease;">
                <i class="fas fa-edit"></i>
            </button>
            <button class="delete-product-btn" onclick="window.deleteProduct('${productId}', '${productName.replace(/'/g, "\\'")}', event)" title="Delete Product" style="background: rgba(220, 38, 38, 0.9); color: white; border: none; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease;">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    ` : '';



        // Added data-id attribute for better lookup reliability
        return `
            <div class="product-card ${hasDiscount ? 'has-discount' : ''} ${product.stock <= 0 ? 'out-of-stock' : ''}" data-id="${productId}" data-category="${product.category}" data-component="${product.component || ''}">
                <div class="product-image-container" style="position: relative;">
                    <img src="${product.image || 'https://picsum.photos/400/400?random=' + Math.floor(Math.random() * 1000)}" alt="${product.name}">
                    ${hasDiscount ? `<span class="discount-badge">-${product.discount}%</span>` : ''}
                    ${product.stock <= 0 ? '<span class="stock-badge">Out of Stock</span>' : ''}
                    ${ownerActionsHtml}
                </div>
                <div class="product-info">
                    <span class="category-tag">${product.category}</span>
                    <p class="product-name">${product.name}</p>
                    <span class="vendor-name">${product.vendor || 'Apex Electronics'}</span>
                    <div class="price-rating">
                        <span class="price">₹${discountPrice}</span>
                        ${hasDiscount ? `<span class="original-price">₹${product.price}</span>` : ''}
                        <span class="rating"><i class="fas fa-star"></i> ${product.rating || '4.5'}</span>
                    </div>
                    <button class="add-to-cart-btn" data-product-id="${productId}">
                        <i class="fas fa-cart-plus"></i> Add to Cart
                    </button>
                </div>
            </div >
            `;
    }

    // Function to add product to grid
    function addProductToGrid(product) {
        const productGrid = document.querySelector('.product-grid');
        if (productGrid) {
            const productCard = createProductCard(product);
            productGrid.insertAdjacentHTML('afterbegin', productCard);
        }
    }

    // Load products from backend API on page load
    async function loadAndRenderProducts() {
        try {
            const products = await fetchProductsFromAPI(); // Fetches all products (cached)

            const productGrid = document.querySelector('.product-grid');
            if (!productGrid) return;

            if (products.length === 0) {
                productGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 40px; color: #999;">No products available. Be the first to add a product!</p>';
                return;
            }

            console.log(`[INIT] Loaded ${products.length} products. Initializing pagination...`);

            // Store globally
            allProductsData = products;

            // Populate vendor filter checkboxes
            if (typeof populateVendorFilter === 'function') {
                populateVendorFilter();
            }

            // Initial filter application (will render grid and pagination)
            applyFilters();

        } catch (error) {
            const productGrid = document.querySelector('.product-grid');
            if (productGrid) {
                productGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 40px; color: #f44;">Error loading products. Please refresh the page.</p>';
            }
        }
    }

    // Initialize product loading
    loadAndRenderProducts();

    // --- 12. Add Product Form - Dynamic Fields & Validation (Moved to main scope) ---
    // Dynamic Field Handler
    function setupDynamicFields(btnId, containerId, placeholder) {
        const btn = document.getElementById(btnId);
        const container = document.getElementById(containerId);

        if (!btn || !container) return; // Safely return if elements don't exist yet

        // Check if listener already attached? Basic cloning doesn't help with anonymous functions.
        // We assume this runs once. 
        // To be safe, we can use a flag or clone. Since we are in DOMContentLoaded, it runs once.

        // Remove old listeners by replacement if re-running (not needed here if clean)
        // const newBtn = btn.cloneNode(true);
        // btn.parentNode.replaceChild(newBtn, btn);

        btn.addEventListener('click', () => {
            const div = document.createElement('div');
            div.className = 'dynamic-input-row';
            div.innerHTML = `
                <input type="text" placeholder="${placeholder}" class="dynamic-input">
                <button type="button" class="remove-field-btn"><i class="fas fa-times"></i></button>
            `;


            div.querySelector('.remove-field-btn').addEventListener('click', () => {
                div.remove();
            });

            container.appendChild(div);
        });
    }

    setupDynamicFields('add-color-btn', 'color-variants-container', 'Enter color');
    setupDynamicFields('add-feature-btn', 'features-container', 'Enter feature');
    setupDynamicFields('add-inclusion-btn', 'inclusions-container', 'Enter item');

    // Validation & Collection Helper
    function collectDynamicValues(containerId) {
        const inputs = document.querySelectorAll(`#${containerId} input`);
        return Array.from(inputs).map(input => input.value.trim()).filter(val => val !== '');
    }

    // Cancel Button Logic
    const cancelBtn = document.getElementById('cancel-product-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to cancel? All entered data will be lost.')) {
                // Reset everything
                document.getElementById('add-product-form').reset();
                selectedImages = [];
                imagePreviewContainer.innerHTML = '';
                document.querySelectorAll('.dynamic-inputs-container').forEach(c => c.innerHTML = '');
                productFormModal.classList.add('hidden');
                document.body.style.overflow = '';
                goToStep(1);
            }
        });
    }

    // Capture Listener for Step 2 Validation
    const nextBtn = document.getElementById('next-step-btn');
    if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
            // Check if we are on step 2 (visible via class check or logic)
            // Ideally check currentStep, but element visibility is truth
            const step2 = document.getElementById('step-2');
            if (step2 && !step2.classList.contains('hidden')) {
                const price = document.getElementById('price').value;
                const stock = document.getElementById('available-stock').value;
                const category = document.getElementById('product-category').value;
                const component = document.getElementById('product-component').value;

                if (!price || !stock || !category || !component) {
                    e.stopImmediatePropagation(); // Stop the switching
                    alert('Please fill in Price, Stock, Category, and Component.');
                }
            }
        }, true); // Capture phase!
    }

    // Handle final form submission (Step 3)
    document.getElementById('add-product-form').addEventListener('submit', (e) => {
        e.preventDefault();

        // Only process if we are on the final step
        if (currentStep !== 3) {
            return;
        }

        if (currentStep !== 3) {
            return;
        }

        // Final Validation for Step 3
        const brandInput = document.getElementById('brand-name');
        const modelInput = document.getElementById('model-number');
        const brand = brandInput ? brandInput.value.trim() : '';
        const model = modelInput ? modelInput.value.trim() : '';

        if (!brand || !model) {
            alert('Please fill in Brand Name and Model Number.');
            return;
        }

        // Helper to compress image
        function compressImage(file, maxWidth = 800, quality = 0.6) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = (event) => {
                    const img = new Image();
                    img.src = event.target.result;
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        let width = img.width;
                        let height = img.height;

                        if (width > maxWidth) {
                            height *= maxWidth / width;
                            width = maxWidth;
                        }

                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);
                        resolve(canvas.toDataURL('image/jpeg', quality));
                    };
                    img.onerror = (err) => resolve(null); // Fail gracefully
                };
                reader.onerror = (err) => resolve(null); // Fail gracefully
            });
        }

        // Convert images to base64 for storage
        const imagesToProcess = Array.isArray(selectedImages) ? selectedImages : [];
        const imagePromises = imagesToProcess.map(file => compressImage(file));

        Promise.all(imagePromises).then(async (imageDataUrls) => {
            // Filter out failed image loads
            const validImages = imageDataUrls.filter(url => url !== null);

            // Collect form data
            const productData = {
                id: document.getElementById('product-id').value,
                name: document.getElementById('product-name').value,
                description: document.getElementById('product-description').value,
                price: parseFloat(document.getElementById('price').value) || 0,
                stock: parseInt(document.getElementById('available-stock').value) || 0,
                category: document.getElementById('product-category').value || 'General',
                component: document.getElementById('product-component').value || '',
                brand: brand,
                model: model,
                warranty: document.getElementById('warranty-details').value,
                vendor: document.getElementById('company-name').value || 'Apex Electronics',
                ownerEmail: localStorage.getItem('vendorEmail'), // Capture owner for deletion rights
                rating: (Math.random() * 1 + 4).toFixed(1), // Random rating between 4.0-5.0
                discount: 0,
                image: validImages.length > 0 ? validImages[0] : null, // Use first image
                images: validImages, // Store all images

                // New Dynamic Data
                colors: collectDynamicValues('color-variants-container'),
                features: collectDynamicValues('features-container'),
                inclusions: collectDynamicValues('inclusions-container'),

                dateAdded: new Date().toISOString()
            };

            try {
                // Save to backend database first
                if (typeof ApiService !== 'undefined') {
                    try {
                        // Map frontend field names to backend expected names
                        const backendData = {
                            product_id: productData.id,
                            product_name: productData.name,
                            product_category: productData.category,
                            product_component: productData.component,
                            product_description: productData.description,
                            price: productData.price,
                            available_stock: productData.stock,
                            brand_name: productData.brand,
                            model_number: productData.model,
                            warranty_details: productData.warranty,
                            color_variants: productData.colors || [],
                            features: productData.features ? productData.features.join('\n') : '',
                            product_images: productData.images || [],
                            company_name: productData.vendor,
                            vendor_id: productData.ownerEmail,
                            registered_user: productData.ownerEmail,
                            user_id: localStorage.getItem('userId') || null
                        };

                        await ApiService.request('/marketonex/products', 'POST', backendData);
                    } catch (apiError) {
                        alert('Warning: Product saved locally but failed to sync with database. Error: ' + apiError.message);
                    }
                }

                // Also save to IndexedDB for offline access
                await MarketonexStorage.saveProduct(productData);



                // Show success message
                alert('Product Added Successfully! Your product is now visible in marketonex and saved to the database.');

                // Clear one-time add product permission
                sessionStorage.removeItem('canAddProduct');

                // Reset form
                document.getElementById('add-product-form').reset();

                // Clear image previews
                selectedImages = [];
                if (imagePreviewContainer) imagePreviewContainer.innerHTML = '';
                document.querySelectorAll('.dynamic-inputs-container').forEach(c => c.innerHTML = '');

                // Update vendor filter to include new vendor if necessary
                setTimeout(populateVendorFilter, 500);

                // Close modal (only if it exists - for marketonex.html)
                if (productFormModal) {
                    productFormModal.classList.add('hidden');
                    document.body.style.overflow = '';
                }

                // Reset to step 1 for next time
                goToStep(1);

                // Refresh add-to-cart buttons
                setTimeout(() => {
                    if (typeof addCartButtonsToProducts === 'function') {
                        addCartButtonsToProducts();
                    }
                }, 100);

                // Redirect back to marketonex after successful submission
                setTimeout(() => {
                    if (window.location.pathname.includes('add_product_marketonex.html')) {
                        window.location.href = 'marketonex.html';
                    }
                }, 1500);

            } catch (err) {
                console.error('Error saving product:', err);
                // QuotaExceededError is less likely with IDB but still possible if disk full
                if (err.name === 'QuotaExceededError') {
                    alert('Storage Error: Disk is full. Cannot save more images.');
                } else {
                    alert('An error occurred while saving: ' + err.message);
                }
            }
        }).catch(err => {
            alert('An error occurred while processing images: ' + err.message);
        });
    });

    // --- 7. Add to Cart Functionality ---


    function addToCart(productData, quantity = 1) {
        let cart = JSON.parse(localStorage.getItem('marketonex_cart') || '[]');

        // Prefer product_id/id for lookup
        const lookupId = productData.product_id || productData.id || productData.name;

        // Check if product already exists in cart
        const existingIndex = cart.findIndex(item => (item.id === lookupId || item.product_id === lookupId || item.name === productData.name));

        if (existingIndex >= 0) {
            cart[existingIndex].quantity += quantity;
        } else {
            cart.push({
                ...productData,
                id: lookupId, // Ensure an ID exists
                quantity: quantity
            });
        }

        localStorage.setItem('marketonex_cart', JSON.stringify(cart));
        if (typeof window.updateCartBadge === 'function') {
            window.updateCartBadge();
        }
        showToast(`${productData.name} added to cart!`, 'success');
    }

    function showToast(message, type = 'success') {
        // Create toast if it doesn't exist
        let toast = document.getElementById('toast-notification');

        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast-notification';
            toast.className = 'toast-notification';
            toast.innerHTML = `
            < i class="fas fa-check-circle" ></i >
                <span id="toast-message"></span>
        `;
            document.body.appendChild(toast);
        }

        const toastMessage = document.getElementById('toast-message');

        if (toastMessage) {
            toastMessage.textContent = message;
        }

        const icon = toast.querySelector('i');
        if (icon) {
            if (type === 'error') {
                icon.className = 'fas fa-exclamation-circle';
            } else {
                icon.className = 'fas fa-check-circle';
            }
        }

        toast.className = `toast-notification ${type} show`;

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    // Expose functions to window for inline onclick handlers (like in New Arrivals)
    window.addToCart = addToCart;
    window.showToast = showToast;

    function addCartButtonsToProducts() {
        // Get all product cards
        const productCards = document.querySelectorAll('.product-card');

        productCards.forEach(card => {
            const existingBtn = card.querySelector('.add-to-cart-btn');

            // Skip if no button exists
            if (!existingBtn) {
                // Create button if it doesn't exist (for static products)
                const productInfo = card.querySelector('.product-info');
                if (!productInfo) return;

                // Extract product data
                const name = productInfo.querySelector('.product-name')?.textContent || '';
                const priceText = productInfo.querySelector('.price')?.textContent || '₹0';
                const price = parseFloat(priceText.replace('₹', ''));
                const vendor = productInfo.querySelector('.vendor-name')?.textContent || 'Unknown';
                const category = productInfo.querySelector('.category-tag')?.textContent || 'General';
                const image = card.querySelector('img')?.src || '';
                const id = card.getAttribute('data-id') || card.dataset.id || '';

                // Create add to cart button
                const button = document.createElement('button');
                button.className = 'add-to-cart-btn';
                button.innerHTML = '<i class="fas fa-cart-plus"></i> Add to Cart';

                button.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent opening detail modal
                    addToCart({ id, name, price, vendor, category, image });
                }, { once: true });

                productInfo.appendChild(button);
                return;
            }

            // If button exists, clone it to remove old event listeners
            const button = existingBtn.cloneNode(true);
            existingBtn.parentNode.replaceChild(button, existingBtn);

            // Extract product data from card
            const productInfo = card.querySelector('.product-info');
            if (!productInfo) return;

            const name = productInfo.querySelector('.product-name')?.textContent || '';
            const priceText = productInfo.querySelector('.price')?.textContent || '₹0';
            const price = parseFloat(priceText.replace('₹', ''));
            const vendor = productInfo.querySelector('.vendor-name')?.textContent || 'Unknown';
            const category = productInfo.querySelector('.category-tag')?.textContent || 'General';
            const image = card.querySelector('img')?.src || '';
            const id = card.getAttribute('data-id') || card.dataset.id || '';

            // Attach fresh event listener with { once: true } to prevent double-firing
            button.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent opening detail modal
                // Pass id to addToCart so it's saved in localStorage
                addToCart({ id, name, price, vendor, category, image });
            }, { once: true });
        });
    }

    // --- 8. Filter Functionality ---

    let activeFilters = {
        categories: [],
        components: [],
        vendors: [],
        priceMax: 1000,
        sortBy: 'popularity',
        searchQuery: ''
    };

    // Get all products (including static and dynamic ones)
    function getAllProducts() {
        const productCards = document.querySelectorAll('.product-card');
        return Array.from(productCards).map(card => {
            const name = card.querySelector('.product-name')?.textContent || '';
            const priceText = card.querySelector('.price')?.textContent || '₹0';
            const price = parseFloat(priceText.replace('₹', ''));
            const vendor = card.querySelector('.vendor-name')?.textContent || '';
            const category = card.querySelector('.category-tag')?.textContent || '';
            const component = card.dataset.component || '';
            const ratingText = card.querySelector('.rating')?.textContent || '0';
            const rating = parseFloat(ratingText.trim());

            return { element: card, name, price, vendor, category, component, rating };
        });
    }



    // Global Pagination State
    let allProductsData = [];
    let filteredProductsData = [];
    let currentPage = 1;
    const ITEMS_PER_PAGE = 20;

    // Apply filters with priority-based sorting (Data-Driven)
    function applyFilters() {
        const products = allProductsData; // Use global data instead of DOM scraping
        const productGrid = document.querySelector('.product-grid');
        if (!productGrid) return;

        // Calculate match scores for each product
        const scoredProducts = products.map(product => {
            let matchScore = 0;
            let shouldShow = true;
            let categoryMatch = false;
            let componentMatch = false;
            let searchMatch = true;

            // Search filter (highest priority)
            if (activeFilters.searchQuery && activeFilters.searchQuery.trim() !== '') {
                const query = activeFilters.searchQuery.toLowerCase();
                const productName = (product.name || product.product_name || '').toLowerCase();
                const categoryName = (product.category || product.product_category || '').toLowerCase();
                const vendorName = (product.vendor || product.company_name || '').toLowerCase();

                searchMatch = productName.includes(query) ||
                    categoryName.includes(query) ||
                    vendorName.includes(query);

                if (!searchMatch) {
                    shouldShow = false;
                } else {
                    matchScore += 30; // High priority for search matches
                }
            }
            let vendorMatch = false;
            let priceMatch = true;

            // Category filter (multi-select)
            if (activeFilters.categories.length > 0) {
                categoryMatch = activeFilters.categories.some(cat => product.category === cat);
                if (categoryMatch) {
                    matchScore += 10; // High priority for category match
                } else {
                    shouldShow = false;
                }
            } else {
                categoryMatch = true; // No filter means all match
            }

            // Component filter (multi-select)
            if (activeFilters.components.length > 0) {
                componentMatch = activeFilters.components.some(comp => product.component === comp);
                if (componentMatch) {
                    matchScore += 10; // High priority for component match
                } else if (categoryMatch) {
                    // If category matches but component doesn't, still show but with lower priority
                    matchScore += 5;
                    shouldShow = true;
                } else {
                    shouldShow = false;
                }
            } else {
                componentMatch = true; // No filter means all match
            }

            // Vendor filter
            if (activeFilters.vendors.length > 0) {
                vendorMatch = activeFilters.vendors.some(vendor =>
                    (product.vendor || '').toLowerCase().includes(vendor.toLowerCase())
                );
                if (vendorMatch) {
                    matchScore += 5;
                } else {
                    shouldShow = false;
                }
            } else {
                vendorMatch = true;
            }

            // Price filter
            if (product.price > activeFilters.priceMax) {
                priceMatch = false;
                shouldShow = false;
            }

            // Boost score for products matching ALL filters
            const totalFilters =
                (activeFilters.categories.length > 0 ? 1 : 0) +
                (activeFilters.components.length > 0 ? 1 : 0) +
                (activeFilters.vendors.length > 0 ? 1 : 0);

            const matchedFilters =
                (categoryMatch ? 1 : 0) +
                (componentMatch ? 1 : 0) +
                (vendorMatch ? 1 : 0);

            if (totalFilters > 0 && matchedFilters === totalFilters && priceMatch) {
                matchScore += 20; // Bonus for matching ALL active filters
            }

            return {
                product,
                matchScore,
                shouldShow
            };
        });

        // Sort by match score (highest first)
        scoredProducts.sort((a, b) => b.matchScore - a.matchScore);

        // Filter out hidden items and extract product data
        filteredProductsData = scoredProducts
            .filter(item => item.shouldShow)
            .map(item => item.product);

        // Apply additional sorting (Price, Popularity, etc.)
        applySortingData();

        // Reset to page 1 and Render
        currentPage = 1;
        renderPaginationGrid();
    }

    // Helper to sort filteredProductsData based on activeFilters.sortBy
    function applySortingData() {
        filteredProductsData.sort((a, b) => {
            switch (activeFilters.sortBy) {
                case 'price-low':
                    return a.price - b.price;
                case 'price-high':
                    return b.price - a.price;
                case 'popularity':
                    return (b.rating || 0) - (a.rating || 0);
                case 'newest':
                    return 0; // Already roughly sorted or keep original
                default:
                    return 0;
            }
        });
    }

    // Render the grid with pagination
    function renderPaginationGrid() {
        const productGrid = document.querySelector('.product-grid'); // Correct var name
        if (!productGrid) return;

        // Clear grid
        productGrid.innerHTML = '';

        const totalItems = filteredProductsData.length;

        if (totalItems === 0) {
            productGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 40px; color: #999;">No products match your filters.</p>';
            // Remove pagination if exists
            const oldPag = document.querySelector('.pagination-wrapper');
            if (oldPag) oldPag.remove();
            return;
        }

        // Calculate Slice
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        const pageItems = filteredProductsData.slice(startIndex, endIndex);

        // Render Items
        pageItems.forEach(product => {
            const cardHtml = createProductCard(product);
            productGrid.insertAdjacentHTML('beforeend', cardHtml);
        });

        // Re-attach event listeners to the new buttons
        addCartButtonsToProducts();

        // Render Pagination Controls
        renderPaginationControls(totalItems);
    }

    // Render Paginator
    function renderPaginationControls(totalItems) {
        // Remove existing pagination wrapper
        let pagWrapper = document.querySelector('.pagination-wrapper');
        if (pagWrapper) pagWrapper.remove(); // Re-create to ensure position

        const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
        if (totalPages <= 1) return; // No pagination needed

        pagWrapper = document.createElement('div');
        pagWrapper.className = 'pagination-wrapper';

        // Use Pagination Class from pagination.js if available, or custom logic
        if (typeof Pagination !== 'undefined') {
            new Pagination(pagWrapper, {
                currentPage: currentPage,
                totalPages: totalPages,
                onPageChange: (page) => {
                    currentPage = page;
                    renderPaginationGrid();
                    // Scroll to top of grid
                    const grid = document.querySelector('.product-grid');
                    if (grid) grid.scrollIntoView({ behavior: 'smooth' });
                }
            });
        } else {
            // Fallback Simple Pagination
            pagWrapper.innerHTML = `
            <button class="pagination-btn prev" ${currentPage === 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>
            <span class="pagination-info">Page ${currentPage} of ${totalPages}</span>
            <button class="pagination-btn next" ${currentPage === totalPages ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>
        `;

            pagWrapper.querySelector('.prev').addEventListener('click', () => {
                if (currentPage > 1) {
                    currentPage--;
                    renderPaginationGrid();
                    document.querySelector('.product-grid').scrollIntoView({ behavior: 'smooth' });
                }
            });

            pagWrapper.querySelector('.next').addEventListener('click', () => {
                if (currentPage < totalPages) {
                    currentPage++;
                    renderPaginationGrid();
                    document.querySelector('.product-grid').scrollIntoView({ behavior: 'smooth' });
                }
            });
        }

        // Append after grid
        const productGrid = document.querySelector('.product-grid');
        productGrid.parentNode.insertBefore(pagWrapper, productGrid.nextSibling);
        // Actually, appendChild to the parent section or insertAfter grid
    }

    // Apply sorting
    function applySorting() {
        // This function is now deprecated for the main grid, as applyFilters calls applySortingData
        // and renderPaginationGrid.
        // It might still be used by other parts of the code that directly call applySorting.
        // For the main product grid, applyFilters is the entry point.
        applyFilters(); // Re-trigger full filter/sort/render cycle
    }

    // Category filter
    const categoryCheckboxes = document.querySelectorAll('.filter-section:not(.vendor-filter):not(.price-range-filter) .checkbox-container input');
    categoryCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const label = checkbox.parentElement.textContent.trim();

            if (checkbox.checked) {
                activeFilters.categories.push(label);
            } else {
                activeFilters.categories = activeFilters.categories.filter(cat => cat !== label);
            }

            applyFilters();
        });
    });

    // 8a. Dynamic Vendor Filter Population
    async function populateVendorFilter() {
        const vendorFilterList = document.querySelector('.vendor-filter .filter-list');
        if (!vendorFilterList) return;

        // Get all products (static + saved)
        // Since getAllProducts() reads DOM, and some might be hidden or not rendered yet,
        // it's safer to merge static data + saved data manually, OR
        // just read the DOM since we render everything on load.
        // Let's rely on the DOM which is already populated.

        // Wait for potential async rendering (though typically fast enough)

        // Get unique vendors
        const products = allProductsData; // Use the globally stored data
        const vendors = new Set(products.map(p => p.vendor).filter(v => v));

        // Clear existing (except header/loader if any, but we cleared it in HTML)
        vendorFilterList.innerHTML = '';

        vendors.forEach(vendor => {
            const label = document.createElement('label');
            label.className = 'checkbox-container';
            const input = document.createElement('input');
            input.type = 'checkbox';

            // Check if active
            if (activeFilters.vendors.includes(vendor)) {
                input.checked = true;
            }

            input.addEventListener('change', () => {
                if (input.checked) {
                    activeFilters.vendors.push(vendor);
                } else {
                    activeFilters.vendors = activeFilters.vendors.filter(v => v !== vendor);
                }
                applyFilters();
            });

            label.appendChild(input);
            label.appendChild(document.createTextNode(vendor));
            vendorFilterList.appendChild(label);
        });
    }


    // --- 8b. Initialize Category Filter ---
    function initializeCategoryFilter() {
        const categoryFilterList = document.getElementById('category-filter-list');
        if (!categoryFilterList) return;

        // Clear existing
        categoryFilterList.innerHTML = '';

        // Populate with all categories
        Object.keys(categoryComponentMap).forEach(category => {
            const label = document.createElement('label');
            label.className = 'checkbox-container';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = category;
            checkbox.id = `cat - ${category.replace(/\s+/g, '-')} `;

            checkbox.addEventListener('change', function () {
                if (this.checked) {
                    activeFilters.categories.push(category);
                } else {
                    activeFilters.categories = activeFilters.categories.filter(c => c !== category);
                }

                // Update component filter based on selected categories
                updateComponentFilter();

                // Apply filters
                applyFilters();
            });

            const labelText = document.createTextNode(category);

            label.appendChild(checkbox);
            label.appendChild(labelText);
            categoryFilterList.appendChild(label);
        });
    }

    // --- 8c. Initialize Component Filter ---
    function initializeComponentFilter() {
        const componentFilterList = document.getElementById('component-filter-list');
        if (!componentFilterList) return;

        // Initially show all components from all categories
        updateComponentFilter();
    }

    // --- 8d. Update Component Filter Based on Selected Categories ---
    function updateComponentFilter() {
        const componentFilterList = document.getElementById('component-filter-list');
        if (!componentFilterList) return;

        // Get all unique components based on selected categories
        let availableComponents = new Set();

        if (activeFilters.categories.length === 0) {
            // If no categories selected, show all components
            Object.values(categoryComponentMap).forEach(components => {
                components.forEach(comp => availableComponents.add(comp));
            });
        } else {
            // Show only components from selected categories
            activeFilters.categories.forEach(category => {
                if (categoryComponentMap[category]) {
                    categoryComponentMap[category].forEach(comp => availableComponents.add(comp));
                }
            });
        }

        // Convert to sorted array
        const componentsArray = Array.from(availableComponents).sort();

        // Clear and repopulate
        componentFilterList.innerHTML = '';

        if (componentsArray.length === 0) {
            componentFilterList.innerHTML = '<p style="padding: 10px; color: #999; font-size: 13px;">Select a category first</p>';
            return;
        }

        componentsArray.forEach(component => {
            const label = document.createElement('label');
            label.className = 'checkbox-container';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = component;
            checkbox.id = `comp - ${component.replace(/\s+/g, '-').replace(/[()]/g, '')} `;

            // Preserve checked state if it was previously selected
            if (activeFilters.components.includes(component)) {
                checkbox.checked = true;
            }

            checkbox.addEventListener('change', function () {
                if (this.checked) {
                    activeFilters.components.push(component);
                } else {
                    activeFilters.components = activeFilters.components.filter(c => c !== component);
                }

                // Apply filters
                applyFilters();
            });

            const labelText = document.createTextNode(component);

            label.appendChild(checkbox);
            label.appendChild(labelText);
            componentFilterList.appendChild(label);
        });
    }

    // --- 8e. Clear All Filters ---
    function clearAllFilters() {
        // Reset activeFilters
        activeFilters.categories = [];
        activeFilters.components = [];
        activeFilters.vendors = [];

        // Uncheck all category checkboxes
        document.querySelectorAll('#category-filter-list input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
        });

        // Uncheck all component checkboxes
        document.querySelectorAll('#component-filter-list input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
        });

        // Uncheck all vendor checkboxes
        document.querySelectorAll('.vendor-filter input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
        });

        // Reset price slider
        const priceSlider = document.getElementById('price-range-slider');
        if (priceSlider) {
            priceSlider.value = 1000;
            activeFilters.priceMax = 1000;
            updatePriceLabels(1000);
        }

        // Update component filter to show all
        updateComponentFilter();

        // Apply filters (show all products)
        applyFilters();

        // Show toast
        showToast('All filters cleared', 'success');
    }

    // Initialize filters on page load
    initializeCategoryFilter();
    initializeComponentFilter();

    // Clear All Filters button
    const clearAllFiltersBtn = document.getElementById('clear-all-filters-btn');
    if (clearAllFiltersBtn) {
        clearAllFiltersBtn.addEventListener('click', clearAllFilters);
    }

    // Price range filter
    if (priceSlider) {
        priceSlider.addEventListener('change', (e) => {
            activeFilters.priceMax = parseInt(e.target.value);
            applyFilters();
        });
    }

    // Sort by filter
    const sortSelect = document.getElementById('sort-by-select');
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            activeFilters.sortBy = e.target.value;
            applyFilters(); // Re-apply filters to trigger sorting and re-render
        });
    }

    // --- 9. Popular Vendors Section ---

    // --- 9. Popular Vendors Section (Dynamic) ---

    // Initial Static Vendor Data (Fallback/Seed)
    const initialVendorsData = [
        {
            name: 'Apex Electronics',
            icon: '⚡',
            rating: 4.9,
            reviews: 1250,
            products: 156,
            totalSales: '12.5k'
        },
        {
            name: 'SoundSphere',
            icon: '🎵',
            rating: 4.8,
            reviews: 980,
            products: 89,
            totalSales: '8.2k'
        },
        {
            name: 'Terra Gear',
            icon: '🌍',
            rating: 4.7,
            reviews: 750,
            products: 124,
            totalSales: '6.8k'
        },
        {
            name: "The Potter's Wheel",
            icon: '🏺',
            rating: 4.6,
            reviews: 520,
            products: 67,
            totalSales: '4.5k'
        }
    ];

    function getVendors() {
        let savedVendors = localStorage.getItem('marketonexVendors');
        if (!savedVendors) {
            // Seed localStorage if empty
            localStorage.setItem('marketonexVendors', JSON.stringify(initialVendorsData));
            return initialVendorsData;
        }
        return JSON.parse(savedVendors);
    }

    function renderVendors() {
        const vendorsGrid = document.getElementById('vendors-grid');
        if (!vendorsGrid) return;

        let vendorsData = getVendors();

        // Sort vendors: Highest Vendor Score First (rating 70% + review count 30%)
        vendorsData.sort((a, b) => {
            const scoreA = a.vendorScore || 0;
            const scoreB = b.vendorScore || 0;
            return scoreB - scoreA;
        });

        vendorsGrid.innerHTML = vendorsData.map(vendor => `
            <div class="vendor-card">
                <div class="vendor-logo">${vendor.icon || '🏪'}</div>
                <h3 class="vendor-name">${vendor.name}</h3>
                <div class="vendor-rating">
                    <i class="fas fa-star"></i>
                    <span>${vendor.rating}</span>
                    <span style="opacity: 0.6;">(${vendor.reviews} reviews)</span>
                </div>
                <div class="vendor-stats">
                    <div class="vendor-stat">
                        <span class="vendor-stat-value">${vendor.products}</span>
                        <span class="vendor-stat-label">Products</span>
                    </div>
                    <div class="vendor-stat">
                        <span class="vendor-stat-value">${vendor.totalSales}</span>
                        <span class="vendor-stat-label">Sales</span>
                    </div>
                </div>
                <button class="visit-store-btn">
                    <i class="fas fa-store"></i> Visit Store
                </button>
            </div>
            `).join('');

        // Add event listeners to Visit Store buttons
        vendorsGrid.querySelectorAll('.visit-store-btn').forEach((btn, index) => {
            btn.addEventListener('click', () => {
            });
        });
    }

    // --- 10. New Arrivals Section ---

    async function renderNewArrivals() {
        const newArrivalsGrid = document.getElementById('new-arrivals-grid');
        if (!newArrivalsGrid) return;

        try {
            // Fetch products from backend API instead of IndexedDB
            const allProducts = await fetchProductsFromAPI();

            if (allProducts.length === 0) {
                newArrivalsGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 20px;">No products available. Add your first product!</p>';
                return;
            }

            // Filter logic: dateAdded must be within the last 5 days
            const now = new Date();
            const fiveDaysInMillis = 5 * 24 * 60 * 60 * 1000;

            const validNewArrivals = allProducts.filter(product => {
                if (!product.dateAdded && !product.created_at) return false;
                const productDate = new Date(product.dateAdded || product.created_at);
                const diffTime = now - productDate;
                return diffTime >= 0 && diffTime <= fiveDaysInMillis;
            });

            // Sort by newest first

            // Sort by date added (newest first)
            const sortedByDate = [...validNewArrivals].sort((a, b) => {
                return new Date(b.dateAdded || b.created_at) - new Date(a.dateAdded || a.created_at);
            });

            // Display all new arrivals (horizontal scroll handles overflow)
            const displayList = sortedByDate; // Removed .slice(0, 6) limit


            function getTimeAgo(date) {
                if (!date || isNaN(date.getTime())) return 'Recently';
                const diffTime = Math.abs(new Date() - date);
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                const diffHours = Math.floor(diffTime / (1000 * 60 * 60));

                if (diffDays === 0) {
                    return diffHours < 1 ? 'Just now' : `${diffHours} hours ago`;
                }
                if (diffDays === 1) return 'Yesterday';
                return `${diffDays} days ago`;
            }

            if (displayList.length === 0) {
                newArrivalsGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 20px;">No new arrivals in the last 5 days.</p>';
                return;
            }

            // Get current user email for ownership check
            const currentUserEmail = localStorage.getItem('vendorEmail');

            newArrivalsGrid.innerHTML = displayList.map(product => {
                // Check if current user owns this product
                const isOwner = product.ownerEmail && currentUserEmail && product.ownerEmail === currentUserEmail;
                const productDate = new Date(product.dateAdded || product.created_at);

                return `
            <div class="new-arrival-card">
                <div class="new-arrival-image" style="position: relative;">
                    <img src="${product.image || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22200%22%3E%3Crect fill=%22%23ddd%22 width=%22300%22 height=%22200%22/%3E%3Ctext fill=%22%23999%22 font-family=%22sans-serif%22 font-size=%2218%22 dy=%2210.5%22 font-weight=%22bold%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22%3ENo Image%3C/text%3E%3C/svg%3E'}" alt="${product.name}">
                    <span class="new-badge">NEW</span>
                    ${isOwner ? `
                    <div class="owner-actions" style="position: absolute; top: 10px; right: 10px; display: flex; gap: 0.5rem; z-index: 10;">
                        <button class="edit-product-btn" onclick="window.editProduct('${product.product_id || product.id}', event)" title="Edit Product" style="background: rgba(59, 130, 246, 0.9); color: white; border: none; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease;">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="delete-product-btn" onclick="window.deleteProduct('${product.product_id || product.id}', '${product.product_name || product.name}', event)" title="Delete Product" style="background: rgba(220, 38, 38, 0.9); color: white; border: none; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease;">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                    ` : ''}
                </div>
                <div class="new-arrival-info">
                    <span class="new-arrival-category">${product.product_category || product.category}</span>
                    <h3 class="new-arrival-name">${product.product_name || product.name}</h3>
                    <p class="new-arrival-vendor">${product.company_name || product.vendor}</p>
                    <div class="new-arrival-date">
                        <i class="fas fa-clock"></i>
                        <span>Added ${getTimeAgo(productDate)}</span>
                    </div>
                    <div class="new-arrival-footer">

                        <span class="new-arrival-price">₹${product.price ? product.price.toFixed(2) : '0.00'}</span>
                        <div class="new-arrival-rating">
                            <i class="fas fa-star"></i>
                            <span>${product.rating}</span>
                        </div>
                    </div>
                    <button class="add-to-cart-btn" 
                        data-id="${product.product_id || product.id}"
                        data-name="${(product.name || product.product_name).replace(/'/g, "\\'")}" 
                        data-price="${product.price}" 
                        data-vendor="${(product.vendor || product.company_name).replace(/'/g, "\\'")}" 
                        data-category="${(product.category || product.product_category).replace(/'/g, "\\'")}" 
                        data-image="${product.image}">
                        <i class="fas fa-cart-plus"></i> Add to Cart
                    </button>
                </div>
            </div>
    `;
            }).join('');

            // Event Listeners for New Arrivals Cart Buttons
            newArrivalsGrid.querySelectorAll('.add-to-cart-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent opening detail modal
                    const productData = {
                        id: btn.dataset.id,
                        product_id: btn.dataset.id,
                        name: btn.dataset.name,
                        price: parseFloat(btn.dataset.price),
                        vendor: btn.dataset.vendor,
                        category: btn.dataset.category,
                        image: btn.dataset.image
                    };
                    addToCart(productData);
                }, { once: true }); // Prevent double-firing
            });

            // Event Listeners for New Arrivals Cards (to open Detail View)
            newArrivalsGrid.querySelectorAll('.new-arrival-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    if (e.target.closest('.add-to-cart-btn')) return;

                    const name = card.querySelector('.new-arrival-name').textContent;
                    // Find data object
                    const product = displayList.find(p => p.name === name);
                    if (product) openProductDetail(product);
                });
            });
        } catch (error) {
            newArrivalsGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 20px;">Unable to load new arrivals</p>';
        }
    }

    // --- 11. Product Detail Modal Logic (Redesigned) ---
    const detailModal = document.getElementById('product-detail-modal');
    const closeDetailBtn = document.getElementById('close-product-detail');

    // Close modal handlers
    if (closeDetailBtn) {
        closeDetailBtn.addEventListener('click', () => {
            detailModal.classList.add('hidden');
            document.body.style.overflow = '';
        });
    }

    if (detailModal) {
        detailModal.addEventListener('click', (e) => {
            if (e.target === detailModal) {
                detailModal.classList.add('hidden');
                document.body.style.overflow = '';
            }
        });
    }

    // Function to open product detail
    function openProductDetail(productData) {
        if (!detailModal) return;

        const mainImage = document.getElementById('detail-main-image');
        const thumbnailList = document.getElementById('thumbnail-list');
        const dynamicSections = document.getElementById('detail-dynamic-sections');

        // 1. Setup Images - Display only actual uploaded images
        let images = [];

        // If product has multiple images uploaded, use them
        if (productData.images && productData.images.length > 0) {
            images = productData.images.filter(img => img && img.trim() !== '');
        }

        // If no images array but has main image, use main image only
        if (images.length === 0 && productData.image && productData.image.trim() !== '') {
            images = [productData.image];
        }

        // Ensure main product image is first if it exists and not already in array
        if (productData.image && productData.image.trim() !== '' && !images.includes(productData.image)) {
            images.unshift(productData.image);
        }

        // Remove duplicates (in case same image appears multiple times in data)
        images = [...new Set(images)];

        // Set Main Image
        if (images.length > 0) {
            mainImage.src = images[0];
            mainImage.style.opacity = '0';
            setTimeout(() => mainImage.style.opacity = '1', 100);
        } else {
            // No images available - show a proper "No Image" placeholder
            mainImage.src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22400%22%3E%3Crect fill=%22%23ddd%22 width=%22400%22 height=%22400%22/%3E%3Ctext fill=%22%23999%22 font-family=%22sans-serif%22 font-size=%2218%22 dy=%2210.5%22 font-weight=%22bold%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22%3ENo Image%3C/text%3E%3C/svg%3E';
        }

        // Render Thumbnails - only if there are multiple images
        if (images.length > 1) {
            thumbnailList.innerHTML = images.map((img, index) => `
                <img src="${img}" class="thumbnail-item ${index === 0 ? 'active' : ''}" data-index="${index}" alt="Product View ${index + 1}">
            `).join('');
        } else {
            // Single image or no images - don't show thumbnails
            thumbnailList.innerHTML = '';
        }


        // Thumbnail Click Event
        thumbnailList.querySelectorAll('.thumbnail-item').forEach(thumb => {
            thumb.addEventListener('click', () => {
                // Update active state
                thumbnailList.querySelectorAll('.thumbnail-item').forEach(t => t.classList.remove('active'));
                thumb.classList.add('active');

                // Update main image with specific animation
                mainImage.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    mainImage.src = thumb.src;
                    mainImage.style.transform = 'scale(1)';
                }, 150);
            });
        });

        // 2. Info Population
        document.getElementById('detail-category').textContent = productData.category || 'General';
        document.getElementById('detail-name').textContent = productData.name;
        document.getElementById('detail-vendor').textContent = productData.vendor || 'Unknown Vendor';
        document.getElementById('detail-rating').textContent = productData.rating || '4.5';
        document.getElementById('detail-price').textContent = `₹${productData.price ? productData.price.toFixed(2) : '0.00'}`;
        document.getElementById('detail-description').textContent = productData.description || 'No description available.';

        document.getElementById('detail-brand').textContent = productData.brand || 'Generic';
        document.getElementById('detail-model').textContent = productData.model || 'N/A';
        document.getElementById('detail-warranty').textContent = productData.warranty || 'Standard';

        // 3. Dynamic Sections (Colors, Features, Accessories)
        dynamicSections.innerHTML = ''; // Clear previous

        if (productData.colors && productData.colors.length > 0) {
            const colorDiv = document.createElement('div');
            colorDiv.style.marginBottom = '15px';
            colorDiv.innerHTML = '<span class="spec-label" style="display:block; margin-bottom:5px;">Colors:</span>';
            productData.colors.forEach(c => {
                colorDiv.innerHTML += `<span class="dynamic-tag" style="background:${c.toLowerCase()}; color:${isLight(c) ? '#000' : '#fff'}; border:1px solid #ddd;">${c}</span>`;
            });
            dynamicSections.appendChild(colorDiv);
        }

        if (productData.features && productData.features.length > 0) {
            const featDiv = document.createElement('div');
            featDiv.style.marginBottom = '15px';
            featDiv.innerHTML = '<span class="spec-label" style="display:block; margin-bottom:5px;">Features:</span>';
            productData.features.forEach(f => {
                featDiv.innerHTML += `<span class="dynamic-tag">${f}</span>`;
            });
            dynamicSections.appendChild(featDiv);
        }



        // --- Reviews Section ---
        const reviewDiv = document.createElement('div');
        reviewDiv.style.marginTop = '20px';
        reviewDiv.style.borderTop = '1px solid #eee';
        reviewDiv.style.paddingTop = '15px';
        reviewDiv.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <h4 style="margin:0;">Customer Reviews <span id="review-count">(Loading...)</span></h4>
                <div id="review-action-container"></div>
            </div>
            <div id="reviews-container"></div>
        `;
        dynamicSections.appendChild(reviewDiv);

        const reviewsContainer = reviewDiv.querySelector('#reviews-container');
        const reviewCount = reviewDiv.querySelector('#review-count');
        const actionContainer = reviewDiv.querySelector('#review-action-container');

        const baseUrl = window.API_BASE_URL || '';

        // 1. Check Review Status and User Auth
        fetch(`${baseUrl}/api/feedback/status/${productData.id}`, {
            method: 'GET',
            credentials: 'include'
        })
            .then(res => res.json())
            .then(statusData => {
                if (!statusData.is_logged_in) {
                    actionContainer.innerHTML = `<span style="font-size:0.85rem; color:#ef4444;"><i class="fas fa-info-circle"></i> Please <a href="../marketonex/login.html" style="color:var(--primary-color); text-decoration:underline;">login</a> to review</span>`;
                } else if (statusData.has_reviewed) {
                    actionContainer.innerHTML = `<span style="font-size:0.85rem; color:#10b981;"><i class="fas fa-check-circle"></i> Already reviewed</span>`;
                } else {
                    actionContainer.innerHTML = `<a href="../vendor/feedback.html?product_id=${productData.id}&product_type=${productData.product_type || 'marketonex'}" 
                    class="write-review-btn" 
                    style="font-size:0.85rem; color:white; background:var(--primary-color); padding:5px 12px; border-radius:20px; text-decoration:none; display:inline-flex; align-items:center; gap:5px; transition:all 0.2s;">
                    <i class="fas fa-pen"></i> Write a Review
                </a>`;
                }
            })
            .catch(err => { });

        // 2. Fetch and Render existing reviews
        fetch(`${baseUrl}/api/feedback/product/${productData.id}`, {
            method: 'GET',
            credentials: 'include'
        })
            .then(response => response.json())
            .then(data => {
                const reviews = data.feedback || [];
                if (reviewCount) reviewCount.textContent = `(${reviews.length})`;

                if (reviews.length > 0 && reviewsContainer) {
                    reviewsContainer.innerHTML = reviews.map(r => `
                        <div class="review-item" style="margin-bottom: 15px; background: #f9f9f9; padding: 10px; border-radius: 8px;">
                            <div style="display:flex; justify-content:space-between; margin-bottom: 5px;">
                                <span style="font-weight:600; font-size: 0.9rem;">${r.name || 'Anonymous'}</span>
                                <span style="color:#f59e0b; font-size: 0.8rem;">
                                    ${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}
                                </span>
                            </div>
                            <p style="font-size: 0.85rem; color: #555; margin: 5px 0;">${r.message}</p>
                            <span style="font-size: 0.75rem; color: #999;">${new Date(r.created_at).toLocaleDateString()}</span>
                        </div>
                    `).join('');
                } else if (reviewsContainer) {
                    reviewsContainer.innerHTML = `<p style="color:#777; font-style:italic;">No reviews yet.</p>`;
                }
            })
            .catch(error => {
                if (reviewCount) reviewCount.textContent = '(0)';
                if (reviewsContainer) {
                    reviewsContainer.innerHTML = `<p style="color:#777; font-style:italic;">Unable to load reviews.</p>`;
                }
            });

        // Helper for text color
        function isLight(color) {
            // Very basic check, normally would use substantial logic, assuming basic names
            const lights = ['white', 'yellow', 'cream', 'beige', 'light'];
            return lights.some(l => color.toLowerCase().includes(l));
        }


        // 4. Stock, Quantity & Cart Logic
        const stockEl = document.getElementById('detail-stock');
        const addToCartBtn = document.getElementById('detail-add-to-cart');
        const quantityContainer = document.querySelector('.quantity-selector');

        // Reset Quantity Input
        let qtyInput, qtyMinus, qtyPlus;
        if (quantityContainer) {
            // Clone to clear old listeners
            const newQtyContainer = quantityContainer.cloneNode(true);
            quantityContainer.parentNode.replaceChild(newQtyContainer, quantityContainer);

            qtyInput = newQtyContainer.querySelector('input');
            qtyMinus = newQtyContainer.children[0]; // Button -
            qtyPlus = newQtyContainer.children[2];  // Button +

            qtyInput.value = 1;

            qtyMinus.addEventListener('click', () => {
                let val = parseInt(qtyInput.value) || 1;
                if (val > 1) qtyInput.value = val - 1;
            });

            qtyPlus.addEventListener('click', () => {
                let val = parseInt(qtyInput.value) || 1;
                if (val < productData.stock) qtyInput.value = val + 1;
            });
        }

        if (productData.stock <= 0) {
            stockEl.textContent = 'Out of Stock';
            stockEl.className = 'stock-badge out-of-stock';
            addToCartBtn.disabled = true;
            addToCartBtn.style.opacity = '0.5';
            addToCartBtn.style.cursor = 'not-allowed';
            if (qtyInput) qtyInput.disabled = true;
        } else {
            stockEl.textContent = 'In Stock';
            stockEl.className = 'stock-badge in-stock';
            addToCartBtn.disabled = false;
            addToCartBtn.style.opacity = '1';
            addToCartBtn.style.cursor = 'pointer';
            if (qtyInput) qtyInput.disabled = false;
        }

        // Add to cart handler
        const newBtn = addToCartBtn.cloneNode(true);
        addToCartBtn.parentNode.replaceChild(newBtn, addToCartBtn);

        newBtn.addEventListener('click', () => {
            const qty = qtyInput ? parseInt(qtyInput.value) : 1;
            addToCart(productData, qty);
        });

        // Vendor Link Logic
        const vendorEl = document.getElementById('detail-vendor');
        if (vendorEl) {
            const newVendorEl = vendorEl.cloneNode(true);
            vendorEl.parentNode.replaceChild(newVendorEl, vendorEl);

            newVendorEl.style.cursor = 'pointer';
            newVendorEl.style.textDecoration = 'underline';
            newVendorEl.style.color = 'var(--primary-color)';

            newVendorEl.addEventListener('click', () => {
                // Close modal
                detailModal.classList.add('hidden');
                document.body.style.overflow = '';

                // Reset all filters first
                activeFilters.categories = [];
                activeFilters.priceMax = 5000; // Reset max

                // Set vendor
                activeFilters.vendors = [productData.vendor];

                // Update UI checkboxes
                document.querySelectorAll('.vendor-filter input').forEach(cb => {
                    const label = cb.parentElement.textContent.trim();
                    if (label === productData.vendor) {
                        cb.checked = true;
                    } else {
                        cb.checked = false;
                    }
                });

                // Trigger filter
                applyFilters();

                // Scroll to products
                const grid = document.querySelector('.product-grid');
                if (grid) grid.scrollIntoView({ behavior: 'smooth' });

                // Toast
                showToast(`Filtering by ${productData.vendor} `, 'success');
            });
        }

        // 5. Show Modal
        detailModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';

        // 6. Attach Arrow Navigation
        attachMainImageNavigation(images, mainImage);
    }

    // Thumbnail Navigation Logic
    const galleryUpBtn = document.getElementById('gallery-up');
    const galleryDownBtn = document.getElementById('gallery-down');
    const thumbList = document.getElementById('thumbnail-list');

    if (galleryUpBtn && galleryDownBtn && thumbList) {
        galleryUpBtn.addEventListener('click', () => {
            // Scroll up logic
            thumbList.scrollBy({ top: -80, behavior: 'smooth' });
            if (window.innerWidth <= 900) thumbList.scrollBy({ left: -80, behavior: 'smooth' });
        });

        galleryDownBtn.addEventListener('click', () => {
            // Scroll down logic
            thumbList.scrollBy({ top: 80, behavior: 'smooth' });
            if (window.innerWidth <= 900) thumbList.scrollBy({ left: 80, behavior: 'smooth' });
        });
    }

    // Main Image Navigation Logic (< >)
    function attachMainImageNavigation(images, mainImage) {
        const prevBtn = document.getElementById('main-image-prev');
        const nextBtn = document.getElementById('main-image-next');
        const thumbnailList = document.getElementById('thumbnail-list');

        // Remove old listeners by cloning
        if (prevBtn) {
            const newPrev = prevBtn.cloneNode(true);
            prevBtn.parentNode.replaceChild(newPrev, prevBtn);

            newPrev.addEventListener('click', () => {
                let currentSrc = mainImage.getAttribute('src'); // Use getAttribute to avoid full URL mismatch logic if src is relative
                // Find index
                // Actually easier to query the active thumbnail
                const activeThumb = thumbnailList.querySelector('.thumbnail-item.active');
                let currentIndex = 0;
                if (activeThumb) currentIndex = parseInt(activeThumb.dataset.index);

                let newIndex = currentIndex - 1;
                if (newIndex < 0) newIndex = images.length - 1; // Cycle to end

                updateMainImage(newIndex);
            });
        }

        if (nextBtn) {
            const newNext = nextBtn.cloneNode(true);
            nextBtn.parentNode.replaceChild(newNext, nextBtn);

            newNext.addEventListener('click', () => {
                const activeThumb = thumbnailList.querySelector('.thumbnail-item.active');
                let currentIndex = 0;
                if (activeThumb) currentIndex = parseInt(activeThumb.dataset.index);

                let newIndex = currentIndex + 1;
                if (newIndex >= images.length) newIndex = 0; // Cycle to start

                updateMainImage(newIndex);
            });
        }

        function updateMainImage(index) {
            // Update main image
            mainImage.style.transform = 'scale(0.95)';
            mainImage.style.opacity = '0.8';
            setTimeout(() => {
                mainImage.src = images[index];
                mainImage.style.transform = 'scale(1)';
                mainImage.style.opacity = '1';
            }, 150);

            // Update active thumbnail
            thumbnailList.querySelectorAll('.thumbnail-item').forEach(t => t.classList.remove('active'));
            const newThumb = thumbnailList.querySelector(`.thumbnail-item[data-index="${index}"]`);
            if (newThumb) {
                newThumb.classList.add('active');
                newThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        }
    }

    // ... inside openProductDetail ...
    // Note: I need to call attachMainImageNavigation inside openProductDetail because 'images' array is local there.
    // I will redefine openProductDetail partially or just append this logic if I can.
    // Since I can't easily inject into the middle of the function without replacing it, 
    // I will add a global helper or hook into it.
    // Actually, I just replaced the function in the previous step (Step 112). I should have added it then.
    // I will rewrite the end of openProductDetail to include this call.

    // Wait, the replaced content in Step 112 for 'openProductDetail' ends around line 962.
    // I can modify the 'openProductDetail' function body again to include this.



    // --- Wire up existing Product Cards to Detail View ---
    document.addEventListener('click', async (e) => {
        // traverse up to find product-card
        const card = e.target.closest('.product-card');

        // Ignore if clicking add to cart button or other interactables
        if (e.target.closest('.add-to-cart-btn') || e.target.closest('.slider-btn') || e.target.closest('.visit-store-btn') || e.target.closest('.edit-product-btn') || e.target.closest('.delete-product-btn')) return;

        if (card) {
            // Extract data from card
            const productInfo = card.querySelector('.product-info');
            if (!productInfo) return;

            const id = card.dataset.id; // Get ID from data attribute

            // Fetch products from API
            const products = await fetchProductsFromAPI();

            // Find product by ID
            let product = null;
            if (id) {
                product = products.find(p => String(p.id) === String(id) || String(p.product_id) === String(id));
            }

            if (product) {
                console.log("Opening product detail from API:", product);
                openProductDetail(product);
            } else {
                // Construct from DOM if product not in database
                const name = productInfo.querySelector('.product-name')?.textContent || '';
                const priceText = productInfo.querySelector('.price')?.textContent || '₹0';
                const price = parseFloat(priceText.replace('₹', ''));
                const vendor = productInfo.querySelector('.vendor-name')?.textContent || 'Unknown';
                const category = productInfo.querySelector('.category-tag')?.textContent || 'General';
                const image = card.querySelector('img')?.src || '';
                const ratingText = productInfo.querySelector('.rating')?.textContent || '0';
                const rating = parseFloat(ratingText.trim());

                openProductDetail({
                    name, price, vendor, category, image, rating,
                    stock: card.classList.contains('out-of-stock') ? 0 : 10,
                    description: 'Experience premium quality with this item. Features high durability and excellent performance.',
                    brand: 'Generic', model: 'Standard', warranty: '1 Year'
                });
            }
        }
    });

    // Rerun render logic
    renderVendors();
    renderNewArrivals();
    renderTrendingProducts();

    // --- Listen for Feedback Submission Events ---
    window.addEventListener('feedbackSubmitted', async (event) => {

        try {
            // Refresh trending products
            await renderTrendingProducts();

            // Refresh vendor rankings
            renderVendors();

            // Refresh new arrivals (in case product moved into trending)
            await renderNewArrivals();
        } catch (error) {
            console.error('Error updating marketonex after feedback:', error);
        }
    });

    // --- Search Functionality ---
    const searchInput = document.querySelector('.search-bar input');

    if (searchInput) {
        // Real-time search as user types - integrated with filter system
        searchInput.addEventListener('input', (e) => {
            const searchQuery = e.target.value.trim();
            activeFilters.searchQuery = searchQuery;

            // Reset to page 1 when searching
            currentPage = 1;

            // Trigger the main filter system
            applyFilters();
        });

        // Also handle Enter key
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                // Trigger input event to filter
                searchInput.dispatchEvent(new Event('input'));
            }
        });
    }

    // --- Horizontal Scrolling Helper ---
    function enableHorizontalScroll(element) {
        if (!element) return;

        let isDown = false;
        let startX;
        let scrollLeft;

        // Mouse Wheel (Vertical -> Horizontal)
        element.addEventListener('wheel', (e) => {
            // Only capture vertical scrolling if shift key is NOT pressed (native horizontal scroll uses shift)
            if (e.deltaY !== 0 && !e.shiftKey) {
                // Prevent default vertical scroll only if we can scroll horizontally
                if (element.scrollWidth > element.clientWidth) {
                    e.preventDefault();
                    element.scrollLeft += e.deltaY;
                }
            }
        });

        // Drag to Scroll
        element.addEventListener('mousedown', (e) => {
            isDown = true;
            element.classList.add('active');
            startX = e.pageX - element.offsetLeft;
            scrollLeft = element.scrollLeft;
            element.style.cursor = 'grabbing';
            // Disable pointer events on children to prevent clicking links while dragging
            element.querySelectorAll('a, button, .product-card').forEach(child => {
                child.style.pointerEvents = 'none';
            });
        });

        element.addEventListener('mouseleave', () => {
            isDown = false;
            element.classList.remove('active');
            element.style.cursor = 'grab';
            // Re-enable pointer events
            element.querySelectorAll('a, button, .product-card').forEach(child => {
                child.style.pointerEvents = '';
            });
        });

        element.addEventListener('mouseup', () => {
            isDown = false;
            element.classList.remove('active');
            element.style.cursor = 'grab';
            // Re-enable pointer events
            setTimeout(() => { // Small delay to prevent click firing immediately after drag
                element.querySelectorAll('a, button, .product-card').forEach(child => {
                    child.style.pointerEvents = '';
                });
            }, 50);
        });

        element.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - element.offsetLeft;
            const walk = (x - startX) * 2; // Scroll-fast factor
            element.scrollLeft = scrollLeft - walk;
        });

        // Set initial cursor
        element.style.cursor = 'grab';
    }

    // Apply to New Arrivals
    const newArrivalsGrid = document.getElementById('new-arrivals-grid');
    if (newArrivalsGrid) enableHorizontalScroll(newArrivalsGrid);

    // Apply to Trending Carousel
    const trendingCarousel = document.querySelector('.product-carousel');
    if (trendingCarousel) enableHorizontalScroll(trendingCarousel);

});
