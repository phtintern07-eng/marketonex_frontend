// ================= ORDERS PAGE JS =================
// JavaScript logic used for handling vendor orders functionality
// Code originally from orders.js


document.addEventListener('DOMContentLoaded', () => {
    fetchOrders();

    // Filter tab listeners
    const filterButtons = document.querySelectorAll('.tab-pill');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterButtons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            const filter = e.target.getAttribute('data-filter');
            filterOrders(filter);
        });
    });

    // Search listener — resets paginator to page 1 on each keystroke
    const searchInput = document.getElementById('ordersSearch');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const q = searchInput.value.toLowerCase();
            const filtered = allOrders.filter(o =>
                (o.customer_name || o.fullname || '').toLowerCase().includes(q) ||
                (o.customer_email || o.email || '').toLowerCase().includes(q) ||
                String(o.vendor_order_id || o.order_id || o.id).toLowerCase().includes(q)
            );
            if (ordersPaginator) {
                ordersPaginator.setData(filtered);
            } else {
                renderOrders(filtered);
            }
        });
    }
});

let allOrders = [];
let ordersPaginator = null;

async function fetchOrders() {
    const tableBody = document.getElementById('ordersTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding: 20px;">Loading orders...</td></tr>';

    try {
        const res = await fetch('/api/vendor/orders', { credentials: 'include' });

        if (res.status === 401 || res.status === 403) {
            tableBody.innerHTML = `<tr><td colspan="10" style="text-align:center; color:red;">You are not logged in as a vendor. Please <a href="/vendor/login.html">log in</a>.</td></tr>`;
            return;
        }

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `Server error ${res.status}`);
        }

        const data = await res.json();
        allOrders = data.orders || [];

        // Init paginator (10 orders per page)
        ordersPaginator = new Paginator(
            allOrders,
            10,
            renderOrders,
            '#ordersPaginationContainer'
        );
        ordersPaginator.init();
        updateStats(allOrders);

    } catch (error) {
        console.error('Error loading orders:', error);
        tableBody.innerHTML = `<tr><td colspan="10" style="text-align:center; color:red;">Failed to load orders: ${error.message} <button onclick="fetchOrders()" style="margin-left:8px;">Retry</button></td></tr>`;
    }
}

async function updateOrderStatus(orderId, newStatus) {
    try {
        const res = await fetch(`/api/orders/${orderId}/status`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        if (!res.ok) throw new Error('Status update failed');
        // Refresh rows in place
        const order = allOrders.find(o => (o.vendor_order_id || o.order_id) === orderId);
        if (order) order.status = newStatus;
        if (ordersPaginator) ordersPaginator.refresh();
        else renderOrders(allOrders);
    } catch (e) {
        alert('Failed to update order status: ' + e.message);
    }
}


function renderOrders(orders) {
    const tableBody = document.getElementById('ordersTableBody');
    if (!tableBody) return;

    if (orders.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="10" style="text-align:center; padding: 40px;">
                    <div style="color: #64748b;">
                        <i class="fas fa-box-open" style="font-size: 48px; margin-bottom: 10px;"></i>
                        <p>No orders found yet</p>
                    </div>
                </td>
            </tr>`;
        return;
    }

    tableBody.innerHTML = orders.map(order => `
        <tr>
            <td><input type="checkbox"></td>
            <td>
                <span class="order-id">#${order.vendor_order_id || order.order_id || order.id}</span>
            </td>
            <td>
                <div class="date-cell">
                    <span class="date">${formatDate(order.created_at)}</span>
                    <span class="time">${formatTime(order.created_at)}</span>
                </div>
            </td>
            <td>
                <div class="customer-cell">
                    <div class="customer-info">
                        <span class="name">${order.customer_name || order.fullname || 'Guest'}</span>
                        <span class="email">${order.customer_email || order.email || ''}</span>
                    </div>
                </div>
            </td>
            <td>
                <span class="badge payment-${(order.payment_method || 'cod').toLowerCase()}">
                    ${(order.payment_method || 'COD').toUpperCase()}
                </span>
            </td>
            <td>₹${parseFloat(order.total || 0).toFixed(2)}</td>
            <td>
                <span class="badge status-${(order.status || 'pending').toLowerCase()}">
                    ${capitalize(order.status || 'pending')}
                </span>
            </td>
            <td>${order.items ? order.items.length + ' items' : '0 items'}</td>
            <td>
                <span class="fulfillment-pill ${(order.status === 'delivered') ? 'fulfilled' : 'unfulfilled'}">
                    ${order.status === 'delivered' ? 'Fulfilled' : 'Unfulfilled'}
                </span>
            </td>
            <td style="text-align: right;">
                <select onchange="updateOrderStatus('${order.parent_order_id || order.order_id || order.id}', this.value)"
                        style="padding:4px 8px; border-radius:6px; border:1px solid #ccc; font-size:0.85em; cursor:pointer;">
                    <option value="">Change Status</option>
                    <option value="pending"    ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
                    <option value="confirmed"  ${order.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
                    <option value="shipped"    ${order.status === 'shipped' ? 'selected' : ''}>Shipped</option>
                    <option value="delivered"  ${order.status === 'delivered' ? 'selected' : ''}>Delivered</option>
                    <option value="cancelled"  ${order.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                </select>
            </td>
        </tr>

    `).join('');
}

function updateStats(orders) {
    const totalOrders = orders.length;
    const totalItems = orders.reduce((acc, order) => {
        if (!order.items) return acc;
        return acc + order.items.reduce((s, item) => s + (item.quantity || 1), 0);
    }, 0);
    const fulfilled = orders.filter(o => o.status === 'delivered' || o.fulfillment === 'Fulfilled').length;
    const returns = orders.filter(o => o.status === 'returned').length;

    const elTotal = document.getElementById('stat-total-orders');
    const elItems = document.getElementById('stat-order-items');
    const elFulfilled = document.getElementById('stat-fulfilled');
    const elReturns = document.getElementById('stat-returns');

    if (elTotal) elTotal.textContent = totalOrders;
    if (elItems) elItems.textContent = totalItems;
    if (elFulfilled) elFulfilled.textContent = fulfilled;
    if (elReturns) elReturns.textContent = returns;
}

function filterOrders(status) {
    let filtered = allOrders;
    if (status === 'unfulfilled') {
        filtered = allOrders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled');
    } else if (status === 'open') {
        filtered = allOrders.filter(o => o.status === 'pending' || o.status === 'confirmed');
    } else if (status === 'closed') {
        filtered = allOrders.filter(o => o.status === 'delivered' || o.status === 'cancelled');
    } else if (status === 'unpaid') {
        filtered = allOrders.filter(o => o.payment_method === 'cod' && o.status !== 'delivered');
    }
    if (ordersPaginator) {
        ordersPaginator.setData(filtered);
    } else {
        renderOrders(filtered);
    }
}

// Utilities
function formatDate(isoString) {
    if (!isoString) return '-';
    return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(isoString) {
    if (!isoString) return '';
    return new Date(isoString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}


// ================= FEEDBACK PAGE JS =================
// JavaScript used for managing vendor feedback interactions
// Code originally from feedback.js

document.addEventListener('DOMContentLoaded', async () => {
    // Extract product_id from URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('product_id');
    const productType = urlParams.get('product_type') || 'marketonex';

    const baseUrl = window.API_BASE_URL || '';

    // 1. Check Auth and Autofill
    try {
        const authRes = await fetch(`${baseUrl}/api/auth/status`, { credentials: 'include' });
        const authData = await authRes.json();

        // /api/auth/status returns { isAuthenticated: true/false, user: {...} }
        if (!authData.isAuthenticated) {
            alert("Please login to submit a review.");
            window.location.href = '../marketonex/login.html';
            return;
        }

        // Autofill Name and Email
        if (authData.user) {
            // API returns 'name' field (fullname fallback for compatibility)
            if (document.getElementById('name')) document.getElementById('name').value = authData.user.name || authData.user.fullname || '';
            if (document.getElementById('email')) {
                document.getElementById('email').value = authData.user.email || '';
                document.getElementById('email').readOnly = true; // Lock email to session user
            }
        }

        // 2. Check if already reviewed
        if (productId) {
            const statusRes = await fetch(`${baseUrl}/api/feedback/status/${productId}`, { credentials: 'include' });
            const statusData = await statusRes.json();
            if (statusData.has_reviewed) {
                alert("You have already reviewed this product.");
                window.location.href = `../marketonex/marketonex.html`;
                return;
            }
        }
    } catch (err) {
    }

    // Populate product ID fields
    if (productId) {
        document.getElementById('product-id-hidden').value = productId;
        document.getElementById('product-id-display').value = productId;
    }

    // 2. Image Upload Preview
    const imageInput = document.getElementById('image-upload');
    const imagePreview = document.getElementById('image-preview');
    let uploadedImageBase64 = null; // Store base64 data here

    if (imageInput) imageInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                uploadedImageBase64 = e.target.result; // Store raw base64 string
                imagePreview.style.backgroundImage = `url(${e.target.result})`;
                imagePreview.classList.add('visible');
            };
            reader.readAsDataURL(file);
        } else {
            uploadedImageBase64 = null;
            imagePreview.classList.remove('visible');
            imagePreview.style.backgroundImage = '';
        }
    });

    // 3. Form Submission
    const feedbackForm = document.getElementById('feedbackForm');
    if (!feedbackForm) return; // Not on the feedback page, stop here
    feedbackForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Get product ID from hidden field (optional)
        const productIdValue = document.getElementById('product-id-hidden').value || null;

        // Check if rating is selected
        const ratingElement = document.querySelector('input[name="rating"]:checked');
        if (!ratingElement) {
            alert('Please select a rating.');
            return;
        }

        // Gather Form Data
        const reviewData = {
            product_id: productIdValue,
            product_type: productType,
            reviewerName: document.getElementById('name').value,
            // reviewerEmail is handled by backend session, but we send it for redundancy/integrity
            reviewerEmail: document.getElementById('email').value || '',
            rating: parseInt(ratingElement.value),
            category: document.querySelector('input[name="category"]:checked').value,
            message: document.getElementById('message').value,
            recommend: document.querySelector('input[name="recommend"]:checked').value,
            image: uploadedImageBase64 || null,
            date: new Date().toISOString()
        };

        // Gather Form Data
        // Send data to backend API
        try {
            const response = await fetch('/api/feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(reviewData)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to submit feedback');
            }

            // Show Success Modal
            const successModal = document.getElementById('success-modal');
            successModal.classList.remove('hidden');
            successModal.classList.add('visible');

            // Reset form
            feedbackForm.reset();
            uploadedImageBase64 = null;
            imagePreview.classList.remove('visible');
            imagePreview.style.backgroundImage = '';

        } catch (error) {
            alert('Failed to submit feedback: ' + error.message + '\n\nPlease try again.');
        }
    });

    // Close Modal button
    document.getElementById('close-modal-btn').addEventListener('click', () => {
        window.location.href = '../marketonex/marketonex.html';
    });
});


// ================= SETTINGS PAGE JS =================
// JavaScript used for vendor account settings functionality
// Code originally from settings.js

/**
 * Vendor Settings Handler
 * Manages all vendor settings forms and API integration
 */

document.addEventListener('DOMContentLoaded', () => {
    // Tab switching logic
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.getAttribute('data-tab');

            // Remove active class from all tabs and contents
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            // Add active class to clicked tab and corresponding content
            btn.classList.add('active');
            document.getElementById(`${tabName}-tab`).classList.add('active');
        });
    });

    // Load profile & vendor settings on page load
    loadProfileData();
    loadVendorSettings();

    // Account Settings Save Handler
    const accountSaveBtn = document.querySelector('#account-tab .save-btn');
    if (accountSaveBtn) {
        accountSaveBtn.addEventListener('click', saveAccountSettings);
    }

    // Business Settings Save Handler
    const businessSaveBtn = document.querySelector('#business-tab .save-btn');
    if (businessSaveBtn) {
        businessSaveBtn.addEventListener('click', saveBusinessSettings);
    }

    const payoutSaveBtn = document.querySelector('#payouts-tab .save-btn');
    if (payoutSaveBtn) {
        payoutSaveBtn.addEventListener('click', savePayoutSettings);
    }

    // GST Invoice Download Logic
    const downloadGstBtn = document.getElementById('download-gst-btn');
    if (downloadGstBtn) {
        downloadGstBtn.addEventListener('click', () => {
            window.location.href = "/api/vendor/download-gst-invoices";
        });
    }

    // Bank identification and validation listeners
    const ifscInput = document.getElementById('p-ifsc');
    if (ifscInput) {
        ifscInput.addEventListener('input', (e) => {
            const val = e.target.value.toUpperCase();
            e.target.value = val;
            handleIfscChange(val);
        });
    }

    const accInput = document.getElementById('p-account');
    const confirmAccInput = document.getElementById('p-confirm-account');
    if (accInput && confirmAccInput) {
        const validateMatch = () => {
            const hint = document.getElementById('accountMatchHint');
            if (accInput.value && confirmAccInput.value) {
                if (accInput.value === confirmAccInput.value) {
                    confirmAccInput.style.borderColor = '#10b981';
                } else {
                    confirmAccInput.style.borderColor = '#ef4444';
                }
            }
        };
        accInput.addEventListener('input', validateMatch);
        confirmAccInput.addEventListener('input', validateMatch);
    }

    // Store Settings Save Handler
    const storeSaveBtn = document.querySelector('#store-tab .save-btn');
    if (storeSaveBtn) {
        storeSaveBtn.addEventListener('click', saveStoreSettings);
    }

    // Logo Upload Handler
    const uploadLogoBtn = document.getElementById('upload-logo-btn');
    const logoInput = document.getElementById('store-logo-input');

    if (uploadLogoBtn && logoInput) {
        uploadLogoBtn.addEventListener('click', () => logoInput.click());
        logoInput.addEventListener('change', handleLogoUpload);
    }

    // ── Profile Photo Upload in Account Tab ─────────────────────────────────
    const changePhotoBtn = document.querySelector('.change-photo-btn');
    const profileUploadInput = document.getElementById('profile-upload');
    const settingsProfileImg = document.querySelector('.settings-profile-img');

    if (changePhotoBtn && profileUploadInput) {
        changePhotoBtn.addEventListener('click', () => profileUploadInput.click());
    }

    if (profileUploadInput) {
        profileUploadInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // 1. Instant local preview
            const reader = new FileReader();
            reader.onload = (ev) => {
                if (settingsProfileImg) settingsProfileImg.src = ev.target.result;
                document.querySelectorAll('.user-avatar img').forEach(img => img.src = ev.target.result);
            };
            reader.readAsDataURL(file);

            // 2. Upload to backend
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
                if (settingsProfileImg) settingsProfileImg.src = url;
                document.querySelectorAll('.user-avatar img').forEach(img => img.src = url);
            } catch (err) {
                console.error('[Settings] Photo upload failed:', err);
                alert('Photo upload failed: ' + err.message);
            }
        });
    }
});

/* ── Load vendor profile into account tab ──────────────────────────────────── */
async function loadProfileData() {
    try {
        const response = await fetch('/api/profile', {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            return;
        }

        const data = await response.json();
        const user = data.vendor || data.customer || data;

        // Populate account tab fields
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };

        set('u-name', user.fullname || user.name || '');
        set('u-email', user.email || '');
        set('u-phone', user.phone || user.phone_number || '');
        set('u-address', user.address || '');
        set('u-city', user.city || '');
        set('u-state', user.state || '');
        set('u-dob', user.date_of_birth || user.dob || '');
        set('acc-username', user.username || '');

        const genderEl = document.getElementById('u-gender');
        if (genderEl && user.gender) genderEl.value = user.gender;

        // Load profile picture
        const pic = user.profile_picture || user.photo_url || '';
        if (pic) {
            const settingsProfileImg = document.querySelector('.settings-profile-img');
            if (settingsProfileImg) settingsProfileImg.src = pic + '?t=' + Date.now();
            document.querySelectorAll('.user-avatar img').forEach(img => img.src = pic + '?t=' + Date.now());
        }
    } catch (error) {
        console.error('[Settings] Error loading profile:', error);
    }
}

async function loadVendorSettings() {
    try {
        const response = await fetch('/api/vendor/settings', {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            return;
        }

        const data = await response.json();
        const settings = data.settings;

        // Populate business settings
        if (settings.business_name) document.getElementById('b-name').value = settings.business_name;
        if (settings.business_address) document.getElementById('b-address').value = settings.business_address;
        if (settings.gst_number) document.getElementById('b-tax').value = settings.gst_number;

        // Store description textarea (using class selector since no ID)
        const descTextarea = document.querySelector('#business-tab .form-textarea');
        if (descTextarea && settings.store_description) descTextarea.value = settings.store_description;

        // Store category (using class + data selector)
        const categorySelect = document.querySelector('#business-tab .form-input');
        if (categorySelect && settings.store_category) categorySelect.value = settings.store_category;

        // Company website
        const websiteInput = document.querySelector('#business-tab input[type="url"]');
        if (websiteInput && settings.company_website) websiteInput.value = settings.company_website;

        // Store status
        const statusSelect = document.querySelector('.store-status-select');
        if (statusSelect && settings.store_status) statusSelect.value = settings.store_status;

        // Populate payout settings
        if (settings.account_holder_name) document.getElementById('p-holder').value = settings.account_holder_name;
        if (settings.bank_name) document.getElementById('p-bank').value = settings.bank_name;
        if (settings.account_number) {
            document.getElementById('p-account').value = settings.account_number;
            document.getElementById('p-confirm-account').value = settings.account_number;
        }
        if (settings.ifsc_code) {
            document.getElementById('p-ifsc').value = settings.ifsc_code;
            handleIfscChange(settings.ifsc_code);
        }
        if (settings.upi_id) document.getElementById('p-upi').value = settings.upi_id;

        // Populate store policies
        const storeTextareas = document.querySelectorAll('#store-tab .form-textarea');
        if (storeTextareas.length >= 2) {
            if (settings.return_policy) storeTextareas[0].value = settings.return_policy;
            if (settings.shipping_policy) storeTextareas[1].value = settings.shipping_policy;
        }

        // Populate Theme Settings
        if (settings.theme) {
            const theme = settings.theme;
            if (theme.theme_mode) {
                const autoRadio = document.getElementById('theme-mode-auto');
                const defaultRadio = document.getElementById('theme-mode-default');
                if (theme.theme_mode === 'auto' && autoRadio) autoRadio.checked = true;
                else if (defaultRadio) defaultRadio.checked = true;
            }

            if (theme.primary_color) {
                updateThemePreview(theme.primary_color, theme.secondary_color, theme.accent_color);
            }
        }

        loadBankStatus();
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

async function saveAccountSettings() {
    try {
        const fullname = document.getElementById('u-name').value.trim();
        const email = document.getElementById('u-email').value.trim();
        const dateOfBirth = document.getElementById('u-dob').value;
        const gender = document.getElementById('u-gender').value;
        const phone = document.getElementById('u-phone').value.trim();
        const address = document.getElementById('u-address').value.trim();
        const city = document.getElementById('u-city').value.trim();
        const state = document.getElementById('u-state').value.trim();
        const username = document.getElementById('acc-username').value.trim();

        // Validation
        if (!fullname || !email) {
            alert('Please fill in all required fields: Name and Email');
            return;
        }

        if (!validateEmail(email)) {
            alert('Please enter a valid email address');
            return;
        }

        if (phone && !validatePhone(phone)) {
            alert('Please enter a valid phone number');
            return;
        }

        // FIX: send 'name' (backend expects this key) — also send 'fullname' for compatibility
        const response = await fetch('/api/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                name: fullname,
                fullname: fullname,
                email,
                date_of_birth: dateOfBirth || null,
                dob: dateOfBirth || null,
                gender: gender || null,
                phone: phone || null,
                address: address || null,
                city: city || null,
                state: state || null,
                username: username || null
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Failed to save account settings');
        }

        // Update visible name in any header/topbar
        document.querySelectorAll('[id="avatarName"], .vendor-name-display, .user-name').forEach(el => {
            el.textContent = fullname;
        });

        alert('Account settings saved successfully!');
    } catch (error) {
        console.error('Error saving account settings:', error);
        alert('Failed to save account settings: ' + error.message);
    }
}

async function saveBusinessSettings() {
    try {
        const businessName = document.getElementById('b-name').value.trim();
        const businessAddress = document.getElementById('b-address').value.trim();
        const gstNumber = document.getElementById('b-tax').value.trim();

        // Get store description (no ID, using querySelector)
        const storeDescription = document.querySelector('#business-tab .form-textarea').value.trim();

        // Get store category (no ID, first select in business tab)
        const storeCategory = document.querySelector('#business-tab .form-input').value;

        // Get company website (no ID, type="url")
        const companyWebsite = document.querySelector('#business-tab input[type="url"]').value.trim();

        // Get store status
        const storeStatus = document.querySelector('.store-status-select').value;

        const response = await fetch('/api/vendor/settings', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                business_name: businessName,
                business_address: businessAddress,
                gst_number: gstNumber,
                store_description: storeDescription,
                store_category: storeCategory,
                company_website: companyWebsite,
                store_status: storeStatus
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Failed to save business settings');
        }

        alert('Business settings saved successfully!');
    } catch (error) {
        console.error('Error saving business settings:', error);
        alert('Failed to save business settings: ' + error.message);
    }
}

async function savePayoutSettings() {
    try {
        const accountHolderName = document.getElementById('p-holder').value.trim();
        const bankName = document.getElementById('p-bank').value.trim();
        const accountNumber = document.getElementById('p-account').value.trim();
        const confirmAccountNumber = document.getElementById('p-confirm-account').value.trim();
        const ifscCode = document.getElementById('p-ifsc').value.trim();
        const upiId = document.getElementById('p-upi').value.trim();

        // Validation
        if (!accountHolderName || !bankName || !accountNumber || !ifscCode) {
            alert('Please fill in all required fields: Account Holder, Bank Name, Account Number, and IFSC Code');
            return;
        }

        if (accountNumber !== confirmAccountNumber) {
            alert('Account numbers do not match!');
            return;
        }

        if (!validateIFSC(ifscCode)) {
            alert('Please enter a valid IFSC code (e.g., SBIN0001234)');
            return;
        }

        const detectedBank = identifyBank(ifscCode);
        if (detectedBank === "Unsupported Bank") {
            alert('Invalid or Unsupported Bank IFSC code.');
            return;
        }

        if (!validateAccountNumber(accountNumber)) {
            alert('Please enter a valid account number (9-18 digits)');
            return;
        }

        const response = await fetch('/api/vendor/settings', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                account_holder_name: accountHolderName,
                bank_name: bankName,
                account_number: accountNumber,
                ifsc_code: ifscCode,
                upi_id: upiId
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Failed to save payout settings');
        }

        alert('Payout settings saved successfully!');
    } catch (error) {
        console.error('Error saving payout settings:', error);
        alert('Failed to save payout settings: ' + error.message);
    }
}

async function saveStoreSettings() {
    try {
        // Get textareas in store tab (no IDs, using index-based selection)
        const textareas = document.querySelectorAll('#store-tab .form-textarea');

        if (textareas.length < 2) {
            alert('Store form is incomplete');
            return;
        }

        const returnPolicy = textareas[0].value.trim();
        const shippingPolicy = textareas[1].value.trim();

        const response = await fetch('/api/vendor/settings', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                return_policy: returnPolicy,
                shipping_policy: shippingPolicy,
                theme_mode: document.querySelector('input[name="theme_mode"]:checked')?.value || 'default'
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Failed to save store settings');
        }

        alert('Store settings saved successfully!');
    } catch (error) {
        console.error('Error saving store settings:', error);
        alert('Failed to save store settings: ' + error.message);
    }
}

// Logo Upload Handler
async function handleLogoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'];
    if (!validTypes.includes(file.type)) {
        alert('Please upload a valid image file (PNG, JPG, or GIF)');
        event.target.value = '';
        return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
        alert('File size must be less than 5MB');
        event.target.value = '';
        return;
    }

    try {
        // Show preview
        const reader = new FileReader();
        reader.onload = (e) => {
            const logoImage = document.getElementById('logo-image');
            const logoIcon = document.getElementById('logo-icon');
            if (logoImage && logoIcon) {
                logoImage.src = e.target.result;
                logoImage.style.display = 'block';
                logoIcon.style.display = 'none';
            }
        };
        reader.readAsDataURL(file);

        // Upload file
        const formData = new FormData();
        formData.append('logo', file);

        const response = await fetch('/api/vendor/upload-logo', {
            method: 'POST',
            credentials: 'include',
            body: formData
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Failed to upload logo');
        }

        // Update theme colors if auto-generated
        if (result.theme) {
            const theme = result.theme;
            updateThemePreview(theme.primary, theme.secondary, theme.accent);
        }

        alert('Logo uploaded successfully!');
    } catch (error) {
        console.error('Error uploading logo:', error);
        alert('Failed to upload logo: ' + error.message);
        event.target.value = '';
    }
}

// Validation Helper Functions
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function validatePhone(phone) {
    if (!phone) return true; // Optional field
    const re = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;
    return re.test(phone);
}

function validateIFSC(ifsc) {
    if (!ifsc) return true;
    const re = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    return re.test(ifsc);
}

function validateAccountNumber(accNum) {
    if (!accNum) return true;
    const re = /^[0-9]{9,18}$/;
    return re.test(accNum);
}

async function handleIfscChange(ifsc) {
    const bankInput = document.getElementById('p-bank');
    const hint = document.getElementById('bankDetectedHint');
    const validationHint = document.getElementById('ifscValidationHint');
    const loading = document.getElementById('payoutIfscLoading');

    if (!ifsc) {
        bankInput.value = "";
        hint.textContent = "Detecting bank...";
        hint.style.color = "";
        if (validationHint) validationHint.textContent = "11 characters: 4 letters + 0 + 6 alphanumeric";
        return;
    }

    // Validate format
    const pattern = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (pattern.test(ifsc)) {
        if (validationHint) {
            validationHint.textContent = "✓ Valid format";
            validationHint.style.color = "#10b981";
        }

        // Fetch bank info
        try {
            if (loading) loading.style.display = 'block';
            const res = await fetch(`/api/vendor/bank/ifsc/${ifsc}`);
            if (res.ok) {
                const data = await res.json();
                bankInput.value = data.bank;
                hint.textContent = `✓ ${data.bank} (${data.branch})`;
                hint.style.color = "#10b981";
            } else {
                bankInput.value = "";
                hint.textContent = "✗ Bank not found for this IFSC";
                hint.style.color = "#ef4444";
            }
        } catch (err) {
            console.error('IFSC Lookup Error:', err);
        } finally {
            if (loading) loading.style.display = 'none';
        }
    } else {
        if (validationHint) {
            validationHint.textContent = "✗ Invalid format (e.g. KARB0000001)";
            validationHint.style.color = "#ef4444";
        }
        bankInput.value = "";
        hint.textContent = "Invalid IFSC format";
        hint.style.color = "#ef4444";
    }
}

async function loadBankStatus() {
    try {
        const res = await fetch('/api/vendor/bank/status', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();

        const statusBadge = document.getElementById('payoutBankStatus');
        if (statusBadge && data.verification_status) {
            const status = data.verification_status;
            statusBadge.textContent = status.charAt(0).toUpperCase() + status.slice(1);
            statusBadge.style.display = 'inline-block';

            // Re-apply values from precise bank table if submitted
            if (status !== 'not_submitted') {
                const sets = {
                    'p-holder': data.account_holder_name,
                    'p-bank': data.bank_name,
                    'p-account': data.account_number,
                    'p-confirm-account': data.account_number,
                    'p-ifsc': data.ifsc_code
                };
                for (let id in sets) {
                    const el = document.getElementById(id);
                    if (el) el.value = sets[id] || '';
                }
                const hint = document.getElementById('bankDetectedHint');
                if (hint) {
                    hint.textContent = `✓ ${data.bank_name}`;
                    hint.style.color = "#10b981";
                }
            }

            if (status === 'approved') {
                statusBadge.style.backgroundColor = '#10b981';
                statusBadge.style.color = 'white';
                // Disable editing if approved
                const fields = ['p-holder', 'p-account', 'p-confirm-account', 'p-ifsc', 'p-upi'];
                fields.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) {
                        el.readOnly = true;
                        el.style.backgroundColor = 'var(--bg-secondary)';
                        el.style.cursor = 'not-allowed';
                    }
                });
                const saveBtn = document.querySelector('#payouts-tab .save-btn');
                if (saveBtn) {
                    saveBtn.disabled = true;
                    saveBtn.textContent = 'Bank Details Approved (Read-only)';
                    saveBtn.style.opacity = '0.7';
                }
            } else if (status === 'pending') {
                statusBadge.style.backgroundColor = '#f59e0b';
                statusBadge.style.color = 'white';
            } else if (status === 'rejected') {
                statusBadge.style.backgroundColor = '#ef4444';
                statusBadge.style.color = 'white';
            }
        }
    } catch (err) {
        console.error('Failed to load bank status:', err);
    }
}

function updateThemePreview(primary, secondary, accent) {
    const previewSection = document.getElementById('theme-preview-section');
    const pBox = document.getElementById('p-color-p');
    const sBox = document.getElementById('s-color-p');
    const aBox = document.getElementById('a-color-p');

    if (previewSection) previewSection.style.display = 'block';
    if (pBox) pBox.style.background = primary;
    if (sBox) sBox.style.background = secondary;
    if (aBox) aBox.style.background = accent;
}


// ================= REVIEWS PAGE JS =================
// JavaScript used for displaying and managing vendor reviews
// Code originally from reviews.js

/* ======================================================================
   reviews.js  –  Vendor Dashboard: Customer Reviews
   Fixes applied:
     1. credentials: 'include' added to GET fetch (session cookie was never sent)
     2. Paginator class is now self-contained (was not defined anywhere)
   ====================================================================== */

document.addEventListener('DOMContentLoaded', function () {
    loadVendorReviews();
});

/* ── Self-contained ReviewsPaginator ──────────────────────────────────────────── */
class ReviewsPaginator {
    constructor(items, perPage, renderFn, paginationSelector) {
        this.items = items;
        this.perPage = perPage;
        this.renderFn = renderFn;
        this.paginationSelector = paginationSelector;
        this.currentPage = 1;
        this.totalPages = Math.ceil(items.length / perPage);
    }

    init() {
        this._render();
    }

    _pageItems() {
        const start = (this.currentPage - 1) * this.perPage;
        return this.items.slice(start, start + this.perPage);
    }

    _render() {
        this.renderFn(this._pageItems());
        this._renderPagination();
    }

    _renderPagination() {
        const container = document.querySelector(this.paginationSelector);
        if (!container) return;

        if (this.totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        let html = '<div class="pagination-controls" style="display:flex;justify-content:center;gap:8px;margin-top:20px;flex-wrap:wrap;">';

        // Prev button
        html += `<button onclick="window.__reviewsPaginator.goTo(${this.currentPage - 1})"
            style="padding:8px 16px;border-radius:8px;border:1px solid var(--border-color,#ddd);cursor:pointer;background:${this.currentPage === 1 ? '#f5f5f5' : 'var(--card-bg,#fff)'};opacity:${this.currentPage === 1 ? '0.5' : '1'};"
            ${this.currentPage === 1 ? 'disabled' : ''}>‹ Prev</button>`;

        // Page buttons
        for (let p = 1; p <= this.totalPages; p++) {
            html += `<button onclick="window.__reviewsPaginator.goTo(${p})"
                style="padding:8px 14px;border-radius:8px;border:1px solid var(--border-color,#ddd);cursor:pointer;
                background:${p === this.currentPage ? 'var(--primary-color,#6366f1)' : 'var(--card-bg,#fff)'};
                color:${p === this.currentPage ? '#fff' : 'inherit'};">${p}</button>`;
        }

        // Next button
        html += `<button onclick="window.__reviewsPaginator.goTo(${this.currentPage + 1})"
            style="padding:8px 16px;border-radius:8px;border:1px solid var(--border-color,#ddd);cursor:pointer;background:${this.currentPage === this.totalPages ? '#f5f5f5' : 'var(--card-bg,#fff)'};opacity:${this.currentPage === this.totalPages ? '0.5' : '1'};"
            ${this.currentPage === this.totalPages ? 'disabled' : ''}>Next ›</button>`;

        html += '</div>';
        container.innerHTML = html;
    }

    goTo(page) {
        if (page < 1 || page > this.totalPages) return;
        this.currentPage = page;
        this._render();
        // Scroll to top of reviews grid
        const grid = document.getElementById('reviewsGridContainer');
        if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

/* ── Main fetch function ───────────────────────────────────────────────── */
async function loadVendorReviews() {
    const grid = document.getElementById('reviewsGridContainer');

    try {
        // FIX 1: credentials:'include' is REQUIRED so the session cookie is sent
        // Without this the @require_active_vendor guard returns 401 every time.
        const response = await fetch('/api/vendor/reviews', {
            method: 'GET',
            credentials: 'include',          // ← was missing: session never sent
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            const msg = errData.error || `HTTP ${response.status}`;
            throw new Error(msg);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        updateStatsCard(data);

        // FIX 2: ReviewsPaginator is now self-contained above — no external dependency
        if (data.reviews && data.reviews.length > 0) {
            const paginator = new ReviewsPaginator(
                data.reviews,
                6,
                renderReviews,
                '#reviewsPaginationContainer'
            );
            window.__reviewsPaginator = paginator; // expose for onclick handlers
            paginator.init();
        } else {
            renderReviews([]);
        }

    } catch (error) {
        console.error('Error loading reviews:', error);
        if (grid) {
            grid.innerHTML = `
                <div class="loading-reviews" style="color:#ef4444;grid-column:1/-1;">
                    <i class="fas fa-exclamation-circle" style="color:#ef4444;"></i>
                    <p>Failed to load reviews. Please try again.</p>
                    <p style="font-size:12px;opacity:0.7;">${error.message}</p>
                </div>
            `;
        }
    }
}

/* ── Stats card update ─────────────────────────────────────────────────── */
function updateStatsCard(data) {
    const avgRating = data.average_rating || 0;
    const totalCount = data.count || 0;

    document.getElementById('avgRatingBig').textContent = avgRating.toFixed(1);
    document.getElementById('totalReviewsText').textContent =
        `Based on ${totalCount} total review${totalCount !== 1 ? 's' : ''}`;

    // Render big stars
    const starsContainer = document.getElementById('avgStarsBig');
    let starsHtml = '';
    const fullStars = Math.floor(avgRating);
    const hasHalfStar = avgRating % 1 >= 0.5;
    for (let i = 0; i < 5; i++) {
        if (i < fullStars) {
            starsHtml += '<i class="fas fa-star"></i>';
        } else if (i === fullStars && hasHalfStar) {
            starsHtml += '<i class="fas fa-star-half-alt"></i>';
        } else {
            starsHtml += '<i class="far fa-star"></i>';
        }
    }
    starsContainer.innerHTML = starsHtml;

    // Rating distribution bar chart
    const distributions = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    if (data.reviews && data.reviews.length > 0) {
        data.reviews.forEach(r => {
            const rating = Math.round(r.rating);
            if (distributions[rating] !== undefined) distributions[rating]++;
        });
    }
    renderBarChart(distributions, totalCount);
}

/* ── Bar chart ─────────────────────────────────────────────────────────── */
function renderBarChart(distributions, totalCount) {
    const chartContainer = document.getElementById('ratingBarChart');
    let html = '';
    for (let i = 5; i >= 1; i--) {
        const count = distributions[i];
        const percentage = totalCount > 0 ? (count / totalCount) * 100 : 0;
        html += `
            <div class="rating-bar-row">
                <span class="rating-bar-label">${i} Stars</span>
                <div class="rating-bar-track-3d">
                    <div class="rating-bar-fill-3d" style="width:${percentage}%"></div>
                </div>
                <span class="rating-bar-count">${count}</span>
            </div>
        `;
    }
    chartContainer.innerHTML = html;
}

/* ── Review card renderer ──────────────────────────────────────────────── */
function renderReviews(reviews) {
    const grid = document.getElementById('reviewsGridContainer');

    if (!reviews || reviews.length === 0) {
        grid.innerHTML = `
            <div class="loading-reviews" style="grid-column:1/-1;">
                <i class="fas fa-comment-slash" style="opacity:0.5;"></i>
                <p>You don't have any reviews yet.</p>
            </div>
        `;
        return;
    }

    let html = '';
    reviews.forEach((review, index) => {
        // Stars
        let starsHtml = '';
        const rating = Math.round(review.rating);
        for (let i = 1; i <= 5; i++) {
            starsHtml += i <= rating
                ? '<i class="fas fa-star"></i>'
                : '<i class="far fa-star"></i>';
        }

        // Date
        const dateStr = review.created_at
            ? new Date(review.created_at).toLocaleDateString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric'
            })
            : 'Recent';

        // Avatar initials
        const initials = review.name
            ? review.name.substring(0, 2).toUpperCase()
            : 'AN';

        const staggerDelay = index * 0.1;

        html += `
            <div class="review-card-3d" style="animation-delay:${staggerDelay}s">
                <div class="review-card-header">
                    <div class="reviewer-info-3d">
                        <div class="reviewer-avatar-3d">${initials}</div>
                        <div class="reviewer-details">
                            <h4>${escapeHtml(review.name || 'Anonymous')}</h4>
                            <p>${escapeHtml(review.category || 'General')}</p>
                        </div>
                    </div>
                    <span class="review-date-badge">${dateStr}</span>
                </div>
                <div class="review-product-badge">
                    <i class="fas fa-box" style="margin-right:4px;"></i>
                    ${escapeHtml(review.product_name || 'General Product')}
                </div>
                <div class="review-stars-3d">${starsHtml}</div>
                <p class="review-comment-3d">"${escapeHtml(review.message)}"</p>
                ${review.recommend === 'yes'
                ? '<div style="margin-top:8px;font-size:12px;color:#22c55e;"><i class="fas fa-thumbs-up"></i> Recommends this product</div>'
                : '<div style="margin-top:8px;font-size:12px;color:#ef4444;"><i class="fas fa-thumbs-down"></i> Does not recommend</div>'
            }
            </div>
        `;
    });

    grid.innerHTML = html;
}

/* ── XSS helper ────────────────────────────────────────────────────────── */
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
