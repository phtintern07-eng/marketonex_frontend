
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
