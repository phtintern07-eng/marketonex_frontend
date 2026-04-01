const API_URL = window.location.protocol === 'file:' ? 'http://127.0.0.1:5000' : '';
console.log("COMMON FIX VERSION 1.0.2 LOADED");

class ApiService {
    static async request(endpoint, method = 'GET', data = null) {
        const options = {
            method,
            headers: {},
            credentials: 'include'
        };

        // Only set Content-Type header if we have data to send
        if (data) {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(data);
        }

        try {
            // Ensure endpoint starts with /
            const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
            const response = await fetch(`${API_URL}/api${path}`, options);

            let result = {};
            const text = await response.text();

            try {
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.includes("application/json") && text) {
                    result = JSON.parse(text);
                } else if (text) {
                    console.warn("Server returned non-JSON text:", text);
                }
            } catch (err) {
                console.error("JSON parse error:", err, "Raw text:", text);
                throw new Error("Invalid response format from server");
            }

            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.removeItem('vendorLoggedIn');
                    localStorage.removeItem('vendorEmail');
                }
                // Attach full response data so callers can inspect error codes
                const err = new Error(result.error || result.message || 'Something went wrong');
                err.responseData = result;
                err.status = response.status;
                throw err;
            }
            if (typeof hideLoading === 'function') hideLoading();
            return result;
        } catch (error) {
            if (typeof showError === 'function') showError(error.message);
            throw error;
        }
    }

    static async get(endpoint) { return this.request(endpoint, 'GET'); }
    static async post(endpoint, data) { return this.request(endpoint, 'POST', data); }
    static async put(endpoint, data) { return this.request(endpoint, 'PUT', data); }
    static async delete(endpoint) { return this.request(endpoint, 'DELETE'); }

    static async upload(endpoint, file) {
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch(`${API_URL}/api${endpoint}`, {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });
        const text = await response.text();
        const contentType = response.headers.get("content-type");
        let result = {};

        try {
            if (contentType && contentType.includes("application/json") && text) {
                result = JSON.parse(text);
            } else if (text) {
                console.error("Upload: server returned non-JSON:", text);
                throw new Error(`Upload failed: server returned unexpected response (${response.status}).`);
            }
        } catch (err) {
            console.error("Upload JSON parse error:", err, "Raw text:", text);
            throw new Error("Invalid upload response format");
        }

        if (!response.ok) throw new Error(result.error || 'Upload failed');
        return result;
    }

    static async getProfile() { return this.get('/profile'); }
    static async updateProfile(data) { return this.put('/profile', data); }

    static async getBusinessInfo() { return this.get('/vendor/settings'); }
    static async updateBusinessInfo(data) { return this.put('/vendor/settings', data); }
    static async uploadProfileImage(formData) { return this.upload('/upload/profile', formData); }
}

// Global User State
let currentUser = null;

// ─── Auth Check Cache ────────────────────────────────────────────────────────
// Prevents duplicate /api/auth/status calls when checkAuth() is invoked
// multiple times in the same page lifecycle (e.g. from DOMContentLoaded +
// a vendor-specific script both calling checkAuth).
let _authCache = null;          // Stores the last resolved auth result
let _authCheckPromise = null;   // Deduplicates concurrent in-flight requests

async function checkAuth() {
    const path = window.location.pathname;

    // ✅ Skip entirely on login / signup pages — these have no session yet
    // and calling /api/auth/status just adds an unnecessary DB round-trip.
    if (path.includes('loginvender.html') || path.includes('signup.html') || path.includes('login.html')) {
        return;
    }

    // ✅ Return cached result within the same page load
    if (_authCache !== null) {
        await _applyAuthResult(_authCache, path);
        return;
    }

    // ✅ Deduplicate: if a request is already in-flight, wait for it
    if (_authCheckPromise) {
        await _authCheckPromise;
        return;
    }

    try {
        _authCheckPromise = ApiService.request('/auth/status');
        const res = await _authCheckPromise;
        _authCache = res;
        await _applyAuthResult(res, path);
    } catch (e) {
        // Silently fail — don't break the page if auth check errors
    } finally {
        _authCheckPromise = null;
    }
}

async function _applyAuthResult(res, path) {
    if (res.isAuthenticated) {
        currentUser = res.user || res.vendor;
        localStorage.setItem('vendorLoggedIn', 'true');
        if (currentUser && currentUser.email) {
            localStorage.setItem('vendorEmail', currentUser.email);
        }
        if (currentUser && (currentUser.id || currentUser.user_id)) {
            localStorage.setItem('vendorId', currentUser.id || currentUser.user_id);
        }

        // STRICT ROLE CHECK: non-vendor on protected pages → redirect to marketplace
        if (currentUser.role !== 'vendor') {
            const isAuthPage = path.includes('loginvender.html') || path.includes('signup.html');
            if (!isAuthPage) {
                window.location.href = '../marketonex/marketonex.html';
                return;
            }
        }

        if (currentUser.role === 'vendor') {
            // Stage 0: Email Verification
            if (currentUser.email_verified !== true && currentUser.email_verified !== 1) {
                if (!path.endsWith('signup.html')) {
                    window.location.href = 'signup.html';
                    return;
                }
            }

            // Stage 1: Admin approval
            if (!currentUser.verified || currentUser.verified === 'false' || currentUser.verified === 0) {
                const verificationPages = ['signup.html', 'verification_biz_verification_website_editor.html', 'vender_profile_products_add-product.html', 'loginvender.html'];
                const isAllowedPage = verificationPages.some(page => path.endsWith(page));

                if (!isAllowedPage) {
                    window.location.href = 'verification_biz_verification_website_editor.html?msg=restricted';
                    return;
                }
                restrictUnverifiedSidebar();
            } else {
                // Stage 2: KYC / account_status check
                const accountStatus = currentUser.account_status;

                if (accountStatus && accountStatus !== 'active') {
                    const restrictedPages = ['products.html', 'orders.html', 'insights.html'];
                    const isRestricted = restrictedPages.some(page => path.endsWith(page));

                    if (isRestricted) {
                        window.location.href = 'verification_biz_verification_website_editor.html?msg=kyc_required';
                        return;
                    }
                    restrictUnverifiedSidebar();
                }
            }
        }

        updateUIWithUser(currentUser);

        // Load products only on the relevant pages and only for verified vendors
        if (path.includes('products.html') || path.includes('vender_profile_products_add-product.html') || path.includes('orders_feedback_insights_settings_user-info_reviews.html')) {
            if (currentUser.role === 'vendor' && currentUser.verified) {
                if (typeof window.loadProducts === 'function') {
                    window.loadProducts();
                }
            }
        }
    } else {
        // Not authenticated — clear local flags
        localStorage.removeItem('vendorLoggedIn');
        localStorage.removeItem('vendorEmail');
        localStorage.removeItem('products');

        // Skip redirect for public pages
        if (path.includes('login.html') || path.includes('loginvender.html') || path.includes('signup.html') || path.includes('landingpage.html')) return;

        // Redirect to login for protected pages
        const protectedPages = ['vender_profile_products_add-product.html', 'profile.html', 'orders_feedback_insights_settings_user-info_reviews.html', 'settings.html', 'user-info.html', 'verification_biz_verification_website_editor.html'];
        const isProtected = protectedPages.some(page => path.endsWith(page));
        if (isProtected) {
            window.location.href = 'loginvender.html';
        }
    }
}


function updateUIWithUser(user) {
    if (!user) return;
    // 1. Handle Profile Image & Initials
    const avatars = document.querySelectorAll('.user-avatar img, .profile-img');
    const avatarContainers = document.querySelectorAll('.user-avatar, .profile-img-container'); // Adjust selectors as needed

    const hasImage = user.profile_picture && !user.profile_picture.includes('default') && user.profile_picture !== '';
    const timestamp = new Date().getTime();

    // Update Image Elements
    avatars.forEach(img => {
        if (hasImage) {
            // Backend now sends /static/images/..., allowing full path usage
            const src = user.profile_picture.startsWith('http')
                ? user.profile_picture
                : `${user.profile_picture}?t=${timestamp}`; // Add cache buster
            img.src = src;
            img.style.display = 'block';
            // Hide initials if they exist as a sibling/parent logic (implementation depends on HTML structure)
        } else {
            // If no image, maybe hide img or show default
            // For now, let's assume we keep the img tag but maybe set a default placeholder if needed
            // or rely on initials elsewhere.
        }
    });

    // Update Initials (if elements exist)
    const initialsEls = document.querySelectorAll('.profile-initials, .user-initials');
    if (initialsEls.length > 0) {
        const initials = getInitials(user.fullname || user.email);
        initialsEls.forEach(el => {
            el.textContent = initials;
            // Toggle visibility: Show initials if NO image, Hide if HAS image
            el.style.display = hasImage ? 'none' : 'flex';
        });

        // Also toggle avatar images visibility inversely
        avatars.forEach(img => {
            img.style.display = hasImage ? 'block' : 'none';
        });
    }

    // 2. Update Text Fields
    if (document.getElementById('u-name')) {
        document.getElementById('u-name').value = user.fullname || user.name || '';
        document.getElementById('u-email').value = user.email || '';
        document.getElementById('u-phone').value = user.phone || '';
        document.getElementById('u-address').value = user.address || '';
        document.getElementById('u-city').value = user.city || '';
        document.getElementById('u-state').value = user.state || '';
        if (user.date_of_birth) document.getElementById('u-dob').value = user.date_of_birth;
        if (user.gender) document.getElementById('u-gender').value = user.gender;
    }

    // 3. Update Dashboard/Profile Sidebar Text
    const profileName = document.querySelector('.profile-info h2');
    const profileEmail = document.querySelector('.profile-info p');
    if (profileName) profileName.textContent = user.fullname || user.name || user.email;
    if (profileEmail) profileEmail.textContent = user.email;

    // 4. Update Business Details (Vendor Profile Specific)
    const bizNameEl = document.getElementById('profileBusinessName');
    if (bizNameEl) {
        bizNameEl.textContent = user.business_name || 'My Store';
    }

    const bizStatusBadge = document.getElementById('profileBizStatusBadge');
    if (bizStatusBadge && user.biz_verification_status) {
        const status = user.biz_verification_status.toLowerCase();
        bizStatusBadge.textContent = status.charAt(0).toUpperCase() + status.slice(1);
        bizStatusBadge.className = `status-badge ${status}`;

        // Always check for business verification details on the profile page
        // to show any remaining rejected documents even if status is pending
        if (window.location.pathname.includes('vender_profile_products_add-product.html')) {
            loadBusinessVerificationDetails();
            loadVendorReviews();
            loadBankDetails();
        }
    }

    // 5. Update Back to Landing Page Link
    const backBtn = document.getElementById('backToLandingPage');
    if (backBtn && user.vendor_slug) {
        backBtn.href = `/${user.vendor_slug}`;

        // Also update any sidebar items if they exist
        const sidebarLinks = document.querySelectorAll('.nav-item span');
        sidebarLinks.forEach(span => {
            if (span.textContent.includes('Back to Landing Page')) {
                const link = span.closest('a');
                if (link) link.href = `/${user.vendor_slug}`;
            }
        });
    }
}

async function loadBankDetails() {
    try {
        const res = await ApiService.get('/vendor/bank/status');
        let data = res;

        // If not found in new table, try settings (legacy fallback)
        if (!data || data.status === 'not_submitted') {
            const settingsRes = await ApiService.get('/vendor/settings');
            if (settingsRes.settings) {
                data = {
                    bank_name: settingsRes.settings.bank_name,
                    ifsc_code: settingsRes.settings.ifsc_code,
                    account_number: settingsRes.settings.account_number,
                    verification_status: 'not_submitted'
                };
            } else {
                return;
            }
        }

        const bankNameEl = document.getElementById('displayBankName');
        const ifscEl = document.getElementById('displayIFSC');
        const accNumEl = document.getElementById('displayAccountNumber');
        const statusBadge = document.getElementById('bankStatusBadge');

        if (bankNameEl) bankNameEl.textContent = data.bank_name || 'Not Linked';
        if (ifscEl) ifscEl.textContent = data.ifsc_code || 'Not Linked';
        if (accNumEl) {
            if (data.account_number) {
                const acc = data.account_number;
                accNumEl.textContent = acc.length > 4 ? 'XXXX-XXXX-' + acc.slice(-4) : acc;
            } else {
                accNumEl.textContent = 'Not Linked';
            }
        }

        if (statusBadge) {
            const status = data.verification_status || 'not_submitted';
            statusBadge.textContent = status.charAt(0).toUpperCase() + status.slice(1);
            statusBadge.className = `status-badge ${status}`;
            statusBadge.style.display = 'inline-block';

            // Premium styling for the badge if it's missing specific colors
            if (status === 'pending') statusBadge.style.backgroundColor = '#f59e0b';
            if (status === 'approved') statusBadge.style.backgroundColor = '#10b981';
            if (status === 'rejected') statusBadge.style.backgroundColor = '#ef4444';
            if (status === 'not_submitted') statusBadge.style.backgroundColor = '#6b7280';
            statusBadge.style.color = 'white';
        }
    } catch (err) {
    }
}

async function loadBusinessVerificationDetails() {
    try {
        const container = document.getElementById('rejectedDocumentsContainer');
        if (!container) return;

        const res = await ApiService.get('/vendor/biz-verification/status');
        const data = res.data;
        if (!data || !data.rejection_reason) return;

        // Count how many items are actually rejected (not REUPLOADED)
        const lines = data.rejection_reason.split('\n');
        const rejectedLines = lines.filter(l => l.includes(']:') && !l.includes('REUPLOADED'));

        if (rejectedLines.length === 0) return;

        container.style.display = 'block';
        container.innerHTML = `
            <div style="background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.1); border-radius: 12px; padding: 1.25rem;">
                <h4 style="color: #ef4444; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>Rejected Documents</span>
                </h4>
                <div id="rejectedList" style="display: flex; flex-direction: column; gap: 0.75rem;"></div>
                <div style="margin-top: 1.25rem; border-top: 1px solid rgba(239, 68, 68, 0.1); padding-top: 1rem;">
                    <a href="verification_biz_verification_website_editor.html#store-verification-page" class="update-btn" style="width: 100%; text-decoration: none; justify-content: center;">
                        <i class="fas fa-upload"></i>
                        <span>Fix in Verification Page</span>
                    </a>
                </div>
            </div>
        `;

        const list = document.getElementById('rejectedList');
        // lines is already declared above

        const labelToFieldMap = {
            'Shop Front Photo': 'shop_front_photo',
            'Shop Board Photo': 'shop_board_photo',
            'Shop Video': 'shop_video',
            'Vendor Photo': 'vendor_photo',
            'Brand Authorization Certificate': 'brand_auth_certificate',
            'Service Certification': 'service_certification',
            'Business Proof': 'business_proof'
        };

        lines.forEach(line => {
            if (line.includes(']:') && !line.includes('REUPLOADED')) {
                const [label, reason] = line.split(']:').map(s => s.trim().replace('[', ''));
                const field = labelToFieldMap[label];

                const item = document.createElement('div');
                item.style = "padding: 0.85rem; background: #fff5f5; border-radius: 10px; border: 1px solid #feb2b2; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem;";

                let previewHtml = '';
                if (field && data[field]) {
                    const fullPath = `/static/images/${data[field]}`;
                    if (data[field].toLowerCase().match(/\.(mp4|webm|mov)$/)) {
                        previewHtml = `<div style="width: 60px; height: 60px; background: #000; border-radius: 6px; display: flex; align-items: center; justify-content: center;"><i class="fas fa-video" style="color: white;"></i></div>`;
                    } else if (data[field].toLowerCase().endsWith('.pdf')) {
                        previewHtml = `<div style="width: 60px; height: 60px; background: #fee2e2; border-radius: 6px; display: flex; align-items: center; justify-content: center;"><i class="fas fa-file-pdf" style="color: #ef4444;"></i></div>`;
                    } else {
                        previewHtml = `<img src="${fullPath}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 6px; border: 1px solid #eee;">`;
                    }
                }

                item.innerHTML = `
                    <div style="display: flex; gap: 0.75rem; align-items: flex-start; flex: 1;">
                        <div style="position: relative;">
                            ${previewHtml}
                            <span style="position: absolute; top: -5px; right: -5px; background: #ef4444; color: white; font-size: 0.6rem; padding: 2px 6px; border-radius: 10px; font-weight: 800; border: 2px solid white; text-transform: uppercase;">Rejected</span>
                        </div>
                        <div style="flex: 1;">
                            <div style="font-weight: 700; font-size: 0.9rem; color: #9b1c1c; margin-bottom: 0.25rem;">${label}</div>
                            <div style="font-size: 0.8rem; color: #c81e1e; line-height: 1.4;"><strong>Reason:</strong> ${reason}</div>
                        </div>
                    </div>
                    <a href="verification_biz_verification_website_editor.html#store-verification-page" style="background: #ef4444; color: white; padding: 6px 12px; border-radius: 8px; font-size: 0.75rem; text-decoration: none; font-weight: 700; white-space: nowrap; transition: 0.2s; box-shadow: 0 4px 6px -1px rgba(239, 68, 68, 0.2);">
                        <i class="fas fa-upload"></i> Re-upload
                    </a>
                `;
                list.appendChild(item);
            }
        });
    } catch (err) {
    }
}

function getInitials(name) {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

function restrictUnverifiedSidebar() {
    const restrictedLinks = [
        'products.html',
        'orders.html',
        'insights.html',
        'add-product.html'
    ];

    const hideRestrictedElements = () => {
        // Select all links in sidebar/nav
        const links = document.querySelectorAll('a[href]');

        links.forEach(link => {
            const href = link.getAttribute('href');

            // Check if link points to a restricted page
            if (href && restrictedLinks.some(page => href.includes(page))) {
                // Strict Hiding as requested
                link.style.display = 'none';

                // If wrapped in a list item or nav-item container, hide that too
                if (link.parentElement.tagName === 'LI' || link.classList.contains('nav-item')) {
                    // Start from the link itself or its parent
                    let container = link.classList.contains('nav-item') ? link : link.parentElement;
                    container.style.display = 'none';
                }
            }
        });

        // Hide Add Product buttons
        const actionButtons = document.querySelectorAll('.add-product-btn, .create-order-btn');
        actionButtons.forEach(btn => {
            btn.style.display = 'none';
        });
    };

    // Run immediately
    hideRestrictedElements();

    // Run again after a short delay to catch dynamic renders (like sidebar includes)
    setTimeout(hideRestrictedElements, 100);
    setTimeout(hideRestrictedElements, 500);
    setTimeout(hideRestrictedElements, 1000);
}

// Initialize Auth
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();

    // --- Mobile Menu Toggle ---
    const topBar = document.querySelector('.top-bar');
    const sidebar = document.querySelector('.sidebar');

    if (topBar && sidebar) {
        const menuBtn = document.createElement('button');
        menuBtn.className = 'mobile-menu-btn';
        menuBtn.innerHTML = '<i class="fas fa-bars"></i>';
        topBar.prepend(menuBtn);

        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            sidebar.classList.toggle('active');
        });

        // Close sidebar when clicking outside
        document.addEventListener('click', (e) => {
            if (sidebar.classList.contains('active') && !sidebar.contains(e.target) && !menuBtn.contains(e.target)) {
                sidebar.classList.remove('active');
            }
        });
    }

    // Orders will be fetched from backend API - no seed data needed


    // Fetch and Render Orders Table (Updated to use Backend API)
    async function renderOrdersTable(ordersToRender = null) {
        const tbody = document.getElementById('ordersTableBody');
        if (!tbody) return;

        let orders = ordersToRender;
        let redirect = null;

        // If no orders provided, check LocalStorage first for sync, then fallback to API
        if (!orders) {
            try {
                const storedOrders = localStorage.getItem('allOrders');
                const currentVendorId = localStorage.getItem('vendorId');

                if (storedOrders && currentVendorId) {
                    const localOrders = JSON.parse(storedOrders);
                    // Filter for this vendor
                    const filteredLocal = localOrders.filter(o => {
                        return o.items && o.items.some(item => String(item.vendor_id) === String(currentVendorId));
                    });

                    if (filteredLocal.length > 0) {
                        orders = filteredLocal.map(o => ({
                            id: o.order_id || o.id || 'N/A',
                            customer: o.fullname || o.customer_name || 'Unknown',
                            payment: o.payment_method || 'Success',
                            fulfillment: o.status === 'delivered' ? 'Fulfilled' : 'Unfulfilled',
                            date: new Date(o.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
                            rawDate: o.created_at,
                            total: parseFloat(o.total || 0).toFixed(2),
                            items: o.items ? o.items.reduce((sum, item) => sum + (item.quantity || 1), 0) : 0
                        }));
                    }
                }

                if (!orders) {
                    const response = await ApiService.get('/vendor/orders');
                    const backendOrders = response.orders || [];

                    // Transform backend order format to frontend format
                    orders = backendOrders.map(order => {
                        // Calculate total items from order items
                        const itemCount = order.items ? order.items.reduce((sum, item) => sum + item.quantity, 0) : 0;

                        // Format date
                        const orderDate = new Date(order.created_at);
                        const formattedDate = orderDate.toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                        });

                        // Determine payment status based on payment_method and status
                        let paymentStatus = 'Pending';
                        if (order.status === 'confirmed' || order.status === 'shipped' || order.status === 'delivered') {
                            paymentStatus = 'Success';
                        }

                        // Determine fulfillment status
                        let fulfillmentStatus = 'Unfulfilled';
                        if (order.status === 'delivered') {
                            fulfillmentStatus = 'Fulfilled';
                        } else if (order.status === 'shipped') {
                            fulfillmentStatus = 'Unfulfilled'; // In transit
                        }

                        return {
                            id: order.vendor_order_id || order.order_id || order.id || 'N/A',
                            customer: order.customer_name || order.fullname || 'Unknown',
                            payment: paymentStatus,
                            fulfillment: fulfillmentStatus,
                            date: formattedDate || 'N/A',
                            rawDate: order.created_at,
                            total: order.total ? parseFloat(order.total).toFixed(2) : '0.00',
                            items: itemCount || 0
                        };
                    });
                    const user = response.data ? response.data.user : response.user;
                    redirect = response.data ? response.data.redirect : response.redirect;
                    console.log('Transformed orders:', orders);
                }
            } catch (error) {
                // Check for authentication error
                if (error.message && (error.message.includes('401') || error.message.includes('Not authenticated'))) {
                    alert('Please log in to view orders');
                    window.location.href = 'loginvender.html';
                    return;
                }
                // Use backend-provided redirect
                if (redirect) {
                    window.location.href = redirect;
                    return;
                }
                orders = [];
            }
        }

        tbody.innerHTML = '';

        if (!orders || orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 20px;">No orders found matching your criteria.</td></tr>';
            updateStats(orders || []);
            return;
        }

        orders.forEach((order, index) => {
            const payClass = order.payment === 'Success' ? 'success' : 'pending';
            const fulfillClass = order.fulfillment === 'Fulfilled' ? 'fulfilled' : 'unfulfilled';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><input type="checkbox"></td>
                <td><span class="order-id">#${order.id}</span></td>
                <td><span class="order-date">${order.date}</span></td>
                <td><span class="customer-name">${order.customer}</span></td>
                <td>
                    <span class="badge payment-${payClass}">
                        <span class="badge-dot"></span> ${order.payment}
                    </span>
                </td>
                <td><span class="order-total">₹${order.total}</span></td>
                <td><span class="delivery-status">N/A</span></td>
                <td><span class="item-count">${order.items} items</span></td>
                <td>
                    <span class="badge fulfill-${fulfillClass.toLowerCase()}">
                        <span class="badge-dot"></span> ${order.fulfillment}
                    </span>
                </td>
                <td style="text-align: right;">
                    <button class="action-icon-btn"><i class="far fa-file-alt"></i></button>
                    <button class="action-icon-btn"><i class="far fa-comment-alt"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        updateStats(orders);
    }

    function updateStats(currentOrders) {
        if (!document.getElementById('stat-total-orders')) return;

        // Use the orders passed as parameter (from backend API)
        const allOrders = currentOrders || [];
        const unfulfilled = allOrders.filter(o => o.fulfillment === 'Unfulfilled').length;

        // Fix: Ensure we're only summing valid numeric values for items
        const items = allOrders.reduce((acc, o) => {
            // Convert to number and ensure it's valid
            const itemCount = typeof o.items === 'number' ? o.items : parseInt(o.items, 10);
            return acc + (isNaN(itemCount) ? 0 : itemCount);
        }, 0);

        document.getElementById('stat-total-orders').textContent = allOrders.length;
        document.getElementById('stat-order-items').textContent = items;
        document.getElementById('stat-fulfilled').textContent = allOrders.length - unfulfilled;
    }

    // Initial Load
    renderOrdersTable();


    // --- Interactivity Implementation ---

    // 1. Tab Filtering
    const tabPills = document.querySelectorAll('.tab-pill');
    tabPills.forEach(pill => {
        pill.addEventListener('click', () => {
            // Remove active class
            tabPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');

            const filter = pill.getAttribute('data-filter');
            filterOrders(filter);
        });
    });

    async function filterOrders(criteria) {
        // --- SYNC WITH CHECKOUT: Fetch orders from LocalStorage first ---
        const storedOrders = localStorage.getItem('allOrders');
        const currentVendorId = localStorage.getItem('vendorId');
        let allOrdersLocal = [];

        if (storedOrders && currentVendorId) {
            const localOrders = JSON.parse(storedOrders);
            // Filter for this vendor
            const filteredLocal = localOrders.filter(o => {
                return o.items && o.items.some(item => String(item.vendor_id) === String(currentVendorId));
            });

            allOrdersLocal = filteredLocal.map(order => {
                const itemCount = order.items ? order.items.reduce((sum, item) => sum + (item.quantity || 1), 0) : 0;
                const orderDate = new Date(order.created_at);
                const formattedDate = orderDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                let paymentStatus = order.status === 'confirmed' || order.status === 'shipped' || order.status === 'delivered' ? 'Success' : 'Pending';
                let fulfillmentStatus = order.status === 'delivered' ? 'Fulfilled' : 'Unfulfilled';

                return {
                    id: order.vendor_order_id || order.order_id || order.id,
                    customer: order.customer_name || order.fullname,
                    payment: paymentStatus,
                    fulfillment: fulfillmentStatus,
                    date: formattedDate,
                    rawDate: order.created_at,
                    total: parseFloat(order.total || 0).toFixed(2),
                    items: itemCount
                };
            });
        }

        let filtered = allOrdersLocal;

        // If local is empty, fallback to API (original logic)
        if (allOrdersLocal.length === 0) {
            try {
                const response = await ApiService.get('/vendor/orders');
                const backendOrders = response.orders || [];

                const allOrdersApi = backendOrders.map(order => {
                    const itemCount = order.items ? order.items.reduce((sum, item) => sum + item.quantity, 0) : 0;
                    const orderDate = new Date(order.created_at);
                    const formattedDate = orderDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                    let paymentStatus = order.status === 'confirmed' || order.status === 'shipped' || order.status === 'delivered' ? 'Success' : 'Pending';
                    let fulfillmentStatus = order.status === 'delivered' ? 'Fulfilled' : 'Unfulfilled';

                    return {
                        id: order.vendor_order_id || order.order_id || order.id,
                        customer: order.customer_name || order.fullname,
                        payment: paymentStatus,
                        fulfillment: fulfillmentStatus,
                        date: formattedDate,
                        rawDate: order.created_at,
                        total: parseFloat(order.total).toFixed(2),
                        items: itemCount
                    };
                });
                filtered = allOrdersApi;
            } catch (err) { console.error(err); }
        }

        const allOrdersToFilter = filtered;

        if (criteria === 'unfulfilled') {
            filtered = allOrdersToFilter.filter(o => o.fulfillment === 'Unfulfilled');
        } else if (criteria === 'unpaid') {
            filtered = allOrdersToFilter.filter(o => o.payment === 'Pending');
        } else if (criteria === 'open') {
            filtered = allOrdersToFilter.filter(o => o.fulfillment === 'Unfulfilled');
        } else if (criteria === 'closed') {
            filtered = allOrdersToFilter.filter(o => o.fulfillment === 'Fulfilled');
        }

        renderOrdersTable(filtered);
    }

    // 2. Search Functionality
    const searchInput = document.getElementById('ordersSearch');
    if (searchInput) {
        searchInput.addEventListener('input', async (e) => {
            const term = e.target.value.toLowerCase();

            // SYNC WITH CHECKOUT: Fetch from LocalStorage and filter
            const storedOrders = localStorage.getItem('allOrders');
            const currentVendorId = localStorage.getItem('vendorId');
            let ordersToSearch = [];

            if (storedOrders && currentVendorId) {
                const localOrders = JSON.parse(storedOrders);
                // Filter for this vendor
                const filteredLocal = localOrders.filter(o => {
                    return o.items && o.items.some(item => String(item.vendor_id) === String(currentVendorId));
                });
                ordersToSearch = filteredLocal.map(order => {
                    const itemCount = order.items ? order.items.reduce((sum, item) => sum + (item.quantity || 1), 0) : 0;
                    const orderDate = new Date(order.created_at);
                    const formattedDate = orderDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                    let paymentStatus = order.status === 'confirmed' || order.status === 'shipped' || order.status === 'delivered' ? 'Success' : 'Pending';
                    let fulfillmentStatus = order.status === 'delivered' ? 'Fulfilled' : 'Unfulfilled';

                    return {
                        id: order.vendor_order_id || order.order_id || order.id,
                        customer: order.customer_name || order.fullname,
                        payment: paymentStatus,
                        fulfillment: fulfillmentStatus,
                        date: formattedDate,
                        rawDate: order.created_at,
                        total: parseFloat(order.total || 0).toFixed(2),
                        items: itemCount
                    };
                });
            }

            if (ordersToSearch.length === 0) {
                try {
                    const response = await ApiService.get('/vendor/orders');
                    const backendOrders = response.orders || [];
                    ordersToSearch = backendOrders.map(order => {
                        const itemCount = order.items ? order.items.reduce((sum, item) => sum + item.quantity, 0) : 0;
                        const orderDate = new Date(order.created_at);
                        const formattedDate = orderDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                        let paymentStatus = order.status === 'confirmed' || order.status === 'shipped' || order.status === 'delivered' ? 'Success' : 'Pending';
                        let fulfillmentStatus = order.status === 'delivered' ? 'Fulfilled' : 'Unfulfilled';

                        return {
                            id: order.vendor_order_id || order.order_id || order.id,
                            customer: order.customer_name || order.fullname,
                            payment: paymentStatus,
                            fulfillment: fulfillmentStatus,
                            date: formattedDate,
                            rawDate: order.created_at,
                            total: parseFloat(order.total).toFixed(2),
                            items: itemCount
                        };
                    });
                } catch (err) { }
            }

            const filtered = ordersToSearch.filter(o =>
                o.id.toLowerCase().includes(term) ||
                o.customer.toLowerCase().includes(term) ||
                o.payment.toLowerCase().includes(term)
            );
            renderOrdersTable(filtered);
        });
    }

    // 3. Date Filter (Mock)
    const dateDropdown = document.querySelector('.date-filter-dropdown');
    if (dateDropdown) {
        dateDropdown.addEventListener('click', async () => {
            const isFiltered = confirm("Filter orders for 'Last 7 Days'? Click OK.");
            if (isFiltered) {
                // Fetch orders from backend
                const response = await ApiService.get('/vendor/orders');
                const backendOrders = response.orders || [];

                // Transform orders
                const allOrders = backendOrders.map(order => {
                    const itemCount = order.items ? order.items.reduce((sum, item) => sum + item.quantity, 0) : 0;
                    const orderDate = new Date(order.created_at);
                    const formattedDate = orderDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                    let paymentStatus = order.status === 'confirmed' || order.status === 'shipped' || order.status === 'delivered' ? 'Success' : 'Pending';
                    let fulfillmentStatus = order.status === 'delivered' ? 'Fulfilled' : 'Unfulfilled';

                    return {
                        id: order.vendor_order_id || order.order_id || order.id,
                        customer: order.customer_name || order.fullname,
                        payment: paymentStatus,
                        fulfillment: fulfillmentStatus,
                        date: formattedDate,
                        rawDate: order.created_at,
                        total: parseFloat(order.total).toFixed(2),
                        items: itemCount
                    };
                });

                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

                const filtered = allOrders.filter(o => {
                    const d = new Date(o.rawDate || o.date);
                    return !isNaN(d) && d > sevenDaysAgo;
                });
                renderOrdersTable(filtered);
                const span = document.querySelector('.date-filter-dropdown span');
                if (span) span.textContent = 'Last 7 Days';
            } else {
                renderOrdersTable();
                const span = document.querySelector('.date-filter-dropdown span');
                if (span) span.textContent = 'Jan 1 - Jan 30, 2024';
            }
        });
    }

    // 4. Export & Actions
    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const text = btn.textContent.trim();
            if (text.includes('Export')) {
                alert('Exporting orders to CSV...');
                try {
                    const rows = JSON.parse(localStorage.getItem('orders') || '[]');
                    let csv = "Order ID,Date,Customer,Payment,Total,Items,Status\n";
                    rows.forEach(r => {
                        csv += `${r.id},${r.date},${r.customer},${r.payment},${r.total},${r.items},${r.fulfillment}\n`;
                    });
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'orders_export.csv';
                    a.click();
                } catch (err) { }

            } else if (text.includes('More actions')) {
                alert('Opening bulk actions menu...');
            } else if (text.includes('Create order')) {
                if (confirm('Go to Add Product page?')) {
                    window.location.href = 'add-product.html';
                }
            }
        });
    });

    // 5. Graphs Interaction (Detailed Modal)
    const graphModal = document.getElementById('graphModal');
    const closeGraphModalBtn = document.querySelector('.close-graph-modal');
    const detailedChartCanvas = document.getElementById('detailedChartCanvas');
    let detailedChartInstance = null;

    if (graphModal && detailedChartCanvas) {
        document.querySelectorAll('.order-stat-card').forEach(card => {
            card.addEventListener('click', () => {
                const titleLabel = card.querySelector('.stat-label');
                const title = titleLabel ? titleLabel.textContent : 'Statistics';

                // Open Modal
                const modalTitleFn = document.getElementById('graphModalTitle');
                if (modalTitleFn) modalTitleFn.textContent = title;

                graphModal.classList.add('show');
                graphModal.style.display = 'flex';

                // Render Chart
                renderDetailedChart(title);
            });
        });

        // Close Logic
        const closeFn = () => {
            graphModal.classList.remove('show');
            setTimeout(() => graphModal.style.display = 'none', 300);
        };

        if (closeGraphModalBtn) closeGraphModalBtn.addEventListener('click', closeFn);
        graphModal.addEventListener('click', (e) => {
            if (e.target === graphModal) closeFn();
        });
    }

    function renderDetailedChart(title) {
        if (detailedChartInstance) {
            detailedChartInstance.destroy();
        }

        // Mock Data Generation
        const labels = Array.from({ length: 15 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (14 - i));
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        });

        let data = [];
        let color = '#4f46e5';
        let label = title;

        if (title.includes('Sales') || title.includes('Total Orders')) {
            data = labels.map(() => Math.floor(Math.random() * 50) + 10);
            color = '#fbbf24'; // Warning/Yellow
        } else if (title.includes('Returns')) {
            data = labels.map(() => Math.floor(Math.random() * 5));
            color = '#ef4444'; // Danger/Red
        } else if (title.includes('Fulfilled')) {
            data = labels.map(() => Math.floor(Math.random() * 30) + 5);
            color = '#10b981'; // Success/Green
        } else {
            data = labels.map(() => Math.floor(Math.random() * 100));
        }

        const ctx = detailedChartCanvas.getContext('2d');
        detailedChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: label,
                    data: data,
                    borderColor: color,
                    backgroundColor: color + '20', // transparent fill
                    borderWidth: 3,
                    pointBackgroundColor: typeof getComputedStyle !== 'undefined' ? getComputedStyle(document.documentElement).getPropertyValue('--bg-card').trim() : '#fff',
                    pointBorderColor: color,
                    pointBorderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1
                    }
                },
                scales: {
                    x: {
                        grid: { display: false, drawBorder: false },
                        ticks: { color: '#a1a1aa' } // text-secondary
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
                        ticks: { color: '#a1a1aa' }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
    }


    // Calculate Metrics
    async function calculateDashboardMetrics() {
        try {
            console.log('[DASHBOARD] Fetching real-time statistics...');

            // --- UNIFIED ORDER SYNC: Fallback to LocalStorage for orders/sales ---
            const storedOrders = localStorage.getItem('allOrders');
            const currentVendorId = localStorage.getItem('vendorId');

            let filteredLocal = [];
            if (storedOrders && currentVendorId) {
                const localOrders = JSON.parse(storedOrders);
                filteredLocal = localOrders.filter(o => {
                    return o.items && o.items.some(item => String(item.vendor_id) === String(currentVendorId));
                });
            }

            let apiStats = {};
            try {
                const response = await ApiService.request('/vendor/stats', 'GET');
                apiStats = response.data || response;
            } catch (apiErr) {
                console.warn('[DASHBOARD] API stats failed, using local data only:', apiErr);
            }

            // Priority: Use API stats if available, otherwise fallback to local calculation
            const totalOrdersCount = apiStats.total_orders !== undefined ? apiStats.total_orders : (filteredLocal.length || 0);
            const totalSales = apiStats.total_sales !== undefined ? apiStats.total_sales : (filteredLocal.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0) || 0);

            // Products and Rating still come from API if available
            const totalProducts = apiStats.total_products || 0;
            const overallRating = apiStats.overall_rating || 0;

            const elSales = document.getElementById('dashboardTotalSales');
            const elOrders = document.getElementById('dashboardTotalOrders');
            const elProducts = document.getElementById('dashboardTotalProducts');
            const elRating = document.getElementById('dashboardOverallRating');

            const elSalesChange = document.getElementById('dashboardSalesChange');
            const elOrdersChange = document.getElementById('dashboardOrdersChange');
            const elProductsChange = document.getElementById('dashboardProductsChange');
            const elRatingChange = document.getElementById('dashboardRatingChange');

            if (elSales) {
                elSales.textContent = '₹' + totalSales.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                if (elSalesChange && apiStats.changes) {
                    elSalesChange.innerHTML = `${apiStats.changes.sales} <span style="color: inherit; font-size: 0.9em; font-weight: normal;">from last month</span>`;
                }
            }
            if (elOrders) {
                elOrders.textContent = totalOrdersCount.toLocaleString();
                if (elOrdersChange && apiStats.changes) {
                    elOrdersChange.innerHTML = `${apiStats.changes.orders} <span style="color: inherit; font-size: 0.9em; font-weight: normal;">from last month</span>`;
                }
            }
            if (elProducts) {
                elProducts.textContent = totalProducts.toLocaleString();
                if (elProductsChange && apiStats.changes) {
                    elProductsChange.innerHTML = `${apiStats.changes.products} <span style="color: inherit; font-size: 0.9em; font-weight: normal;">this month</span>`;
                }
            }
            if (elRating) {
                elRating.textContent = overallRating.toFixed(1);
                if (elRatingChange && apiStats.changes) {
                    elRatingChange.className = 'stat-change positive';
                    elRatingChange.innerHTML = `${apiStats.changes.rating} <span style="color: inherit; font-size: 0.9em; font-weight: normal;">from last month</span>`;
                }
            }
        } catch (error) {
            console.error('[DASHBOARD ERROR] Failed to fetch real-time statistics:', error);

            // Fallback for UI if API fails (optional, keeps UI from looking broken if server is down)
            const elSales = document.getElementById('dashboardTotalSales');
            if (elSales && elSales.textContent === '₹0.00') {
                elSales.textContent = 'Loading...';
            }
        }
    }

    // Only run dashboard stats fetch on the actual dashboard page
    if (document.getElementById('dashboardTotalSales') || document.getElementById('salesChart') || document.querySelector('[data-dashboard]')) {
        calculateDashboardMetrics();
    }


    // --- Chart Initialization (Dynamic Data) ---
    const ctx = document.getElementById('salesChart');
    if (ctx) {
        const orders = JSON.parse(localStorage.getItem('orders') || '[]');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const today = new Date();
        const last6Months = [];

        for (let i = 5; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            last6Months.push({
                label: monthNames[d.getMonth()],
                value: 0
            });
        }

        orders.forEach(order => {
            let val = 0;
            try { val = parseFloat(order.total); } catch (e) { }
            let oDate = new Date(order.rawDate || order.date);
            if (!isNaN(oDate.getTime())) {
                const monthIndex = oDate.getMonth();
                const monthName = monthNames[monthIndex];
                const period = last6Months.find(p => p.label === monthName);
                if (period) period.value += val;
            }
        });

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: last6Months.map(m => m.label),
                datasets: [{
                    label: 'Sales (₹)',
                    data: last6Months.map(m => m.value),
                    borderColor: '#4f46e5',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }

    // --- Theme Switcher Logic ---
    const themeBtn = document.getElementById('themeBtn');
    const themeMenu = document.getElementById('themeMenu');
    const themeOptions = document.querySelectorAll('.theme-option');

    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        try {
            localStorage.setItem('theme', theme);
        } catch (e) { console.warn('Theme save failed:', e); }

        // Update active class in menu
        themeOptions.forEach(opt => {
            if (opt.getAttribute('data-value') === theme) {
                opt.classList.add('active');
            } else {
                opt.classList.remove('active');
            }
        });

        updateChartColors();
    }

    function updateChartColors() {
        const theme = document.documentElement.getAttribute('data-theme') || 'dark';
        if (typeof Chart !== 'undefined') {
            const chart = Chart.getChart('salesChart'); // Get the chart instance
            if (chart) {
                // Handle chart colors based on theme
                if (theme === 'light') {
                    chart.data.datasets[0].backgroundColor = '#3b82f6'; // Blue for light mode
                } else if (theme === 'brown') {
                    chart.data.datasets[0].backgroundColor = '#a1887f'; // Warm brown
                } else {
                    // Dark mode (default)
                    chart.data.datasets[0].backgroundColor = '#4f46e5'; // Indigo
                }
                chart.update();
            }
        }
    }

    if (themeBtn && themeMenu) {
        themeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            themeMenu.classList.toggle('active');
        });

        document.addEventListener('click', (e) => {
            if (!themeBtn.contains(e.target) && !themeMenu.contains(e.target)) {
                themeMenu.classList.remove('active');
            }
        });
    }

    themeOptions.forEach(option => {
        option.addEventListener('click', () => {
            const theme = option.getAttribute('data-value');
            setTheme(theme);
            themeMenu.classList.remove('active');
        });
    });

    // Initialize Theme
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);


    // --- Product Modal Logic ---
    const productModal = document.getElementById('productModal');
    const closeProductModalBtn = document.querySelector('.close-modal');

    // Function to open modal
    window.openProductModal = function (imgSrc, title, desc, vendor, price, stock) {
        if (!productModal) return;

        document.getElementById('modalImg').src = imgSrc;
        document.getElementById('modalTitle').textContent = title || 'Product Name';
        document.getElementById('modalDesc').textContent = desc || 'Description';
        document.getElementById('modalVendor').textContent = vendor || 'Vendor';
        document.getElementById('modalPrice').textContent = price || '₹0.00';
        document.getElementById('modalStock').textContent = stock || 'N/A';

        productModal.classList.add('show');
        productModal.style.display = 'flex';
    };

    function closeProductModal() {
        if (!productModal) return;
        productModal.classList.remove('show');
        setTimeout(() => {
            productModal.style.display = 'none';
        }, 300);
    }

    if (closeProductModalBtn) {
        closeProductModalBtn.addEventListener('click', closeProductModal);
    }

    if (productModal) {
        window.addEventListener('click', (e) => {
            if (e.target === productModal) {
                closeProductModal();
            }
        });
    }


    // --- Add Product Drawer Logic ---
    const addProductBtn = document.querySelector('.add-product-btn');
    const addProductDrawer = document.getElementById('addProductDrawer');
    const drawerOverlay = document.getElementById('drawerOverlay');
    const closeDrawerBtn = document.querySelector('.close-drawer-btn');
    const cancelDrawerBtn = document.querySelector('.add-product-drawer .cancel-btn');
    const addProductForm = document.getElementById('addProductForm');

    console.log('Add Product elements:', {
        addProductBtn: !!addProductBtn,
        addProductDrawer: !!addProductDrawer,
        drawerOverlay: !!drawerOverlay,
        closeDrawerBtn: !!closeDrawerBtn,
        cancelDrawerBtn: !!cancelDrawerBtn,
        addProductForm: !!addProductForm
    });

    function openDrawer() {
        console.log('openDrawer called');

        if (addProductDrawer && drawerOverlay) {
            // Auto-generate ID
            const date = new Date();
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            const random = Math.floor(100000 + Math.random() * 900000); // 6 digit random
            const generatedID = `${day}${month}${year}${random}`;

            const idInput = document.getElementById('p-id');
            if (idInput) idInput.value = generatedID;

            console.log('Adding open class to drawer and overlay');
            console.log('Drawer before:', addProductDrawer.className);
            console.log('Overlay before:', drawerOverlay.className);

            addProductDrawer.classList.add('open');
            drawerOverlay.classList.add('open');

            console.log('Drawer after:', addProductDrawer.className);
            console.log('Overlay after:', drawerOverlay.className);
            console.log('Drawer should now be visible');
        } else {
            console.error('Drawer elements not found:', {
                addProductDrawer: !!addProductDrawer,
                drawerOverlay: !!drawerOverlay
            });
        }
    }

    function closeDrawer() {
        console.log('closeDrawer called');
        if (addProductDrawer && drawerOverlay) {
            addProductDrawer.classList.remove('open');
            drawerOverlay.classList.remove('open');
        }
    }

    // Correct Add Product Button to Reset Form
    if (addProductBtn) {
        // Remove old listeners to prevent double firing if any (safety)
        // Actually we prefer replacing the element or just ensuring logic is robust

        addProductBtn.addEventListener('click', () => {
            // Reset Edit State
            editingProductId = null;
            editingProductCard = null;

            // Reset UI
            if (addProductForm) addProductForm.reset();
            document.querySelector('.drawer-header h2').textContent = 'Add New Product';
            document.querySelector('.save-product-btn').textContent = 'Save Product';

            // Open Drawer (using our drawer logic, not page redirect if we want drawer)
            // User requested "redesign add product page" earlier, but for "Add" on products page, drawer is good.
            // If we want to use drawer:
            openDrawer();
            // If we want redirect:
            // window.location.href = 'add-product.html'; 
            // We stick to drawer for consistency with "Edit in product page" logic which uses drawer.
        });
    }

    // --- Image Upload Drawer Logic ---
    const imageUploadArea = document.getElementById('imageUploadArea');
    const pImageInput = document.getElementById('p-image-file');

    if (imageUploadArea && pImageInput) {
        // 1. Click to trigger input
        imageUploadArea.addEventListener('click', () => {
            pImageInput.click();
        });

        // 2. Drag & Drop support
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            imageUploadArea.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        imageUploadArea.addEventListener('drop', handleDrop, false);

        function handleDrop(e) {
            const dt = e.dataTransfer;
            const files = dt.files;
            pImageInput.files = files; // Update input files
            handleFiles(files);
        }

        // 3. Preview Logic
        pImageInput.addEventListener('change', function () {
            handleFiles(this.files);
        });

        function handleFiles(files) {
            if (!files.length) return;

            // Clear default text/icon if we have files, or just append?
            // Let's replace content with a grid of previews
            imageUploadArea.innerHTML = '';
            imageUploadArea.style.display = 'flex';
            imageUploadArea.style.flexWrap = 'wrap';
            imageUploadArea.style.gap = '10px';
            imageUploadArea.style.justifyContent = 'center';
            imageUploadArea.style.padding = '10px';

            // Re-add a small upload icon/button to allow changing? 
            // Or just make the whole area clickable (it is already).

            Array.from(files).forEach(file => {
                if (!file.type.startsWith('image/')) return;

                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = function (e) {
                    const img = document.createElement('img');
                    img.src = e.target.result;
                    img.style.width = '60px';
                    img.style.height = '60px';
                    img.style.objectFit = 'cover';
                    img.style.borderRadius = '4px';
                    img.style.border = '1px solid #ddd';
                    imageUploadArea.appendChild(img);
                }
            });

            // Add a text indicating count
            const text = document.createElement('p');
            text.textContent = `${files.length} images selected`;
            text.style.width = '100%';
            text.style.textAlign = 'center';
            text.style.fontSize = '0.8rem';
            text.style.marginTop = '5px';
            imageUploadArea.appendChild(text);
        }
    }

    // Save New Product logic updated
    if (addProductForm) {
        addProductForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const fileInput = document.getElementById('p-image-file');
            const files = Array.from(fileInput.files);

            // --- VALIDATION START (Drawer) ---
            const errors = [];
            const name = document.getElementById('p-name').value.trim();
            const id = document.getElementById('p-id').value.trim();
            const category = document.getElementById('p-category').value.trim();
            const desc = document.getElementById('p-desc').value.trim();
            const price = parseFloat(document.getElementById('p-price').value);
            const stock = parseInt(document.getElementById('p-quantity').value);
            const brand = document.getElementById('p-brand').value.trim();
            const model = document.getElementById('p-model').value.trim();
            const color = document.getElementById('p-color').value.trim();
            const warranty = document.getElementById('p-warranty').value.trim();
            const features = document.getElementById('p-features').value.trim();

            if (name.length < 3) errors.push("Product Name must be at least 3 characters.");
            if (!/^\d{14}$/.test(id)) errors.push("Product ID must be exactly 14 digits.");
            if (category.length === 0) errors.push("Category is required.");
            if (desc.length < 20) errors.push("Description must be at least 20 characters.");
            if (isNaN(price) || price <= 0) errors.push("Price must be a valid number greater than 0.");
            if (isNaN(stock) || stock < 1) errors.push("Stock Quantity must be at least 1.");
            if (brand && !/^[a-zA-Z\s]+$/.test(brand)) errors.push("Brand must contain letters only.");
            if (color && !/^[a-zA-Z\s]+$/.test(color)) errors.push("Color must contain letters only.");
            if (model && !/^[a-zA-Z0-9-_\s]+$/.test(model)) errors.push("Model can only contain letters, numbers, hyphens, and underscores.");
            if (warranty && warranty.length < 5) errors.push("Warranty must be meaningful text (min 5 characters).");
            if (features) {
                const featureLines = features.split('\n');
                const invalidFeatures = featureLines.some(f => f.trim().length > 0 && f.trim().length < 3);
                if (invalidFeatures) errors.push("Each Key Feature must be at least 3 characters long.");
            }

            // Image Validation: Required for NEW, Optional for EDIT if already exists
            if (!editingProductId && files.length === 0) {
                errors.push("At least one product image is required.");
            }
            // Check type if files selected
            if (files.length > 0) {
                const validTypes = files.every(f => f.type === 'image/jpeg' || f.type === 'image/png');
                if (!validTypes) errors.push("Images must be in JPG or PNG format.");
            }

            if (errors.length > 0) {
                alert("Please correct the following errors:\n\n- " + errors.join("\n- "));
                return;
            }
            // --- VALIDATION END ---

            const processSave = (imageUrls) => {
                // Determine Images to save: New ones + Existing ones (if we supported appending)
                // Simplified: If new images uploaded, use them. If not, use existing (for edit).
                // Or overwrite. We'll use new if avail, else existing.

                let finalImages = imageUrls;
                // If editing and no new images, retrieve existing
                if (editingProductId && finalImages.length === 0) {
                    // Try to get from DOM or Storage
                    const products = JSON.parse(localStorage.getItem('products') || '[]');
                    const existing = products.find(p => p.id == editingProductId);
                    if (existing) finalImages = existing.images || [existing.image];
                }

                // Fallback
                if (finalImages.length === 0) finalImages = ['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500&h=500&fit=crop'];

                const productData = {
                    name: name,
                    id: id,
                    desc: desc,
                    price: price.toFixed(2),
                    category: category,
                    brand: brand,
                    model: model,
                    color: color,
                    quantity: stock,
                    warranty: warranty,
                    features: features,
                    image: finalImages[0],
                    images: finalImages
                };

                const products = JSON.parse(localStorage.getItem('products') || '[]');

                if (editingProductId) {
                    // Update Existing
                    const index = products.findIndex(p => p.id == editingProductId);
                    if (index !== -1) {
                        products[index] = productData;
                        localStorage.setItem('products', JSON.stringify(products));

                        // Update DOM
                        if (editingProductCard) {
                            // Easier to replace the whole card HTML
                            const newHTML = createProductCardHTML(productData);
                            editingProductCard.outerHTML = newHTML;
                            // Re-attach listener to the *new* element (it selects by class/id so we need to find it again? 
                            // createProductCardHTML returns a string. outerHTML replaces it. The new node is not returned by outerHTML assignment.
                            // We need to re-find it? Or insertAdjacent.
                            // Better: reloadProducts? Or hack:
                            // We know the ID.
                            setTimeout(() => {
                                const newCard = document.querySelector(`.product-card[data-id="${id}"]`);
                                if (newCard) attachGlobalCardListener(newCard);
                            }, 50);
                        } else {
                            // Logic for static card turned dynamic?
                            loadProducts(); // fallback
                        }
                        alert('Product updated successfully!');
                    } else {
                        // Creating new from static edit?
                        products.push(productData);
                        localStorage.setItem('products', JSON.stringify(products));
                        if (editingProductCard) editingProductCard.remove(); // Remove static
                        const grid = document.querySelector('.products-grid');
                        grid.insertAdjacentHTML('afterbegin', createProductCardHTML(productData));
                        attachGlobalCardListener(grid.firstElementChild);
                        alert('Product created from static base!');
                    }
                } else {
                    // Create New
                    products.push(productData);
                    localStorage.setItem('products', JSON.stringify(products));
                    const grid = document.querySelector('.products-grid');
                    if (grid) {
                        const cardHTML = createProductCardHTML(productData);
                        grid.insertAdjacentHTML('afterbegin', cardHTML);
                        attachGlobalCardListener(grid.firstElementChild);
                    }
                    alert('Product added and saved!');
                }

                closeDrawer();
                addProductForm.reset();
                editingProductId = null;
                editingProductCard = null;
                document.querySelector('.drawer-header h2').textContent = 'Add New Product';
                document.querySelector('.save-product-btn').textContent = 'Save Product';

                // Reset upload area text
                const imageUploadArea = document.getElementById('imageUploadArea');
                if (imageUploadArea) {
                    imageUploadArea.querySelector('p').textContent = 'Upload product images (Multiple allowed)';
                    imageUploadArea.style.borderColor = '';
                }

                // Refresh dashboard metrics after save
                if (typeof calculateDashboardMetrics === 'function') {
                    calculateDashboardMetrics();
                }
            };

            if (files.length > 0) {
                // Upload each file to backend
                const uploadPromises = files.map(file => {
                    return ApiService.upload('/upload/product', file)
                        .then(res => res.image_url)
                        .catch(err => {
                            console.error(`Failed to upload ${file.name}`, err);
                            alert(`Failed to upload ${file.name}`);
                            return null;
                        });
                });

                Promise.all(uploadPromises).then(urls => {
                    // Filter out any failed uploads (nulls)
                    const validUrls = urls.filter(url => url !== null);

                    if (validUrls.length === 0 && files.length > 0) {
                        alert("No images were uploaded successfully. Please try again.");
                        return;
                    }

                    processSave(validUrls);
                });
            } else {
                processSave([]);
            }
        });
    }

    // --- Search & Filter Logic ---
    const productSearchInput = document.querySelector('.search-box input');
    const filterSelects = document.querySelectorAll('.filter-select');

    function filterProducts() {
        if (!productSearchInput) return;

        const query = productSearchInput.value.toLowerCase();
        const categoryFilter = filterSelects[0] ? filterSelects[0].value : 'All Categories';
        const priceFilter = filterSelects[1] ? filterSelects[1].value : 'All Prices';
        const vendorFilter = filterSelects[2] ? filterSelects[2].value : 'All Vendors';

        document.querySelectorAll('.product-card').forEach(card => {
            const title = card.querySelector('h3').textContent.toLowerCase();
            const desc = card.querySelector('.product-desc').textContent.toLowerCase();
            const cardCategory = (card.getAttribute('data-category') || '').toLowerCase();
            const cardVendor = (card.getAttribute('data-vendor') || '').toLowerCase();
            const cardPriceStr = card.getAttribute('data-price') || '0';
            const cardPrice = parseFloat(cardPriceStr.replace(/[^0-9.]/g, ''));

            let matchesSearch = title.includes(query) || desc.includes(query);
            let matchesCategory = categoryFilter === 'All Categories' || cardCategory === categoryFilter.toLowerCase();

            let matchesVendor = vendorFilter === 'All Vendors' || vendorFilter === 'All Companies' || cardVendor.includes(vendorFilter.toLowerCase());

            let matchesPrice = true;
            if (priceFilter !== 'All Prices') {
                if (priceFilter === 'Under ₹50') matchesPrice = cardPrice < 50;
                else if (priceFilter === '₹50 - ₹100') matchesPrice = cardPrice >= 50 && cardPrice <= 100;
                else if (priceFilter === 'Over ₹100') matchesPrice = cardPrice > 100;
            }

            if (matchesSearch && matchesCategory && matchesVendor && matchesPrice) {
                card.style.display = 'flex';
            } else {
                card.style.display = 'none';
            }
        });
    }

    if (productSearchInput) {
        productSearchInput.addEventListener('input', filterProducts);
    }

    filterSelects.forEach(select => {
        select.addEventListener('change', filterProducts);
    });

    // Initialize Products
    // Initialize Products - Removed to prevent race condition (moved to checkAuth)
    // loadProducts();


    // --- Product Detail View Logic (Updated with Vertical Gallery + Zoom/Scroll) ---
    // Only run this code if we're on a page with the product detail view
    const productDetailView = document.getElementById('productDetailView');
    const backToGridBtn = document.querySelector('.back-to-grid-btn');
    const productsContainer = document.querySelector('.products-container');

    if (productDetailView && productsContainer) {
        console.log('Product detail view elements found, initializing...');

        const galleryUpBtn = document.getElementById('galleryUpBtn');
        const galleryDownBtn = document.getElementById('galleryDownBtn');
        const thumbsWrapper = document.querySelector('.image-thumbnails-wrapper');
        const thumbsContainer = document.getElementById('detailThumbnails');
        const mainImgContainer = document.getElementById('mainImageContainer');
        const mainImgEl = document.getElementById('detailMainImg');
        const magnifierLens = document.getElementById('magnifierLens');

        let currentImageIndex = 0;
        let currentImageArray = [];

        function showDetailView(productData) {
            console.log('showDetailView called with:', productData);

            if (!productDetailView || !productsContainer) {
                console.error('Product detail view elements not found');
                return;
            }

            // Ensure images is array
            let rawImages = Array.isArray(productData.images) ? productData.images : [productData.image || productData.images];

            // Filter out null, undefined, and the string "null"
            currentImageArray = rawImages.filter(img => img && img !== 'null' && img !== 'undefined');

            if (currentImageArray.length === 0) {
                console.warn('No valid images provided for detail view, using fallback');
                currentImageArray = ['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500&h=500&fit=crop'];
            }

            currentImageIndex = 0;
            updateMainImage(currentImageIndex);

            // Populate ALL detail fields
            const detailTitle = document.getElementById('detailTitle');
            const detailId = document.getElementById('detailId');
            const detailPrice = document.getElementById('detailPrice');
            const detailBrand = document.getElementById('detailBrand');
            const detailVendor = document.getElementById('detailVendor');
            const detailDescShort = document.getElementById('detailDescShort');

            // Set all values
            if (detailTitle) detailTitle.textContent = productData.name || 'Product Name';
            if (detailId) detailId.textContent = productData.id || 'N/A';
            if (detailPrice) detailPrice.textContent = productData.price || '₹0.00';
            if (detailBrand) detailBrand.textContent = productData.brand || 'N/A';
            if (detailVendor) detailVendor.textContent = productData.brand || 'Vendor';
            if (detailDescShort) detailDescShort.textContent = productData.desc || 'No description available';
            if (detailModel) detailModel.textContent = productData.model || 'N/A';
            if (detailColor) detailColor.textContent = productData.color || 'N/A';
            if (detailCategory) detailCategory.textContent = productData.category || 'N/A';
            if (detailWarranty) detailWarranty.textContent = productData.warranty || 'N/A';

            // Stock display
            if (detailStock) {
                const quantity = parseInt(productData.quantity) || 0;
                detailStock.textContent = quantity > 0 ? `${quantity} in stock` : 'Out of Stock';
                detailStock.className = 'stock-pill';
                if (quantity === 0) detailStock.classList.add('out');
                else if (quantity < 10) detailStock.classList.add('low');
            }

            // Features/Tags
            if (detailTags) {
                detailTags.innerHTML = '';
                if (productData.features) {
                    const features = productData.features.split('\n').filter(f => f.trim());
                    features.forEach(feature => {
                        const tag = document.createElement('span');
                        tag.className = 'detail-tag';
                        tag.textContent = feature.trim();
                        detailTags.appendChild(tag);
                    });
                }
            }

            // Render Thumbnails
            renderThumbnails();

            // Hide products container and show detail view
            console.log('Hiding products container and showing detail view');
            productsContainer.style.display = 'none';
            productDetailView.style.display = 'block';
            productDetailView.style.visibility = 'visible';
            productDetailView.style.opacity = '1';

            window.scrollTo(0, 0);
            console.log('Product detail view should now be visible');
        }

        function updateMainImage(index) {
            if (!currentImageArray[index] || !mainImgEl) return;

            mainImgEl.style.opacity = '0'; // Fade out
            setTimeout(() => {
                mainImgEl.src = currentImageArray[index];
                mainImgEl.style.opacity = '1'; // Fade in

                // Update Magnifier Background
                if (magnifierLens) {
                    magnifierLens.style.backgroundImage = `url('${currentImageArray[index]}')`;
                }
            }, 150);

            // Update Thumbnails Active State
            document.querySelectorAll('.thumb-item').forEach((t, i) => {
                if (i === index) t.classList.add('active');
                else t.classList.remove('active');
            });

            currentImageIndex = index;
        }

        // Render Thumbnails
        function renderThumbnails() {
            if (!thumbsContainer) return;
            thumbsContainer.innerHTML = '';

            // Reset position
            currentTranslateY = 0;
            thumbsContainer.style.transform = `translate3d(0px, 0px, 0px)`;

            currentImageArray.forEach((imgSrc, index) => {
                // Defensive check to avoid 404 /vendor/null
                if (!imgSrc || imgSrc === 'null' || imgSrc === 'undefined') return;

                const thumb = document.createElement('div');
                thumb.className = `thumb-item ${index === currentImageIndex ? 'active' : ''}`;
                thumb.innerHTML = `<img src="${imgSrc}" alt="Thumbnail ${index + 1}">`;

                // Add click event (separate from drag)
                // We'll handle checking if it was a drag or a click in the mouseup handler if needed, 
                // but for simple cases, a click event still fires after mouseup. 
                // To prevent drag-click issues, we check if we moved significantly.
                thumb.addEventListener('click', (e) => {
                    if (!isDragging) {
                        updateMainImage(index);
                    }
                });

                thumbsContainer.appendChild(thumb);
            });
        }

        // --- Draggable Vertical Slider Logic ---
        let isDragging = false;
        let startY = 0;
        let currentTranslateY = 0;
        let prevTranslateY = 0;
        let animationID;

        // Mouse Events
        thumbsContainer.addEventListener('mousedown', startDrag);
        thumbsContainer.addEventListener('touchstart', startDrag);

        thumbsContainer.addEventListener('mouseup', endDrag);
        thumbsContainer.addEventListener('mouseleave', endDrag);
        thumbsContainer.addEventListener('touchend', endDrag);

        thumbsContainer.addEventListener('mousemove', drag);
        thumbsContainer.addEventListener('touchmove', drag);

        function startDrag(e) {
            isDragging = true;
            startY = getPositionY(e);
            prevTranslateY = currentTranslateY;

            // Remove transition for instant response during drag
            thumbsContainer.style.transitionDuration = '0ms';
            thumbsContainer.style.cursor = 'grabbing';
        }

        function drag(e) {
            if (!isDragging) return;
            e.preventDefault(); // Stop scrolling
            const currentY = getPositionY(e);
            const diff = currentY - startY;
            currentTranslateY = prevTranslateY + diff;

            thumbsContainer.style.transform = `translate3d(0px, ${currentTranslateY}px, 0px)`;
        }

        function endDrag() {
            if (!isDragging) return;
            isDragging = false;
            thumbsContainer.style.cursor = 'grab';
            thumbsContainer.style.transitionDuration = '300ms'; // Restore smooth transition

            // Boundary checks (Spring back)
            const containerHeight = thumbsWrapper.clientHeight;
            const contentHeight = thumbsContainer.scrollHeight;
            const minTranslate = containerHeight - contentHeight;
            const maxTranslate = 0;

            if (contentHeight > containerHeight) {
                if (currentTranslateY > maxTranslate) {
                    currentTranslateY = maxTranslate;
                } else if (currentTranslateY < minTranslate) {
                    currentTranslateY = minTranslate;
                }
            } else {
                currentTranslateY = 0; // Center or top align if content fits
            }

            thumbsContainer.style.transform = `translate3d(0px, ${currentTranslateY}px, 0px)`;
        }

        function getPositionY(e) {
            return e.type.includes('mouse') ? e.pageY : e.touches[0].pageY;
        }

        // Button Navigation
        const moveStep = 80; // height of item + gap approx

        if (galleryUpBtn) {
            galleryUpBtn.addEventListener('click', () => {
                currentTranslateY += moveStep;
                snapToBounds();
            });
        }

        if (galleryDownBtn) {
            galleryDownBtn.addEventListener('click', () => {
                currentTranslateY -= moveStep;
                snapToBounds();
            });
        }

        function snapToBounds() {
            // Re-apply transition in case it was stripped
            thumbsContainer.style.transitionDuration = '300ms';

            const containerHeight = thumbsWrapper.clientHeight;
            const contentHeight = thumbsContainer.scrollHeight;
            const minTranslate = containerHeight - contentHeight;
            const maxTranslate = 0;

            if (contentHeight > containerHeight) {
                if (currentTranslateY > maxTranslate) currentTranslateY = maxTranslate;
                if (currentTranslateY < minTranslate) currentTranslateY = minTranslate;
            } else {
                currentTranslateY = 0;
            }

            thumbsContainer.style.transform = `translate3d(0px, ${currentTranslateY}px, 0px)`;
        }

        // Wheel Scroll on Gallery
        thumbsWrapper.addEventListener('wheel', (e) => {
            e.preventDefault();
            // Re-apply transition for smooth wheel
            thumbsContainer.style.transitionDuration = '200ms';
            currentTranslateY -= e.deltaY;

            // Debounce snap? Or just clamp immediately?
            // Clamping immediately for wheel feel
            const containerHeight = thumbsWrapper.clientHeight;
            const contentHeight = thumbsContainer.scrollHeight;
            const minTranslate = containerHeight - contentHeight;

            if (contentHeight > containerHeight) {
                if (currentTranslateY > 0) currentTranslateY = 0;
                if (currentTranslateY < minTranslate) currentTranslateY = minTranslate;
            } else {
                currentTranslateY = 0;
            }
            thumbsContainer.style.transform = `translate3d(0px, ${currentTranslateY}px, 0px)`;
        });

        function hideDetailView() {
            if (!productDetailView || !productsContainer) return;
            productDetailView.style.display = 'none';
            productsContainer.style.display = 'block';
        }

        if (backToGridBtn) backToGridBtn.addEventListener('click', hideDetailView);

        window.showDetailView = showDetailView;

        // Remove redundant attachment (handled by loadProducts -> attachGlobalCardListener)
        // document.querySelectorAll('.product-card').forEach(attachCardListener);




        function attachCardListener(card) {
            const img = card.querySelector('.product-image img');
            if (img) {
                img.addEventListener('click', () => {
                    console.log('Product image clicked');
                    let productData = extractProductData(card);
                    // Ensure images array
                    if (!productData.images || productData.images.length === 0) {
                        productData.images = [productData.image];
                    }
                    showDetailView(productData);
                });
            }

            // Menu Logic
            const menuBtn = card.querySelector('.card-menu-btn');
            const dropdown = card.querySelector('.card-menu-dropdown');
            const editBtn = card.querySelector('.edit-btn');
            const deleteBtn = card.querySelector('.delete-btn');

            if (menuBtn && dropdown) {
                // Toggle Dropdown
                menuBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    // Close others
                    document.querySelectorAll('.card-menu-dropdown.show').forEach(d => {
                        if (d !== dropdown) d.classList.remove('show');
                    });
                    dropdown.classList.toggle('show');
                });

                // Close on click outside (handled globally or here)
                document.addEventListener('click', (e) => {
                    if (!card.contains(e.target)) {
                        dropdown.classList.remove('show');
                    }
                });
            }

            // Delete Logic
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm('Do you want to delete this product?')) {
                        card.remove();
                        // Remove from Storage
                        const pData = extractProductData(card);
                        if (pData.id) {
                            try {
                                const products = JSON.parse(localStorage.getItem('products') || '[]');
                                const newProducts = products.filter(p => p.id != pData.id); // Loose for string/int safety
                                localStorage.setItem('products', JSON.stringify(newProducts));
                            } catch (err) { console.error('Delete error', err); }
                        }
                    }
                });
            }

            // Edit Logic
            if (editBtn) {
                editBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    dropdown.classList.remove('show');
                    const pData = extractProductData(card);
                    openEditDrawer(pData, card);
                });
            }
        }
    } else {
        console.log('Product detail view logic skipped (not on product page)');
    }


    // Global Fallback for Detail View & Edit Drawer
    if (typeof showDetailView === 'undefined') {
        window.showDetailView = function (data) { console.log('Detail view not active here', data); };
    }
    if (typeof openEditDrawer === 'undefined') {
        window.openEditDrawer = function (data) { console.log('Edit drawer not active here', data); };
    }


    // --- Global Helper Functions & Initialization ---

    function createProductCardHTML(product) {
        if (!product) return '';

        // Safety checks for all fields
        const id = product.id || '';
        const pid = product.product_id || product.id || 'N/A';
        const name = product.name || product.product_name || 'Unnamed Product';
        const desc = product.desc || product.product_description || '';
        const price = product.price !== undefined && product.price !== null ? product.price : '0.00';
        const category = product.category || product.product_category || 'Uncategorized';
        const brand = product.brand || product.brand_name || product.company_name || 'My Store';
        const stock = product.available_stock !== undefined ? product.available_stock : (product.quantity || 0);

        const isPublished = product.is_published === true;
        const statusBadge = isPublished
            ? '<span class="status-badge published" style="background:#d1fae5; color:#065f46; padding:2px 8px; border-radius:12px; font-size:0.75rem;">Published</span>'
            : '<span class="status-badge unpublished" style="background:#f3f4f6; color:#1f2937; padding:2px 8px; border-radius:12px; font-size:0.75rem;">Unpublished</span>';

        const publishAction = isPublished
            ? `<button class="menu-item unpublish-btn" data-id="${pid}"><i class="fas fa-eye-slash"></i> Unpublish</button>`
            : `<button class="menu-item publish-btn" data-id="${pid}"><i class="fas fa-globe"></i> Publish</button>`;

        // Normalize image
        let displayImg = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiBwcmVzZXJ2ZUFzcGVjdHJhdGlvPSJ4TWlkWU1pZCBzbGljZSIgZm9jdXNhYmxlPSJmYWxzZSIgcm9sZT0iaW1nIiBhcmlhLWxhYmVsPSJQbGFjZWhvbGRlciI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2VlZSI+PC9yZWN0Pjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmaWxsPSIjYWFhIiBkeT0iLjNlbSIgc3R5bGU9ImZvbnQtZmFtaWx5OkFyaWFsO2ZvbnQtc2l6ZToyMHB4O3RleHQtYW5jaG9yOm1pZGRsZSI+Tm8gSW1hZ2U8L3RleHQ+PC9zdmc+';
        if (product.image) displayImg = product.image;
        else if (product.images && product.images.length > 0) displayImg = product.images[0];

        return `
            <div class="product-card dynamic" data-id="${id}" data-pid="${pid}" data-category="${category}" data-price="${price.toString().replace('$', '')}" data-vendor="${brand}">
                <div class="product-image">
                    <img src="${displayImg}" alt="${name}" class="p-img">
                    <div class="card-badges" style="position:absolute; top:8px; left:8px; z-index:2;">
                        ${statusBadge}
                    </div>
                </div>
                <div class="product-info">
                    <h3>${name}</h3>
                    <p class="product-desc">${desc}</p>
                    <div class="product-meta">
                        <span class="vendor-name">${brand}</span>
                        <span class="product-price">₹${price}</span>
                    </div>
                    <div class="product-footer">
                        <span class="stock-pill">${stock} in stock</span>
                        <div class="card-menu-container">
                            <button class="card-menu-btn"><i class="fas fa-ellipsis-h"></i></button>
                            <div class="card-menu-dropdown">
                                ${publishAction}
                                <button class="menu-item add-to-website-btn"><i class="fas fa-plus"></i> Add to Website</button>
                                <button class="menu-item edit-btn"><i class="fas fa-edit"></i> Edit</button>
                                <button class="menu-item delete-btn"><i class="fas fa-trash"></i> Delete</button>
                            </div>
                        </div>
                    </div>
                </div>
                <!-- Hidden Data -->
                <div class="product-data" style="display:none;">
                    ${JSON.stringify(product)}
                </div>
            </div>
        `;
    }
    window.createProductCardHTML = createProductCardHTML;


    // Expose loadProducts globally for checkAuth
    async function loadProducts() {
        const grid = document.getElementById('productsGrid') || document.querySelector('.products-grid');
        if (!grid) {
            console.warn('[LOAD PRODUCTS] No product grid found in the current view.');
            return;
        }

        console.log('[LOAD PRODUCTS] Fetching products from API...', new Date().toISOString());

        let apiProducts = [];
        let loadedFromApi = false;

        try {
            const res = await fetch(`${window.API_BASE_URL || '/api'}/vendor/products`, {
                method: 'GET',
                credentials: 'include'
            });
            if (res.ok) {
                const result = await res.json();
                console.log('[LOAD PRODUCTS] API raw result:', result);
                if (result.products) {
                    apiProducts = result.products.map(p => {
                        // Normalize API data to match frontend expectations
                        let images = [];
                        try {
                            images = typeof p.product_images === 'string' ? JSON.parse(p.product_images || '[]') : p.product_images;
                        } catch (e) { images = []; }

                        return {
                            id: p.id,
                            product_id: p.product_id,
                            name: p.product_name,
                            desc: p.product_description,
                            price: p.price,
                            quantity: p.available_stock,
                            available_stock: p.available_stock,
                            brand: p.brand_name || p.company_name || 'My Store',
                            image: (images && images.length > 0) ? images[0] : null,
                            images: images,
                            category: p.product_category,
                            is_published: p.is_published
                        };
                    });
                    console.log(`[LOAD PRODUCTS] Successfully fetched ${apiProducts.length} products`);
                    loadedFromApi = true;
                }
            } else if (res.status === 401 || res.status === 403) {
                console.error('[LOAD PRODUCTS] Auth error (401/403).');
                localStorage.removeItem('products');
            } else {
                console.error(`[LOAD PRODUCTS] API error: ${res.status}`);
            }
        } catch (e) {
            console.error('[LOAD PRODUCTS] Network/Parse Error:', e);
        }

        // Final list
        const productsToRender = loadedFromApi ? apiProducts : JSON.parse(localStorage.getItem('products') || '[]');
        console.log(`[LOAD PRODUCTS] Rendering ${productsToRender.length} items...`);

        // Render
        grid.innerHTML = '';
        if (productsToRender.length === 0) {
            grid.innerHTML = '<div class="empty-state" style="text-align:center; padding:40px; color:#6b7280; grid-column: 1 / -1;">' +
                '<i class="fas fa-box-open" style="font-size:3rem; margin-bottom:1rem; display:block; opacity:0.3;"></i>' +
                'No products found. Start by adding one in the "Add Product" section!</div>';
        } else {
            productsToRender.forEach(product => {
                try {
                    const cardHTML = window.createProductCardHTML(product);
                    grid.insertAdjacentHTML('afterbegin', cardHTML);
                } catch (renderErr) {
                    console.error('[LOAD PRODUCTS] Failed to render product:', product, renderErr);
                }
            });

            // Re-apply filters to match current UI state
            if (typeof filterProducts === 'function') {
                console.log('[LOAD PRODUCTS] Applying UI filters...');
                filterProducts();
            }
        }

        // Re-attach listeners
        document.querySelectorAll('.product-card').forEach(attachGlobalCardListener);
    }
    window.loadProducts = loadProducts;

    function attachGlobalCardListener(card) {
        const img = card.querySelector('.product-image img');
        if (img) {
            img.addEventListener('click', () => {
                let productData = extractProductData(card);
                if (!productData.images || productData.images.length === 0) {
                    productData.images = [productData.image];
                }
                if (window.showDetailView) window.showDetailView(productData);
            });
        }

        const menuBtn = card.querySelector('.card-menu-btn');
        const dropdown = card.querySelector('.card-menu-dropdown');
        const editBtn = card.querySelector('.edit-btn');
        const deleteBtn = card.querySelector('.delete-btn');

        if (menuBtn && dropdown) {
            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('.card-menu-dropdown.show').forEach(d => {
                    if (d !== dropdown) d.classList.remove('show');
                });
                dropdown.classList.toggle('show');
            });
            document.addEventListener('click', (e) => {
                if (!card.contains(e.target)) dropdown.classList.remove('show');
            });
        }

        if (deleteBtn) {
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const pid = deleteBtn.getAttribute('data-id') || card.getAttribute('data-pid');
                if (!pid) return alert('Error: Product ID not found');

                if (confirm('Delete product? This cannot be undone.')) {
                    try {
                        deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                        await ApiService.delete(`/vendor/products/${pid}`);
                        card.remove();
                        // Also remove from local cache to prevent seeing it on immediate reload if cache used
                        try {
                            const prods = JSON.parse(localStorage.getItem('products') || '[]');
                            const newP = prods.filter(p => p.id != pid && p.product_id != pid);
                            localStorage.setItem('products', JSON.stringify(newP));
                        } catch (e) { }
                        alert('Product deleted successfully');
                    } catch (err) {
                        console.error(err);
                        alert('Delete failed: ' + err.message);
                        deleteBtn.innerHTML = '<i class="fas fa-trash"></i> Delete';
                    }
                }
            });
        }
        if (editBtn) {
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.remove('show');
                const pData = extractProductData(card);
                if (window.openEditDrawer) window.openEditDrawer(pData, card);
            });

        }

        const addToWebsiteBtn = card.querySelector('.add-to-website-btn');
        if (addToWebsiteBtn) {
            addToWebsiteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.remove('show');
                const pData = extractProductData(card);
                // Tag with current vendor ID so orders can be filtered
                pData.vendor_id = localStorage.getItem('vendorId') || 'unknown';

                // Add to vendorWebsiteProducts in localStorage (vendor-specific)
                try {
                    const vendorId = localStorage.getItem('vendorId');
                    if (!vendorId) {
                        alert('Vendor ID not found. Please log in again.');
                        return;
                    }

                    const vendorKey = `vendorWebsiteProducts_${vendorId}`;
                    const currentWebsiteProducts = JSON.parse(localStorage.getItem(vendorKey) || '[]');

                    // Check for duplicates
                    const exists = currentWebsiteProducts.some(p => p.id === pData.id);
                    if (exists) {
                        alert('Product is already added to your website!');
                        return;
                    }

                    currentWebsiteProducts.push(pData);
                    localStorage.setItem(vendorKey, JSON.stringify(currentWebsiteProducts));
                    alert('Product added to Website successfully');
                } catch (err) {
                    console.error('Error adding to website:', err);
                    alert('Failed to add product to website.');
                }
            });
        }

        // Publish/Unpublish Logic
        const publishBtn = card.querySelector('.publish-btn');
        const unpublishBtn = card.querySelector('.unpublish-btn');

        if (publishBtn) {
            publishBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                dropdown.classList.remove('show');
                const pid = publishBtn.getAttribute('data-id');
                if (!pid) return alert('Error: Product ID not found');

                if (confirm('Publish this product to marketonex?')) {
                    try {
                        publishBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Publishing...';
                        const res = await fetch(`${window.API_BASE_URL || '/api'}/marketonex/products/${pid}/publish`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' }, // Credentials handled globally if set, else rely on cookie
                            credentials: 'include', // Important for session based auth
                            body: JSON.stringify({})
                        });
                        const data = await res.json();
                        if (res.ok) {
                            alert('Product Published Successfully!');
                            location.reload(); // Reload to show updated status (or update DOM dynamically)
                        } else {
                            alert('Publish Failed: ' + (data.error || data.message));
                            publishBtn.innerHTML = '<i class="fas fa-globe"></i> Publish';
                        }
                    } catch (err) {
                        console.error(err);
                        alert('Network Error: ' + err.message);
                        publishBtn.innerHTML = '<i class="fas fa-globe"></i> Publish';
                    }
                }
            });
        }

        if (unpublishBtn) {
            unpublishBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                dropdown.classList.remove('show');
                const pid = unpublishBtn.getAttribute('data-id');
                if (!pid) return alert('Error: Product ID not found');

                if (confirm('Unpublish this product from marketonex?')) {
                    try {
                        unpublishBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
                        const res = await fetch(`${window.API_BASE_URL || '/api'}/marketonex/products/${pid}/unpublish`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({})
                        });
                        const data = await res.json();
                        if (res.ok) {
                            alert('Product Unpublished Successfully!');
                            location.reload();
                        } else {
                            alert('Unpublish Failed: ' + (data.error || data.message));
                            unpublishBtn.innerHTML = '<i class="fas fa-eye-slash"></i> Unpublish';
                        }
                    } catch (err) {
                        console.error(err);
                        alert('Network Error: ' + err.message);
                        unpublishBtn.innerHTML = '<i class="fas fa-eye-slash"></i> Unpublish';
                    }
                }
            });
        }
    }

    function extractProductData(card) {
        let productData = {};
        const hiddenData = card.querySelector('.product-data');
        if (hiddenData) {
            try { return JSON.parse(hiddenData.textContent); } catch (e) { }
        }
        const img = card.querySelector('.product-image img');
        return {
            id: card.getAttribute('data-id') || 'static',
            name: card.querySelector('h3')?.textContent || '',
            desc: card.querySelector('.product-desc')?.textContent || '',
            price: card.querySelector('.product-price')?.textContent || '',
            brand: card.querySelector('.vendor-name')?.textContent || '',
            quantity: parseInt(card.querySelector('.stock-pill')?.textContent) || 0,
            image: img ? img.src : '',
            images: img ? [img.src] : [],
            category: card.getAttribute('data-category') || 'Uncategorized',
            model: '', color: '', warranty: '', features: ''
        };
    }

    // Call load globally removed - moved to checkAuth to prevent 403 race condition
    // loadProducts();


    // --- Settings & Profile Logic ---
    const changePhotoBtn = document.querySelector('.change-photo-btn');
    const removePhotoBtn = document.querySelector('.remove-photo-btn');
    const profileUpload = document.getElementById('profile-upload');
    const profileImg = document.querySelector('.settings-profile-img');
    const topBarAvatar = document.querySelector('.user-avatar img');

    if (changePhotoBtn && profileUpload) {
        changePhotoBtn.addEventListener('click', () => {
            profileUpload.click();
        });

        profileUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // 1. Immediate local preview
            const reader = new FileReader();
            reader.onload = function (ev) {
                const previewSrc = ev.target.result;
                if (profileImg) profileImg.src = previewSrc;
                if (topBarAvatar) topBarAvatar.src = previewSrc;
            };
            reader.readAsDataURL(file);

            // 2. Upload to backend for persistence
            try {
                const formData = new FormData();
                formData.append('photo', file);

                const res = await fetch('/api/profile/upload-photo', {
                    method: 'POST',
                    credentials: 'include',
                    body: formData
                });

                const result = await res.json();
                if (!res.ok) throw new Error(result.error || 'Upload failed');

                const url = result.profile_picture + '?t=' + Date.now();
                if (profileImg) profileImg.src = url;
                if (topBarAvatar) topBarAvatar.src = url;
                document.querySelectorAll('.user-avatar img').forEach(img => img.src = url);
                alert('Profile photo updated!');
            } catch (err) {
                console.error('[Common] Photo upload error:', err);
                alert('Photo upload failed: ' + err.message);
            }
        });
    }

    if (removePhotoBtn) {
        removePhotoBtn.addEventListener('click', () => {
            const defaultImg = 'https://i.pravatar.cc/150?img=12';
            if (profileImg) profileImg.src = defaultImg;
            if (topBarAvatar) topBarAvatar.src = defaultImg;
            localStorage.removeItem('profileImage');
            alert('Profile photo removed!');
        });
    }





    // --- Settings Tabs & Forms ---
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            const targetContent = document.getElementById(`${tabId}-tab`);
            if (targetContent) targetContent.classList.add('active');
        });
    });

    const setupSaveHandler = (btnSelector, inputsSelector, storageKey, successMsg) => {
        const btn = document.querySelector(btnSelector);
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const data = {};
                document.querySelectorAll(inputsSelector).forEach(input => {
                    if (input.type === 'checkbox') {
                        data[input.id || input.name] = input.checked;
                    } else {
                        data[input.id || input.name || input.placeholder] = input.value;
                    }
                });
                try {
                    localStorage.setItem(storageKey, JSON.stringify(data));
                    alert(successMsg);
                } catch (err) { alert('Save failed: ' + err.message); }
            });
        }
    };

    // Account Tab (Profile) - API Integration & Validation
    const accountSaveBtn = document.querySelector('#account-tab .save-btn');
    if (accountSaveBtn) {
        accountSaveBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const fullname = document.getElementById('u-name').value.trim();
            const email = document.getElementById('u-email').value.trim();
            const phone = document.getElementById('u-phone').value.trim();
            const address = document.getElementById('u-address').value.trim();
            const city = document.getElementById('u-city').value.trim();
            const state = document.getElementById('u-state').value.trim();
            const dob = document.getElementById('u-dob').value;
            const gender = document.getElementById('u-gender').value;

            // Validation
            if (fullname.length < 2) return alert('Name must be at least 2 characters.');
            if (email && !email.includes('@')) return alert('Invalid email.');
            if (phone && !/^\d{10}$/.test(phone)) return alert('Phone must be a valid 10-digit number.');
            if (address && address.length < 5) return alert('Address must be at least 5 characters.');
            if (city && city.length < 2) return alert('City must be valid.');
            if (state && state.length < 2) return alert('State must be valid.');

            if (dob) {
                const dobDate = new Date(dob);
                const today = new Date();
                if (dobDate >= today) return alert('Date of Birth must be in the past.');
            }

            const data = { name: fullname, email, phone, address, city, state, dob, gender };
            try {
                await ApiService.updateProfile(data);
                alert('Profile updated successfully!');
            } catch (err) {
                alert('Update failed: ' + err.message);
            }
        });
    }

    // Business Tab - API Integration
    const businessSaveBtn = document.querySelector('#business-tab .save-btn');
    if (businessSaveBtn) {
        businessSaveBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const business_name = document.getElementById('b-name').value.trim();
            const tax_id = document.getElementById('b-tax').value.trim();
            const address = document.getElementById('b-address').value.trim();

            if (!business_name) return alert('Business Name is required.');

            try {
                await ApiService.updateBusinessInfo({ business_name, tax_id, address });
                alert('Business details saved!');
            } catch (err) {
                alert('Save failed: ' + err.message);
            }
        });
    }

    // Insights - Generate Recommendations
    const generateBtn = document.querySelector('.generate-btn');
    const recommendationsContent = document.getElementById('recommendationsContent');

    if (generateBtn && recommendationsContent) {
        generateBtn.addEventListener('click', () => {
            // Show Loading
            recommendationsContent.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon"><i class="fas fa-spinner fa-spin"></i></div>
                    <h4>Analyzing Sales Data...</h4>
                    <p>Please wait while we generate stock recommendations.</p>
                </div>
            `;

            // Mock API Delay
            setTimeout(() => {
                // Mock Recommendation Logic (In real app, fetch from /api/stats)
                const recommendations = [
                    { name: 'Classic Blue Jeans', action: 'Restock', confidence: 'High', reason: 'Sales increased by 20% in last 7 days.' },
                    { name: 'Red Cotton T-Shirt', action: 'Clearance', confidence: 'Medium', reason: 'Low sales volume for 30 days.' },
                    { name: 'Leather Jacket', action: 'Hold', confidence: 'High', reason: 'Stable demand matching current stock.' }
                ];

                let html = '<div class="recommendations-list">';
                recommendations.forEach(rec => {
                    const color = rec.action === 'Restock' ? 'green' : (rec.action === 'Clearance' ? 'red' : 'orange');
                    html += `
                        <div class="recommendation-item" style="padding: 15px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <h4 style="margin: 0;">${rec.name}</h4>
                                <p style="margin: 5px 0 0; color: #666; font-size: 0.9em;">${rec.reason}</p>
                            </div>
                            <div class="rec-badge" style="background: ${color}; color: white; padding: 5px 10px; border-radius: 20px; font-size: 0.8em; font-weight: bold;">
                                ${rec.action}
                            </div>
                        </div>
                    `;
                });
                html += '</div>';

                recommendationsContent.innerHTML = html;
            }, 1500);
        });
    }

    // Load Data on settings page
    async function loadSettingsData() {
        try {
            const profile = await ApiService.getProfile();
            if (document.getElementById('setting-name')) {
                document.getElementById('setting-name').value = profile.full_name || '';
                document.getElementById('setting-email').value = profile.email || '';
                document.getElementById('setting-phone').value = profile.phone || '';
                document.getElementById('setting-address').value = profile.address || '';
                document.getElementById('setting-city').value = profile.city || '';
                document.getElementById('setting-state').value = profile.state || '';
                if (profile.dob) document.getElementById('setting-dob').value = profile.dob;
                if (profile.gender) document.getElementById('setting-gender').value = profile.gender;
            }

            const business = await ApiService.getBusinessInfo();
            if (document.getElementById('setting-business-name')) {
                document.getElementById('setting-business-name').value = business.business_name || '';
                document.getElementById('setting-tax-id').value = business.tax_id || '';
                document.getElementById('setting-business-address').value = business.address || '';
            }
        } catch (e) { console.error('Error loading settings api data', e); }
    }
    // Only load settings data if we are on the settings page
    if (document.getElementById('setting-name')) {
        loadSettingsData();
    }

    setupSaveHandler('#payouts-tab .save-btn', '#payouts-tab input', 'payoutSettings', 'Payout details saved!');
    setupSaveHandler('#notifications-tab .save-btn', '#notifications-tab input[type="checkbox"]', 'notificationSettings', 'Notification preferences saved!');
    setupSaveHandler('#store-tab .save-btn', '#store-tab textarea', 'storeSettings', 'Store policies saved!');

    const loadSettings = () => {
        const keys = ['accountSettings', 'businessSettings', 'payoutSettings', 'notificationSettings', 'storeSettings'];
        keys.forEach(key => {
            const saved = localStorage.getItem(key);
            if (saved) {
                try {
                    const data = JSON.parse(saved);
                    Object.keys(data).forEach(fieldId => {
                        let el = document.getElementById(fieldId);
                        if (!el) el = document.querySelector(`[name="${fieldId}"]`);

                        if (el && el.type === 'checkbox') {
                            el.checked = data[fieldId];
                        } else if (el) {
                            el.value = data[fieldId];
                        }
                    });
                } catch (e) { }
            }
        });
    };
    loadSettings();

    // User Info Page Logic
    if (document.getElementById('user-info-page') || document.getElementById('userProfileForm')) {
        const userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
        Object.keys(userProfile).forEach(k => {
            const el = document.getElementById(k);
            if (el) el.value = userProfile[k];
        });

        const saveBtn = document.getElementById('saveUserProfileBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const data = {};
                document.querySelectorAll('#userProfileForm input').forEach(i => data[i.id] = i.value);
                localStorage.setItem('userProfile', JSON.stringify(data));
                alert('Profile Saved');
            });
        }
    }

    // Smooth Scroll 
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function (e) {
            document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // --- Authentication Handlers ---
    // NOTE: loginForm is handled exclusively by login.js.
    // Do NOT add a loginForm listener here to avoid dual API calls and JSON parse errors.

    // NOTE: Signup form is handled exclusively by signup.js.
    // Do NOT add a signupForm listener here to avoid dual API calls.


    // --- Profile Save (User Info Page) Update to API ---
    // Overwriting the previous localStorage logic for #userProfileForm
    const saveUserProfileBtnApi = document.getElementById('saveUserProfileBtn');
    if (saveUserProfileBtnApi) {
        // Clone and replace to remove old listener if any, or just add new and ensure it takes precedence
        // Actually, we can just replace the logic inside the previous block or add a new one.
        // Let's rely on the ID check.
        // We need to stop the previous listener? 
        // Best to just use the new API Service logic here.

        // Remove old listener by cloning
        const newBtn = saveUserProfileBtnApi.cloneNode(true);
        saveUserProfileBtnApi.parentNode.replaceChild(newBtn, saveUserProfileBtnApi);

        newBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const btn = newBtn;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
            btn.disabled = true;

            const data = {
                name: document.getElementById('u-name')?.value,
                email: document.getElementById('u-email')?.value,
                phone: document.getElementById('u-phone')?.value,
                address: document.getElementById('u-address')?.value,
                city: document.getElementById('u-city')?.value,
                state: document.getElementById('u-state')?.value,
                dob: document.getElementById('u-dob')?.value,
                gender: document.getElementById('u-gender')?.value
            };

            try {
                const res = await ApiService.request('/vendor/profile', 'PUT', data);
                updateUIWithUser(res.user || res.vendor || res);
                alert('Profile updated successfully!');
            } catch (err) {
                alert('Update failed: ' + err.message);
            } finally {
                btn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
                btn.disabled = false;
            }
        });
    }

});

/**
 * 3D Review System Integration
 */
async function loadVendorReviews() {
    const vendorId = localStorage.getItem('vendorId');
    const grid = document.getElementById('vendorReviewGrid');
    if (!grid) return;

    if (!vendorId) {
        grid.innerHTML = '<div class="no-reviews">Error: Vendor ID not found in session</div>';
        return;
    }

    try {
        const res = await ApiService.get(`/feedback/vendor/${vendorId}`);
        const { feedback, count, average_rating } = res;

        // 1. Update Stats Display
        const avgDisplay = document.getElementById('avgRatingDisplay');
        const countDisplay = document.getElementById('reviewCountDisplay');
        const starsDisplay = document.getElementById('avgStarsDisplay');
        const dashRating = document.getElementById('dashboardOverallRating');

        if (avgDisplay) animateNumber(avgDisplay, 0, average_rating, 1500);
        if (dashRating) dashRating.textContent = average_rating.toFixed(1);
        if (countDisplay) countDisplay.textContent = `Based on ${count} reviews from your products.`;
        if (starsDisplay) starsDisplay.innerHTML = generateStarRating(average_rating);

        // 2. Render Review Cards
        if (!feedback || feedback.length === 0) {
            grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 40px; background: var(--bg-card); border: 1px dashed var(--border-color); border-radius: 12px;">No reviews yet. Share your store link to get feedback!</div>';
            return;
        }

        grid.innerHTML = feedback.map((f, index) => `
            <div class="review-card-3d" style="animation-delay: ${index * 0.1}s">
                <div class="reviewer-header">
                    <span class="reviewer-name">${f.name}</span>
                    <span class="review-product-tag">${f.product_name}</span>
                </div>
                <div class="review-stars">
                    ${generateStarRating(f.rating)}
                </div>
                <p class="review-text">${f.message}</p>
                <span class="review-date">${new Date(f.created_at).toLocaleDateString()}</span>
            </div>
        `).join('');

    } catch (err) {
        console.error('Failed to load reviews:', err);
        if (grid) grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--accent-red); padding: 20px;">Failed to load reviews: ${err.message}</div>`;
    }
}

function generateStarRating(rating) {
    let stars = '';
    const fullStars = Math.floor(rating);
    const hasHalfStar = (rating % 1) >= 0.5;

    for (let i = 1; i <= 5; i++) {
        if (i <= fullStars) {
            stars += '<i class="fas fa-star star-icon"></i>';
        } else if (i === fullStars + 1 && hasHalfStar) {
            stars += '<i class="fas fa-star-half-alt star-icon"></i>';
        } else {
            stars += '<i class="far fa-star star-icon empty"></i>';
        }
    }
    return stars;
}

function animateNumber(element, start, end, duration) {
    if (!element) return;
    let startTime = null;
    const step = (timestamp) => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        const current = (progress * (end - start) + start).toFixed(1);
        element.textContent = current;
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

/* ================================================================
   VENDOR PROFILE SYNC — populates dynamic vendor fields site-wide
   ================================================================ */
async function syncVendorProfile() {
    try {
        const res = await fetch('/api/profile', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        const user = data.vendor || data.customer || data.user || data;
        if (!user) return;

        // Top-bar avatar — use DB as primary source; fall back to placeholder only if no pic at all
        const pic = user.profile_picture || user.photo_url || '';
        if (pic) {
            const cacheBustedUrl = pic + '?t=' + Date.now();
            document.querySelectorAll('.user-avatar img, #topbarAvatar, #userInfoProfileImg').forEach(img => {
                img.src = cacheBustedUrl;
            });
        }

        // Helper utils
        const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '\u2014'; };

        // vender_profile.html profile card
        setTxt('profileName', user.fullname || user.name);
        setTxt('profileEmail', user.email);
        setTxt('profilePhone', user.phone || user.phone_number);
        setTxt('profileDob', user.date_of_birth || user.dob);
        setTxt('profileBusinessName', user.business_name || user.biz_name);

        // Dynamic Back to Landing Page Link & My Store URL
        const backBtn = document.getElementById('backToLandingPage');
        const storeUrlEl = document.getElementById('displayStoreURL');

        if (backBtn || storeUrlEl) {
            const slug = user.vendor_slug || user.slug;
            if (slug) {
                const cleanUrl = `${window.location.origin}/vendor/${slug}`;

                if (backBtn) backBtn.href = cleanUrl;
                if (storeUrlEl) storeUrlEl.textContent = cleanUrl;

                // Store in window for open/copy functions
                window.vendorStoreURL = cleanUrl;
            }
        }

        // Business verification badge
        const biz = document.getElementById('profileBizStatusBadge');
        if (biz) {
            const s = (user.biz_verification_status || 'pending').toLowerCase();
            const map = {
                approved: { cls: 'approved', label: 'Approved' },
                pending: { cls: 'pending', label: 'Pending' },
                rejected: { cls: 'rejected', label: 'Rejected' },
            };
            const cfg = map[s] || map['pending'];
            biz.className = 'status-badge ' + cfg.cls;
            biz.textContent = cfg.label;
        }

        // user-info.html avatar meta
        const avatarName = document.getElementById('avatarName');
        const avatarEmail = document.getElementById('avatarEmail');
        if (avatarName) avatarName.textContent = user.fullname || user.name || '\u2014';
        if (avatarEmail) avatarEmail.textContent = user.email || '\u2014';

    } catch (err) {
        console.warn('[syncVendorProfile]', err.message);
    }
}

// Auto-run after page load on all vendor pages
if (!window.location.pathname.includes('loginvender') &&
    !window.location.pathname.includes('signup')) {
    window.addEventListener('load', () => setTimeout(syncVendorProfile, 400));
}

/* ================================================================
   PAGINATOR — generic reusable pagination widget
   new Paginator(items[], perPage, renderFn, '#containerSelector')
   ================================================================ */
class Paginator {
    constructor(items, perPage, renderFn, containerSel) {
        this._all = items || [];
        this._perPage = perPage || 10;
        this._renderFn = renderFn;
        this._container = document.querySelector(containerSel);
        this._current = 1;
    }

    get _totalPages() { return Math.max(1, Math.ceil(this._all.length / this._perPage)); }

    init() { this._render(); }

    setData(newItems) { this._all = newItems || []; this._current = 1; this._render(); }

    goTo(page) {
        this._current = Math.min(Math.max(1, page), this._totalPages);
        this._render();
    }

    _render() {
        const start = (this._current - 1) * this._perPage;
        this._renderFn(this._all.slice(start, start + this._perPage));
        this._renderBar();
    }

    _renderBar() {
        if (!this._container) return;
        if (this._totalPages <= 1) { this._container.innerHTML = ''; return; }
        const c = this._current, t = this._totalPages;
        let html = '<nav class="pagination-bar" aria-label="Pagination">';
        html += `<button class="pg-btn pg-prev" ${c === 1 ? 'disabled' : ''} aria-label="Previous">
                    <i class="fas fa-chevron-left"></i>
                 </button>`;
        this._pageRange(c, t).forEach(p => {
            if (p === '\u2026') {
                html += `<span class="pg-ellipsis">\u2026</span>`;
            } else {
                html += `<button class="pg-btn pg-num${p === c ? ' active' : ''}" data-page="${p}">${p}</button>`;
            }
        });
        html += `<button class="pg-btn pg-next" ${c === t ? 'disabled' : ''} aria-label="Next">
                    <i class="fas fa-chevron-right"></i>
                 </button>`;
        html += `<span class="pg-info">Page ${c} of ${t}</span>`;
        html += '</nav>';
        this._container.innerHTML = html;
        this._container.querySelectorAll('.pg-num').forEach(btn =>
            btn.addEventListener('click', () => this.goTo(+btn.dataset.page)));
        const prev = this._container.querySelector('.pg-prev');
        const next = this._container.querySelector('.pg-next');
        if (prev) prev.addEventListener('click', () => this.goTo(c - 1));
        if (next) next.addEventListener('click', () => this.goTo(c + 1));
    }

    _pageRange(c, t) {
        if (t <= 7) return Array.from({ length: t }, (_, i) => i + 1);
        const r = [1];
        if (c > 3) r.push('\u2026');
        for (let p = Math.max(2, c - 1); p <= Math.min(t - 1, c + 1); p++) r.push(p);
        if (c < t - 2) r.push('\u2026');
        r.push(t);
        return r;
    }
}

window.Paginator = Paginator;
window.syncVendorProfile = syncVendorProfile;

/**
 * Clean URL Actions for Vendor Dashboard
 */
function openStore() {
    if (window.vendorStoreURL) {
        window.open(window.vendorStoreURL, '_blank');
    } else {
        alert('Store URL not available yet.');
    }
}

function copyStoreLink() {
    if (window.vendorStoreURL) {
        navigator.clipboard.writeText(window.vendorStoreURL).then(() => {
            alert('Store link copied to clipboard!');
        }).catch(err => {
            console.error('Copy failed', err);
            const el = document.createElement('textarea');
            el.value = window.vendorStoreURL;
            document.body.appendChild(el);
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);
            alert('Store link copied to clipboard!');
        });
    } else {
        alert('Store URL not available yet.');
    }
}

window.openStore = openStore;
window.copyStoreLink = copyStoreLink;

