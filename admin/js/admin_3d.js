/**
 * Admin Dashboard 3D Logic & Level 2 Integration
 * Overrides / Complements existing admin.js
 */

document.addEventListener('DOMContentLoaded', () => {
    // Override loadDashboardStats with our new 3D/Level 2 version
    window.loadDashboardStats = loadDashboardStats3D;

    // Add listener for Step 2 (Biz) Tab
    const bizTab = document.querySelector('[data-tab="pending-biz"]');
    if (bizTab) {
        bizTab.addEventListener('click', loadPendingBizVerifications);
    }

    const refreshBizBtn = document.getElementById('refreshBizBtn');
    if (refreshBizBtn) {
        refreshBizBtn.addEventListener('click', loadPendingBizVerifications);
    }

    // Initial Load
    loadDashboardStats3D();
});

/**
 * Enhanced Dashboard Stats with 3D Animations and Level 2 data
 */
async function loadDashboardStats3D() {
    try {
        const response = await fetch('/api/admin/dashboard/stats');
        const data = await response.json();

        if (!response.ok) throw new Error(data.error || 'Failed to load stats');

        // Animate Counters
        animateValue("stat-pending", data.kyc_pending_count, 1000);
        animateValue("stat-biz-pending", data.biz_pending_count, 1000);
        animateValue("stat-active", data.active_vendors_count, 1000);

        // Update Badges
        document.getElementById('pending-badge').textContent = data.kyc_pending_count;
        document.getElementById('pending-biz-badge').textContent = data.biz_pending_count;

        // Populate Recent KYC
        const kycTable = document.getElementById('recent-kyc-table');
        kycTable.innerHTML = '';
        data.recent_kyc.forEach(v => {
            kycTable.innerHTML += `
                <tr>
                    <td><a href="admin_vendor_details.html?id=${v.vendor_id}" class="vendor-link">${v.vendor_name}</a></td>
                    <td>${new Date(v.submitted_at).toLocaleDateString()}</td>
                    <td><button class="btn-action btn-view" onclick="viewVendorDetails(${v.vendor_id})">View</button></td>
                </tr>
            `;
        });

        // Populate Recent Biz
        const bizTable = document.getElementById('recent-biz-table');
        bizTable.innerHTML = '';
        data.recent_biz.forEach(b => {
            bizTable.innerHTML += `
                <tr>
                    <td><a href="admin_vendor_details.html?id=${b.vendor_id}" class="vendor-link">${b.vendor_name}</a></td>
                    <td>${new Date(b.submitted_at).toLocaleDateString()}</td>
                    <td><button class="btn-action btn-view" onclick="viewVendorDetails(${b.vendor_id})">View</button></td>
                </tr>
            `;
        });

    } catch (error) {
    }
}

/**
 * Load Pending Level 2 (Business) Verifications
 */
async function loadPendingBizVerifications() {
    const tbody = document.getElementById('pending-biz-body');
    const emptyState = document.getElementById('pending-biz-empty');

    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center">Loading...</td></tr>';

    try {
        const res = await fetch('/api/admin/biz-verifications?status=pending');
        const { data } = await res.json();

        tbody.innerHTML = '';
        if (!data || data.length === 0) {
            emptyState.style.display = 'block';
        } else {
            emptyState.style.display = 'none';
            data.forEach(bv => {
                tbody.innerHTML += `
                    <tr>
                        <td><a href="admin_vendor_details.html?id=${bv.vendor_id}" class="vendor-link">${bv.vendor_name}</a></td>
                        <td>${bv.vendor_email}</td>
                        <td>${new Date(bv.submitted_at).toLocaleDateString()}</td>
                        <td>
                            <button class="btn-action btn-view" onclick="viewVendorDetails(${bv.vendor_id})">
                                <i class="fas fa-search-location"></i> Review Shop
                            </button>
                        </td>
                    </tr>
                `;
            });
        }
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="4" style="color:red">Error loading data</td></tr>';
    }
}

/**
 * Animated Counter Utility
 */
function animateValue(id, end, duration) {
    const obj = document.getElementById(id);
    if (!obj) return;

    let start = 0;
    const range = end - start;
    let current = start;
    const increment = end > start ? 1 : -1;
    const stepTime = Math.abs(Math.floor(duration / range)) || 50;

    if (end === 0) {
        obj.textContent = "0";
        return;
    }

    const timer = setInterval(() => {
        current += increment;
        obj.textContent = current;
        if (current == end) {
            clearInterval(timer);
        }
    }, stepTime);
}
