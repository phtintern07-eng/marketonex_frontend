const API_BASE_URL = ''; // Relative path

// BFCache Handling (Prevent Back Button navigation after logout)
window.addEventListener('pageshow', (event) => {
    if (event.persisted || (window.performance && window.performance.navigation.type === 2)) {
        window.location.reload();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    // === LOG FILTERS ===
    const logFilter = document.getElementById('log-type-filter');
    if (logFilter) {
        logFilter.addEventListener('change', loadAdminLogs);
    }

    // === AUTH CHECK ===
    checkAdminAuth();

    // === NAVIGATION ===
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view-section');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tabName = item.getAttribute('data-tab');

            if (!tabName) {
                // Allow navigation for links like "Back to Home"
                if (item.getAttribute('href') && item.getAttribute('href') !== '#') {
                    window.location.href = item.getAttribute('href');
                    return;
                }
                return;
            }

            // UI Toggle
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            views.forEach(view => view.classList.remove('active'));
            document.getElementById(`${tabName}-view`).classList.add('active');

            // Logic Trigger
            if (tabName === 'pending') loadPendingVendors();
            if (tabName === 'pending-biz') { /* Level 2 logic if any */ }
            if (tabName === 'pending-bank') loadPendingBankDetails();
            if (tabName === 'vendors') loadAllVendors();
            if (tabName === 'customers') loadCustomers();
            if (tabName === 'dashboard') loadDashboardStats();
            if (tabName === 'logs') loadAdminLogs();

            // Update Header
            const titleMap = {
                'dashboard': 'Dashboard Overview',
                'pending': 'Pending Approvals',
                'pending-biz': 'Business Physical Verifications',
                'pending-bank': 'Bank Account Verifications',
                'vendors': 'Vendor Directory',
                'customers': 'Customer Information',
                'logs': 'System Logs'
            };
            const titleEl = document.getElementById('page-title');
            if (titleEl) titleEl.textContent = titleMap[tabName] || 'Admin Panel';
        });
    });

    // === DATE ===
    const now = new Date();
    document.getElementById('current-date').textContent = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // === LOGOUT ===
    document.getElementById('logout-btn').addEventListener('click', async () => {
        try {
            await fetch(`${API_BASE_URL}/api/admin/auth/logout`, { method: 'POST' });
            window.location.href = 'login.html';
        } catch (error) {
            window.location.href = 'login.html';
        }
    });

    // === INITIAL LOAD ===
    loadDashboardStats();
});

// --- API FUNCTIONS ---

async function checkAdminAuth() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/auth/status`);
        const data = await response.json();

        if (!data.isAuthenticated) {
            // alert('Unauthorized access. Admin role required.');
            window.location.href = 'login.html';
        } else {
            // Update profile UI
            if (data.admin) {
                const nameEl = document.querySelector('.user-name');
                if (nameEl) nameEl.textContent = data.admin.fullname;
            }
        }
    } catch (error) {
        window.location.href = 'login.html';
    }
}

async function loadDashboardStats() {
    try {
        // Fetch KYC verification data
        const kycResponse = await fetch(`${API_BASE_URL}/api/admin/kyc/verifications?status=pending`);
        const kycData = await kycResponse.json();

        if (!Array.isArray(kycData)) {
            throw new Error('Failed to load pending verifications');
        }

        const pendingCount = kycData.length;
        document.getElementById('stat-pending').textContent = pendingCount;
        document.getElementById('pending-badge').textContent = pendingCount;

        // Fetch Bank pending count
        try {
            const bankResponse = await fetch(`${API_BASE_URL}/api/admin/bank/verifications?status=pending`);
            const bankData = await bankResponse.json();
            const bankCount = bankData.length || 0;
            const bankStatEl = document.getElementById('stat-bank-pending');
            const bankBadge = document.getElementById('pending-bank-badge');
            if (bankStatEl) bankStatEl.textContent = bankCount;
            if (bankBadge) bankBadge.textContent = bankCount;
        } catch (e) { }

        // Populate recent KYC table (first 5) — id matches dashboard.html: recent-kyc-table
        const recentKycTable = document.getElementById('recent-kyc-table');
        if (recentKycTable) {
            recentKycTable.innerHTML = '';
            kycData.slice(0, 5).forEach(verification => {
                const row = `
                    <tr>
                        <td><a href="admin_vendor_details.html?id=${verification.vendor_id}" class="vendor-link">${verification.vendor_name || 'N/A'}</a></td>
                        <td>${new Date(verification.submitted_at).toLocaleDateString()}</td>
                        <td><button class="btn-action btn-view" onclick="viewVendorDetails(${verification.vendor_id})">View Details</button></td>
                    </tr>
                `;
                recentKycTable.innerHTML += row;
            });
        }

        // Get total active vendors count
        const allResp = await fetch(`${API_BASE_URL}/api/admin/vendors`);
        const allData = await allResp.json();
        const activeCount = allData.vendors.filter(v => v.verified).length;
        document.getElementById('stat-active').textContent = activeCount;

        // Get total customers count
        try {
            const custResp = await fetch(`${API_BASE_URL}/api/admin/customers`);
            const custData = await custResp.json();
            if (custData.customers) {
                const custCount = custData.customers.length;
                document.getElementById('stat-customers').textContent = custCount;
                // Update sidebar badge if visible
                const badge = document.getElementById('customers-badge');
                if (badge) badge.textContent = custCount || '';
            }
        } catch (custErr) {
        }

    } catch (error) {
    }
}

async function loadPendingVendors() {
    const tbody = document.getElementById('pending-table-body');
    const emptyState = document.getElementById('pending-empty');

    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Loading...</td></tr>';

    try {
        // Fetch KYC verification data for pending approvals
        const response = await fetch(`${API_BASE_URL}/api/admin/kyc/verifications?status=pending`);
        const verifications = await response.json();

        tbody.innerHTML = '';

        if (verifications.length === 0) {
            emptyState.style.display = 'block';
        } else {
            emptyState.style.display = 'none';
            verifications.forEach(verification => {
                const row = `
                    <tr>
                        <td><a href="admin_vendor_details.html?id=${verification.vendor_id}" class="vendor-link">${verification.vendor_name || 'N/A'}</a></td>
                        <td>${verification.vendor_email || 'N/A'}</td>
                        <td>${verification.business_address || 'N/A'}</td>
                        <td>${verification.vendor_phone || 'N/A'}</td>
                        <td>${new Date(verification.submitted_at).toLocaleDateString()}</td>
                        <td>
                            <button class="btn-action btn-view" onclick="viewVendorDetails(${verification.vendor_id})">
                                <i class="fas fa-eye"></i> View Details
                            </button>
                        </td>
                    </tr>
                `;
                tbody.innerHTML += row;
            });
        }
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="6" style="color:red">Error loading data</td></tr>';
    }
}

async function loadAllVendors() {
    const tbody = document.getElementById('all-vendors-body');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Loading...</td></tr>';

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/vendors`);
        const data = await response.json();

        tbody.innerHTML = '';

        data.vendors.forEach(vendor => {
            const statusClass = vendor.verified ? 'verified' : 'pending';
            const statusText = vendor.verified ? 'Active' : 'Pending';

            // Clean URL: base_url + vendor_slug
            const cleanUrl = `${window.location.origin}/${vendor.vendor_slug}`;

            const row = `
                <tr>
                    <td>#${vendor.id}</td>
                    <td>${vendor.fullname}</td>
                    <td>${vendor.email}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td>
                        <div class="store-url-cell">
                            <a href="${cleanUrl}" target="_blank" class="storefront-link" id="url-${vendor.id}">${cleanUrl}</a>
                            <div class="store-actions">
                                <button class="btn-icon" title="Copy Link" onclick="copyStoreURL('${cleanUrl}')">
                                    <i class="fas fa-copy"></i>
                                </button>
                                <button class="btn-icon" title="Edit Slug" onclick="editVendorSlug(${vendor.id}, '${vendor.vendor_slug}')">
                                    <i class="fas fa-edit"></i>
                                </button>
                            </div>
                        </div>
                    </td>
                    <td>${new Date(vendor.created_at).toLocaleDateString()}</td>
                    <td>
                        ${vendor.verified ?
                    `<button class="btn-action btn-block" onclick="blockVendor(${vendor.id})">Block</button>` :
                    `<button class="btn-action btn-approve" onclick="approveVendor(${vendor.id})">Approve</button>`
                }
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="6" style="color:red">Error loading vendors</td></tr>';
    }
}

// ── Customer Management ───────────────────────────────────────────────────────
let _allCustomers = [];

async function loadCustomers() {
    const tbody = document.getElementById('customers-table-body');
    const emptyState = document.getElementById('customers-empty');
    const searchInput = document.getElementById('customer-search');

    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center">Loading...</td></tr>';

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/customers`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        _allCustomers = data.customers || [];
        renderCustomerRows(_allCustomers);

        // Live search
        if (searchInput) {
            searchInput.oninput = () => {
                const q = searchInput.value.trim().toLowerCase();
                const filtered = q
                    ? _allCustomers.filter(c =>
                        (c.fullname || '').toLowerCase().includes(q) ||
                        (c.email || '').toLowerCase().includes(q) ||
                        (c.phone || '').toLowerCase().includes(q) ||
                        (c.address || '').toLowerCase().includes(q)
                    )
                    : _allCustomers;
                renderCustomerRows(filtered);
            };
        }
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="7" style="color:red">Error loading customers</td></tr>';
    }
}

function renderCustomerRows(customers) {
    const tbody = document.getElementById('customers-table-body');
    const emptyState = document.getElementById('customers-empty');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!customers || customers.length === 0) {
        if (emptyState) emptyState.style.display = 'block';
        return;
    }
    if (emptyState) emptyState.style.display = 'none';

    customers.forEach((c, idx) => {
        const joined = c.created_at ? new Date(c.created_at).toLocaleDateString() : '—';
        const updated = c.updated_at ? new Date(c.updated_at).toLocaleString() : '—';
        const row = `
            <tr>
                <td>${idx + 1}</td>
                <td>${c.fullname || '—'}</td>
                <td><a href="mailto:${c.email}" style="color:var(--primary-color)">${c.email}</a></td>
                <td>${c.phone || '—'}</td>
                <td style="max-width:220px;white-space:normal;word-break:break-word">${c.address || '—'}</td>
                <td>${joined}</td>
                <td>${updated}</td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

// --- ACTIONS ---

async function approveVendor(id) {
    if (!confirm('Are you sure you want to approve this vendor?')) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/vendors/${id}/approve`, { method: 'POST' });
        const result = await response.json();

        if (response.ok) {
            alert('Vendor approved successfully!');
            loadDashboardStats(); // Refresh stats
            loadPendingVendors(); // Refresh pending list
            loadAllVendors(); // Refresh all list if visible
        } else {
            alert('Error: ' + result.error);
        }
    } catch (error) {
        alert('Failed to approve vendor: ' + error.message);
    }
}

async function blockVendor(id) {
    if (!confirm('Are you sure you want to BLOCK this vendor? They will lose access immediately.')) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/vendors/${id}/block`, { method: 'POST' });
        if (response.ok) {
            alert('Vendor blocked.');
            loadAllVendors();
        } else {
            alert('Failed to block vendor');
        }
    } catch (error) {
    }
}

// --- MODAL LOGIC ---
let currentRejectId = null;

function openRejectModal(id) {
    currentRejectId = id;
    document.getElementById('reject-modal').style.display = 'flex';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
    currentRejectId = null;
    document.getElementById('rejection-reason').value = '';
}

document.getElementById('confirm-reject').addEventListener('click', async () => {
    if (!currentRejectId) return;

    const reason = document.getElementById('rejection-reason').value;
    if (!reason) {
        alert('Please provide a reason');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/vendors/${currentRejectId}/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason })
        });

        if (response.ok) {
            alert('Vendor rejected.');
            closeModal('reject-modal');
            loadPendingVendors();
            loadDashboardStats();
        } else {
            alert('Failed to reject vendor');
        }
    } catch (error) {
        alert('Error rejecting vendor');
    }
});

// Close modal checking
window.onclick = function (event) {
    if (event.target.classList.contains('modal')) {
        closeModal(event.target.id);
    }
}

// Navigate to vendor details page
function viewVendorDetails(vendorId) {
    window.location.href = `admin_vendor_details.html?id=${vendorId}`;
}

// === ADMIN LOGS ===
async function loadAdminLogs() {
    const tableBody = document.getElementById('logs-table-body');
    const emptyState = document.getElementById('logs-empty');
    if (!tableBody) return;

    const type = document.getElementById('log-type-filter')?.value || 'All';

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/logs?type=${type}&limit=50`);
        const data = await response.json();

        tableBody.innerHTML = '';

        if (!data.logs || data.logs.length === 0) {
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';

        data.logs.forEach(log => {
            const row = document.createElement('tr');
            row.className = 'log-row';

            const time = new Date(log.created_at);
            const statusClass = (log.status || '').toLowerCase() === 'failed' ? 'status-rejected' : 'status-approved';

            row.innerHTML = `
                <td class="log-time">${time.toLocaleString()}</td>
                <td class="log-user">
                    <div class="user-info-small">
                        <span class="user-email">${log.user_email || 'System'}</span>
                        <span class="user-role-badge role-${(log.role || 'system').toLowerCase()}">${log.role || 'System'}</span>
                    </div>
                </td>
                <td class="log-action"><strong>${log.action_type}</strong></td>
                <td class="log-desc">${log.description}</td>
                <td class="log-status">
                    <span class="status-badge ${statusClass}">${log.status || 'Success'}</span>
                </td>
            `;
            tableBody.appendChild(row);
        });
    } catch (error) {
    }
}
async function loadPendingBankDetails() {
    const tbody = document.getElementById('pending-bank-body');
    const emptyState = document.getElementById('pending-bank-empty');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Loading...</td></tr>';

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/bank/verifications?status=pending`);
        const data = await response.json();

        tbody.innerHTML = '';
        if (!data || data.length === 0) {
            emptyState.style.display = 'block';
        } else {
            emptyState.style.display = 'none';
            data.forEach(v => {
                const row = `
                    <tr>
                        <td>
                            <strong>${v.vendor_name || 'N/A'}</strong><br>
                            <small style="color: #666;">${v.vendor_email || 'N/A'}</small>
                        </td>
                        <td>${v.bank_name}</td>
                        <td>
                            <code style="background: #f0f0f0; padding: 2px 4px; border-radius: 4px;">Acc: ${v.account_number}</code><br>
                            <code style="background: #f0f0f0; padding: 2px 4px; border-radius: 4px; margin-top: 4px; display: inline-block;">IFSC: ${v.ifsc_code}</code>
                        </td>
                        <td>${new Date(v.updated_at).toLocaleString()}</td>
                        <td>
                            <div class="action-btns" style="display: flex; gap: 8px;">
                                <button class="btn-action btn-approve" onclick="approveBank(${v.id})" style="padding: 4px 10px; font-size: 11px;">
                                    <i class="fas fa-check"></i> Approve
                                </button>
                                <button class="btn-action btn-block" onclick="rejectBank(${v.id})" style="padding: 4px 10px; font-size: 11px; background: #ef4444;">
                                    <i class="fas fa-times"></i> Reject
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
                tbody.innerHTML += row;
            });
        }
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="5" style="color:red; text-align:center;">Error loading bank details</td></tr>';
    }
}

async function approveBank(id) {
    if (!confirm('Approve these bank details?')) return;
    try {
        const res = await fetch(`/api/admin/bank/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ verification_id: id, status: 'approved' })
        });
        if (res.ok) {
            // alert('Bank details approved!');
            loadPendingBankDetails();
            loadDashboardStats();
        } else {
            const data = await res.json();
            alert('Error: ' + data.error);
        }
    } catch (e) { alert('Network error'); console.error(e); }
}

async function rejectBank(id) {
    const reason = prompt('Please enter rejection reason:');
    if (reason === null) return;
    try {
        const res = await fetch(`/api/admin/bank/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ verification_id: id, status: 'rejected', rejection_reason: reason })
        });
        if (res.ok) {
            // alert('Bank details rejected');
            loadPendingBankDetails();
            loadDashboardStats();
        } else {
            const data = await res.json();
            alert('Error: ' + data.error);
        }
    } catch (e) { alert('Network error'); console.error(e); }
}

// Clean URL Functions
function copyStoreURL(url) {
    navigator.clipboard.writeText(url).then(() => {
        alert('Store URL copied to clipboard!');
    }).catch(err => {
        // Fallback
        const el = document.createElement('textarea');
        el.value = url;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        alert('Store URL copied to clipboard!');
    });
}

async function editVendorSlug(vendorId, currentSlug) {
    const newSlug = prompt('Enter new vendor slug (lowercase, no spaces, hyphens allowed):', currentSlug);

    if (newSlug === null || newSlug === currentSlug) return;

    // Simple frontend validation
    const slugRegex = /^[a-z0-9][a-z0-9\-]*[a-z0-9]$/;
    if (!slugRegex.test(newSlug)) {
        alert('Invalid slug format. Use lowercase letters, numbers, and hyphens only (e.g. "nikhil-store").');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/vendors/${vendorId}/slug`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug: newSlug })
        });

        const result = await response.json();

        if (response.ok) {
            alert('Vendor slug updated successfully!');
            loadAllVendors(); // Refresh the list
        } else {
            alert('Error: ' + result.error);
        }
    } catch (error) {
        alert('Failed to update vendor slug');
    }
}
