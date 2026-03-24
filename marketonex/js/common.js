const API_BASE_URL = window.location.protocol === 'file:' ? 'http://127.0.0.1:5000' : '';
window.API_BASE_URL = API_BASE_URL;
const API_URL = API_BASE_URL;

class ApiService {
    static async request(endpoint, method = 'GET', data = null) {
        const options = {
            method,
            headers: {},
            credentials: 'include'
        };

        // Only set Content-Type header if we're sending data
        if (data) {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(data);
        }

        try {
            // Ensure endpoint starts with /
            const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
            const response = await fetch(`${API_URL}/api${path}`, options);

            // Read JSON only if content-type is application/json
            let result;
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                result = await response.json();
            } else {
                const textResponse = await response.text();
                console.error(`Expected JSON but got non-JSON from ${endpoint}:`, textResponse.substring(0, 200));
                throw new Error(`Invalid JSON response. API returned HTML or unexpected format.`);
            }

            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.removeItem('vendorLoggedIn');
                    localStorage.removeItem('vendorEmail');
                }
                throw new Error(result.error || result.message || 'Something went wrong');
            }
            return result;
        } catch (error) {
            console.error(`API Error [${method} ${endpoint}]:`, error);
            throw error;
        }
    }

    static async get(endpoint) { return this.request(endpoint, 'GET'); }
    static async post(endpoint, data) { return this.request(endpoint, 'POST', data); }
    static async put(endpoint, data) { return this.request(endpoint, 'PUT', data, 'PUT'); }
    static async delete(endpoint) { return this.request(endpoint, 'DELETE'); }

    static async upload(endpoint, file) {
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch(`${API_URL}/api${endpoint}`, {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });
        const result = await response.json();
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

// Auth check on load
async function checkAuth() {
    try {
        const path = window.location.pathname;
        const res = await ApiService.request('/auth/status');

        if (res.isAuthenticated) {
            currentUser = res.user || res.vendor;
            localStorage.setItem('vendorLoggedIn', 'true');
            if (currentUser && currentUser.email) {
                localStorage.setItem('vendorEmail', currentUser.email);
            }
            updateUIWithUser(currentUser);
        } else {
            // Backend says not authenticated - clear local flags
            localStorage.removeItem('vendorLoggedIn');
            localStorage.removeItem('vendorEmail');

            // Skip redirect for public pages (login/signup/index/landing)
            const isPublicPage = path.includes('login.html') ||
                path.includes('signup.html') ||
                path.includes('landingpage.html') ||
                path.endsWith('/') ||
                path.endsWith('index.html');

            if (isPublicPage) return;

            // Protected Routes
            const protectedPages = [
                'marketonex.html',
                'checkout.html',
                'account-settings.html',
                'my-orders.html',
                'my-stuff.html',
                'payments.html',
                'track-order.html',
                'add_product_marketonex.html'
            ];
            const isProtected = protectedPages.some(page => path.endsWith(page));

            if (isProtected) {
                console.warn('[Auth Check] Redirecting to login.html');
                window.location.href = 'login.html';
            }
        }
    } catch (e) {
        console.error('Auth check failed:', e);
    }
}

function updateUIWithUser(user) {
    if (!user) return;
    // 1. Common Elements (Sidebar/TopBar avatars if any)
    const avatars = document.querySelectorAll('.user-avatar img, .profile-img');
    const timestamp = new Date().getTime();
    const hasImage = user.profile_picture && !user.profile_picture.includes('default') && user.profile_picture !== '';

    avatars.forEach(img => {
        if (hasImage) {
            img.src = user.profile_picture.startsWith('http')
                ? user.profile_picture
                : `${user.profile_picture}?t=${timestamp}`;
        }
    });

    // 2. Marketonex Header Profile Elements
    const profileAvatar = document.getElementById('profile-avatar');
    const profileInitials = document.getElementById('profile-initials');
    const dropdownAvatar = document.getElementById('dropdown-avatar');
    const profileName = document.getElementById('profile-name');

    // Initials Generation
    const initials = getInitials(user.full_name || user.name || user.email);

    // Update Header Avatar/Initials
    if (profileAvatar && profileInitials) {
        if (hasImage) {
            const src = user.profile_picture.startsWith('http')
                ? user.profile_picture
                : `${user.profile_picture}?t=${timestamp}`;
            profileAvatar.src = src;
            profileAvatar.classList.remove('hidden');
            profileAvatar.style.display = 'block';

            profileInitials.classList.add('hidden');
            profileInitials.style.display = 'none';
        } else {
            profileAvatar.classList.add('hidden');
            profileAvatar.style.display = 'none';

            profileInitials.textContent = initials;
            profileInitials.classList.remove('hidden');
            profileInitials.style.display = 'flex';
        }
    }

    // Update Dropdown Avatar
    if (dropdownAvatar) {
        if (hasImage) {
            const src = user.profile_picture.startsWith('http')
                ? user.profile_picture
                : `${user.profile_picture}?t=${timestamp}`;
            dropdownAvatar.src = src;
            dropdownAvatar.style.display = 'block';
        } else {
            // Option: Show default avatar or reuse initials logic if dropdown supports it
            // For now, hiding image if no custom picture
            dropdownAvatar.style.display = 'none';
        }
    }

    // Update Profile Name
    if (profileName) {
        profileName.textContent = user.full_name || user.name || user.email;
    }

    // 3. Update Profile Page Fields (if on settings page)
    if (document.getElementById('u-name')) {
        document.getElementById('u-name').value = user.full_name || '';
        document.getElementById('u-email').value = user.email || '';
        document.getElementById('u-phone').value = user.phone || '';
        document.getElementById('u-address').value = user.address || '';
        document.getElementById('u-city').value = user.city || '';
        document.getElementById('u-state').value = user.state || '';
        if (user.dob) document.getElementById('u-dob').value = user.dob;
        if (user.gender) document.getElementById('u-gender').value = user.gender;
    }

    // 4. Update Dashboard/Profile Sidebar
    const sideProfileName = document.querySelector('.profile-info h2');
    const sideProfileEmail = document.querySelector('.profile-info p');
    if (sideProfileName) sideProfileName.textContent = user.full_name || user.name;
    if (sideProfileEmail) sideProfileEmail.textContent = user.email;
}

function getInitials(name) {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

// Initialize Auth
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();

    // --- Cart Synchronization Logic ---
    function updateCartBadge() {
        const cartBadge = document.getElementById('cart-badge');
        if (!cartBadge) return;

        try {
            const cart = JSON.parse(localStorage.getItem('marketonex_cart') || '[]');
            const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
            cartBadge.textContent = totalItems;

            // Optional: add animation class
            cartBadge.classList.add('updating');
            setTimeout(() => cartBadge.classList.remove('updating'), 400);
        } catch (e) {
            console.error('Failed to update cart badge:', e);
            cartBadge.textContent = '0';
        }
    }

    // Export to window so it can be called from other scripts
    window.updateCartBadge = updateCartBadge;

    // Initial update
    updateCartBadge();

    // Listen for changes in other tabs/windows
    window.addEventListener('storage', (e) => {
        if (e.key === 'marketonex_cart') {
            updateCartBadge();
        }
    });

    // Orders will be fetched from backend API - no seed data needed


    // Fetch and Render Orders Table (Updated to use Backend API)
    async function renderOrdersTable(ordersToRender = null) {
        const tbody = document.getElementById('ordersTableBody');
        if (!tbody) return;

        let orders = ordersToRender;

        // If no orders provided, fetch from backend
        if (!orders) {
            try {
                console.log('Fetching orders from /api/vendor/orders...');
                const response = await ApiService.get('/vendor/orders');
                console.log('Orders API response:', response);
                const backendOrders = response.orders || [];
                console.log(`Received ${backendOrders.length} orders from backend`);

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
                        id: order.order_id,
                        customer: order.fullname,
                        payment: paymentStatus,
                        fulfillment: fulfillmentStatus,
                        date: formattedDate,
                        rawDate: order.created_at,
                        total: parseFloat(order.total).toFixed(2),
                        items: itemCount
                    };
                });
                console.log('Transformed orders:', orders);
            } catch (error) {
                console.error('Failed to fetch orders:', error);
                console.error('Error message:', error.message);
                // Check for authentication error
                if (error.message && (error.message.includes('401') || error.message.includes('Not authenticated'))) {
                    console.error('AUTHENTICATION ERROR: Please log in first');
                    alert('Please log in to view orders');
                    // Redirect handled by checkAuth for protected pages
                    return;
                    return;
                }
                orders = [];
            }
        }

        tbody.innerHTML = '';

        if (orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 20px;">No orders found matching your criteria.</td></tr>';
            updateStats(orders);
            return;
        }

        orders.forEach(order => {
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
        // Fetch orders from backend first
        const response = await ApiService.get('/vendor/orders');
        const backendOrders = response.orders || [];

        // Transform to frontend format
        const allOrders = backendOrders.map(order => {
            const itemCount = order.items ? order.items.reduce((sum, item) => sum + item.quantity, 0) : 0;
            const orderDate = new Date(order.created_at);
            const formattedDate = orderDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            let paymentStatus = order.status === 'confirmed' || order.status === 'shipped' || order.status === 'delivered' ? 'Success' : 'Pending';
            let fulfillmentStatus = order.status === 'delivered' ? 'Fulfilled' : 'Unfulfilled';

            return {
                id: order.order_id,
                customer: order.fullname,
                payment: paymentStatus,
                fulfillment: fulfillmentStatus,
                date: formattedDate,
                rawDate: order.created_at,
                total: parseFloat(order.total).toFixed(2),
                items: itemCount
            };
        });

        let filtered = allOrders;

        if (criteria === 'unfulfilled') {
            filtered = allOrders.filter(o => o.fulfillment === 'Unfulfilled');
        } else if (criteria === 'unpaid') {
            filtered = allOrders.filter(o => o.payment === 'Pending');
        } else if (criteria === 'open') {
            filtered = allOrders.filter(o => o.fulfillment === 'Unfulfilled');
        } else if (criteria === 'closed') {
            filtered = allOrders.filter(o => o.fulfillment === 'Fulfilled');
        }

        renderOrdersTable(filtered);
    }

    // 2. Search Functionality
    const searchInput = document.getElementById('ordersSearch');
    if (searchInput) {
        searchInput.addEventListener('input', async (e) => {
            const term = e.target.value.toLowerCase();

            // Fetch orders from backend
            const response = await ApiService.get('/vendor/orders');
            const backendOrders = response.orders || [];

            // Transform and filter
            const allOrders = backendOrders.map(order => {
                const itemCount = order.items ? order.items.reduce((sum, item) => sum + item.quantity, 0) : 0;
                const orderDate = new Date(order.created_at);
                const formattedDate = orderDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                let paymentStatus = order.status === 'confirmed' || order.status === 'shipped' || order.status === 'delivered' ? 'Success' : 'Pending';
                let fulfillmentStatus = order.status === 'delivered' ? 'Fulfilled' : 'Unfulfilled';

                return {
                    id: order.order_id,
                    customer: order.fullname,
                    payment: paymentStatus,
                    fulfillment: fulfillmentStatus,
                    date: formattedDate,
                    rawDate: order.created_at,
                    total: parseFloat(order.total).toFixed(2),
                    items: itemCount
                };
            });

            const filtered = allOrders.filter(o =>
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
                        id: order.order_id,
                        customer: order.fullname,
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
    function calculateDashboardMetrics() {
        const orders = JSON.parse(localStorage.getItem('orders') || '[]');
        const products = JSON.parse(localStorage.getItem('products') || '[]');
        const staticProductCount = 12; // Base products

        const totalProducts = staticProductCount + products.length;
        const totalSales = 98765.43;
        const totalOrdersCount = 1450;
        const overallRating = 4.8;

        const elSales = document.getElementById('dashboardTotalSales');
        const elOrders = document.getElementById('dashboardTotalOrders');
        const elProducts = document.getElementById('dashboardTotalProducts');
        const elRating = document.getElementById('dashboardOverallRating');

        const elSalesChange = document.getElementById('dashboardSalesChange');
        const elOrdersChange = document.getElementById('dashboardOrdersChange');
        const elProductsChange = document.getElementById('dashboardProductsChange');

        if (elSales) {
            elSales.textContent = '₹' + totalSales.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            if (elSalesChange) elSalesChange.innerHTML = '+19.2% <span style="color: inherit; font-size: 0.9em; font-weight: normal;">from last month</span>';
        }
        if (elOrders) {
            elOrders.textContent = totalOrdersCount.toLocaleString();
            if (elOrdersChange) elOrdersChange.innerHTML = '+23.1% <span style="color: inherit; font-size: 0.9em; font-weight: normal;">from last month</span>';
        }
        if (elProducts) {
            elProducts.textContent = totalProducts;
            if (elProductsChange) elProductsChange.innerHTML = '+5 new <span style="color: inherit; font-size: 0.9em; font-weight: normal;">this week</span>';
        }
        if (elRating) {
            elRating.textContent = overallRating;
            const ratingChange = document.getElementById('dashboardRatingChange');
            if (ratingChange) {
                ratingChange.className = 'stat-change positive';
                ratingChange.innerHTML = '+0.2 <span style="color: inherit; font-size: 0.9em; font-weight: normal;">from last month</span>';
            }
        }
    }

    calculateDashboardMetrics();


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
    const themes = ['dark', 'light', 'brown'];
    const themeBtn = document.getElementById('themeBtn');
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const themeMenu = document.getElementById('themeMenu');
    const themeOptions = document.querySelectorAll('.theme-option');

    function setTheme(theme) {
        if (!themes.includes(theme)) theme = 'dark';
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

        // Update Toggle Button Icon
        if (themeToggleBtn) {
            const icon = themeToggleBtn.querySelector('i');
            if (icon) {
                if (theme === 'light') icon.className = 'fas fa-sun';
                else if (theme === 'brown') icon.className = 'fas fa-coffee';
                else icon.className = 'fas fa-moon';
            }
        }

        updateChartColors();

        // Dispatch event for other listeners
        window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme } }));
    }

    function updateChartColors() {
        const theme = document.documentElement.getAttribute('data-theme') || 'dark';
        if (typeof Chart !== 'undefined') {
            const chart = Chart.getChart('salesChart'); // Get the chart instance
            if (chart) {
                if (theme === 'light') {
                    chart.data.datasets[0].backgroundColor = '#3b82f6';
                } else if (theme === 'brown') {
                    chart.data.datasets[0].backgroundColor = '#a1887f';
                } else {
                    chart.data.datasets[0].backgroundColor = '#4f46e5';
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

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
            const currentIndex = themes.indexOf(currentTheme);
            const nextIndex = (currentIndex + 1) % themes.length;
            setTheme(themes[nextIndex]);
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

    // Only log and setup drawer if elements exist (not all pages have drawer UI)
    if (addProductDrawer && drawerOverlay) {
        console.log('Add Product drawer elements found, initializing...');
    }

    function openDrawer() {
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
    // Only attach handler if drawer elements exist (for pages that use drawer UI)
    if (addProductBtn && addProductDrawer && drawerOverlay) {
        addProductBtn.addEventListener('click', () => {
            // Reset Edit State
            editingProductId = null;
            editingProductCard = null;

            // Reset UI (only if elements exist)
            if (addProductForm) addProductForm.reset();

            const drawerHeader = document.querySelector('.drawer-header h2');
            const saveBtn = document.querySelector('.save-product-btn');

            if (drawerHeader) drawerHeader.textContent = 'Add New Product';
            if (saveBtn) saveBtn.textContent = 'Save Product';

            // Open Drawer
            openDrawer();
        });
    }
    // Note: If drawer doesn't exist, the page-specific JS (e.g., marketonex.js) handles the button

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
    loadProducts();


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
            currentImageArray = Array.isArray(productData.images) ? productData.images : [productData.image || productData.images];
            if (currentImageArray.length === 0) {
                console.warn('No images provided for detail view');
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
        return `
            <div class="product-card dynamic" data-id="${product.id}" data-category="${product.category || 'Uncategorized'}" data-price="${product.price.toString().replace('$', '')}" data-vendor="${product.brand || 'Your Store'}">
                <div class="product-image">
                    <img src="${product.image}" alt="${product.name}" class="p-img">
                </div>
                <div class="product-info">
                    <h3>${product.name}</h3>
                    <p class="product-desc">${product.desc}</p>
                    <div class="product-meta">
                        <span class="vendor-name">${product.brand || 'Your Store'}</span>
                        <span class="product-price">${product.price}</span>
                    </div>
                    <div class="product-footer">
                        <span class="stock-pill">${product.quantity} in stock</span>
                        <div class="card-menu-container">
                            <button class="card-menu-btn"><i class="fas fa-ellipsis-h"></i></button>
                            <div class="card-menu-dropdown">
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


    function loadProducts() {
        const grid = document.querySelector('.products-grid');
        if (!grid) return;

        let savedProducts = [];
        try {
            savedProducts = JSON.parse(localStorage.getItem('products') || '[]');
        } catch (e) {
            console.error('Error parsing products:', e);
            savedProducts = [];
        }

        savedProducts.forEach(product => {
            if (!grid.querySelector(`.product-card[data-id="${product.id}"]`)) {
                if (typeof window.createProductCardHTML === 'function') {
                    const cardHTML = window.createProductCardHTML(product);
                    grid.insertAdjacentHTML('afterbegin', cardHTML);
                }
            }
        });

        document.querySelectorAll('.product-card').forEach(attachGlobalCardListener);
    }

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
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('Delete product?')) {
                    card.remove();
                    const pData = extractProductData(card);
                    if (pData.id) {
                        const prods = JSON.parse(localStorage.getItem('products') || '[]');
                        const newP = prods.filter(p => p.id != pData.id);
                        localStorage.setItem('products', JSON.stringify(newP));
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

    // Call load globally
    loadProducts();


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

        profileUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    const result = e.target.result;
                    if (profileImg) profileImg.src = result;
                    if (topBarAvatar) topBarAvatar.src = result;
                    try {
                        localStorage.setItem('profileImage', result);
                    } catch (e) { console.warn('Profile image save failed'); }
                    alert('Profile photo updated!');
                }
                reader.readAsDataURL(file);
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

    const savedImg = localStorage.getItem('profileImage');
    if (savedImg) {
        if (profileImg) profileImg.src = savedImg;
        if (topBarAvatar) topBarAvatar.src = savedImg;
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

    // Only load settings data if we're on a settings page (check for settings elements)
    if (document.getElementById('setting-name') || document.getElementById('setting-business-name')) {
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
    // COMMENTED OUT: Handled by specific login.js and signup.js files to avoid conflicts and stale API endpoints
    /*
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = loginForm.querySelector('button[type="submit"]');
            const originalText = btn.textContent;

            const email = loginForm.querySelector('#email').value.trim();
            const password = loginForm.querySelector('#password').value.trim();

            // Client-side Validation
            if (!email || !email.includes('@')) {
                alert('Please enter a valid email address.');
                return;
            }
            if (!password) {
                alert('Please enter your password.');
                return;
            }

            btn.textContent = 'Signing in...';
            btn.disabled = true;

            try {
                const res = await ApiService.request('/login', 'POST', { email, password });
                // Set login flag for marketonex
                localStorage.setItem('vendorLoggedIn', 'true');
                localStorage.setItem('vendorEmail', email);

                // Check if user came from Add Product flow
                const urlParams = new URLSearchParams(window.location.search);
                const redirect = urlParams.get('redirect');

                if (redirect === 'addProduct') {
                    // Redirect to marketonex with openAddProduct parameter
                    window.location.href = 'marketonex.html?openAddProduct=true';
                } else {
                    // Success - redirect to marketonex
                    window.location.href = 'marketonex.html';
                }
            } catch (err) {
                alert('Login failed: ' + err.message);
                btn.textContent = originalText;
                btn.disabled = false;
            }
        });
    }

    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = signupForm.querySelector('button[type="submit"]');

            const password = signupForm.querySelector('#password').value;
            const confirmPassword = signupForm.querySelector('#confirm-password').value;

            if (password !== confirmPassword) {
                alert("Passwords do not match!");
                return;
            }

            const originalText = btn.textContent;
            btn.textContent = 'Creating account...';
            btn.disabled = true;

            const fullname = signupForm.querySelector('#fullname').value;
            const email = signupForm.querySelector('#email').value;

            try {
                const res = await ApiService.request('/register', 'POST', { fullname, email, password });
                alert('Account created! Please sign in.');
                window.location.href = 'login.html';
            } catch (err) {
                alert('Registration failed: ' + err.message);
                btn.textContent = originalText;
                btn.disabled = false;
            }
        });
    }
    */

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
                const res = await ApiService.request('/profile', 'PUT', data);
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

    // ============================================================================
    // USER PROFILE PANEL FUNCTIONALITY
    // ============================================================================

    const profileIconBtn = document.getElementById('profile-icon-btn');
    const profileDropdown = document.getElementById('profile-dropdown');
    const profileLogoutBtn = document.getElementById('profile-logout-btn');

    if (profileIconBtn && profileDropdown) {
        // Initialize profile panel
        initProfilePanel();

        // Toggle profile dropdown
        profileIconBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleProfilePanel();
        });

        // Profile Image Upload Trigger
        const profileUploadTrigger = document.getElementById('profile-upload-trigger');
        const headerProfileUpload = document.getElementById('header-profile-upload');

        if (profileUploadTrigger && headerProfileUpload) {
            profileUploadTrigger.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent dropdown toggle
                headerProfileUpload.click();
            });

            headerProfileUpload.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = function (e) {
                        const result = e.target.result;

                        // Update UI immediately
                        const profileAvatar = document.getElementById('profile-avatar');
                        const profileInitials = document.getElementById('profile-initials');
                        const dropdownAvatar = document.getElementById('dropdown-avatar');

                        if (profileAvatar) {
                            profileAvatar.src = result;
                            profileAvatar.classList.remove('hidden');
                        }
                        if (profileInitials) {
                            profileInitials.textContent = '';
                        }
                        if (dropdownAvatar) {
                            dropdownAvatar.src = result;
                            dropdownAvatar.style.display = 'block';
                        }

                        // Save to LocalStorage
                        try {
                            localStorage.setItem('userProfileImage', result);
                        } catch (err) {
                            console.warn('Failed to save profile image to localStorage', err);
                        }
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!profileIconBtn.contains(e.target) && !profileDropdown.contains(e.target)) {
                closeProfilePanel();
            }
        });

        // Logout functionality
        if (profileLogoutBtn) {
            profileLogoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                await handleLogout();
            });
        }
    }

    async function initProfilePanel() {
        // Check if user is logged in
        const isLoggedIn = localStorage.getItem('vendorLoggedIn') === 'true';

        if (!isLoggedIn) {
            // If not logged in, clicking profile icon should redirect to login
            profileIconBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                window.location.href = 'login.html';
            });

            // Show login icon instead of profile
            document.getElementById('profile-initials').textContent = '?';
            return;
        }

        // User is logged in, fetch and display profile data
        await loadUserProfile();
    }

    async function loadUserProfile() {
        try {
            // Fetch user profile from backend
            const response = await ApiService.get('/profile');

            const user = response.vendor || response.user || response.customer || response;
            if (!user) return;

            // Check for locally uploaded image override
            const localImage = localStorage.getItem('userProfileImage');
            if (localImage && user) {
                user.profile_picture = localImage;
            }

            if (user) {
                // Update profile icon
                const profileAvatar = document.getElementById('profile-avatar');
                const profileInitials = document.getElementById('profile-initials');

                if (user.profile_picture && user.profile_picture !== 'default.png') {
                    profileAvatar.src = user.profile_picture.startsWith('http')
                        ? user.profile_picture
                        : `${window.API_BASE_URL}/${user.profile_picture}`;
                    profileAvatar.classList.remove('hidden');
                    profileInitials.textContent = '';
                } else {
                    // Show initials
                    const initials = getInitials(user.fullname || user.full_name || user.email);
                    profileInitials.textContent = initials;
                    profileAvatar.classList.add('hidden');
                }

                // Update dropdown header
                const dropdownAvatar = document.getElementById('dropdown-avatar');
                const profileName = document.getElementById('profile-name');
                const profileGreeting = document.querySelector('.profile-greeting');

                if (dropdownAvatar) {
                    if (user.profile_picture && user.profile_picture !== 'default.png') {
                        dropdownAvatar.src = user.profile_picture.startsWith('http')
                            ? user.profile_picture
                            : `${window.API_BASE_URL}/${user.profile_picture}`;
                    } else {
                        // Use a default avatar or initials
                        dropdownAvatar.style.display = 'none';
                    }
                }

                if (profileName) {
                    profileName.textContent = user.fullname || user.full_name || 'User';
                }

                if (profileGreeting) {
                    const hour = new Date().getHours();
                    let greeting = 'Hello';
                    if (hour < 12) greeting = 'Good Morning';
                    else if (hour < 18) greeting = 'Good Afternoon';
                    else greeting = 'Good Evening';

                    profileGreeting.textContent = `${greeting}!`;
                }
            }
        } catch (error) {
            console.error('Failed to load user profile:', error);
            // If API fails, use localStorage data as fallback
            const userName = localStorage.getItem('userName') || localStorage.getItem('vendorEmail');
            if (userName) {
                const initials = getInitials(userName);
                document.getElementById('profile-initials').textContent = initials;
                document.getElementById('profile-name').textContent = userName;
            }
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

    function toggleProfilePanel() {
        const isLoggedIn = localStorage.getItem('vendorLoggedIn') === 'true';

        if (!isLoggedIn) {
            window.location.href = 'login.html';
            return;
        }

        profileDropdown.classList.toggle('hidden');
    }

    function closeProfilePanel() {
        if (profileDropdown) {
            profileDropdown.classList.add('hidden');
        }
    }

    async function handleLogout() {
        try {
            // Call backend logout API
            await ApiService.post('/auth/logout');
        } catch (error) {
            console.error('Logout API error:', error);
        } finally {
            // Clear local storage
            localStorage.removeItem('vendorLoggedIn');
            localStorage.removeItem('vendorEmail');
            localStorage.removeItem('userName');
            localStorage.removeItem('userId');
            localStorage.removeItem('userProfileImage');

            // Redirect to login page
            window.location.href = 'login.html';
        }
    }

});
