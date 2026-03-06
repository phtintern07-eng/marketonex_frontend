/**
 * Admin Vendor Verification Details JavaScript
 * Handles loading vendor details (Step 1 & Step 2), document viewing, and approval/rejection
 */

let currentVendorId = null;
let currentVerificationId = null;
let vendorData = null;
let bizData = null;
let currentRejectDocType = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function () {
    // Get vendor ID from URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    currentVendorId = urlParams.get('id');

    if (!currentVendorId) {
        showError('No vendor ID provided');
        return;
    }

    // Set current date
    setCurrentDate();

    // Load vendor details (Step 1 & Step 2)
    loadAllVerificationDetails();

    // Setup event listeners
    setupEventListeners();
});

function setCurrentDate() {
    const dateElement = document.getElementById('current-date');
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateElement.textContent = now.toLocaleDateString('en-US', options);
}

function setupEventListeners() {
    // KYC (Step 1) Buttons
    document.getElementById('approve-btn').addEventListener('click', handleApprove);
    document.getElementById('reject-btn').addEventListener('click', () => showRejectModal('kyc'));

    // Biz (Step 2) Buttons
    const approveBizBtn = document.getElementById('approve-biz-btn');
    if (approveBizBtn) approveBizBtn.addEventListener('click', handleApproveBiz);

    const rejectBizBtn = document.getElementById('reject-biz-btn');
    if (rejectBizBtn) rejectBizBtn.addEventListener('click', () => showRejectModal('biz'));

    // Form confirmation
    document.getElementById('confirm-reject-btn').addEventListener('click', () => {
        const mode = document.getElementById('reject-modal').getAttribute('data-mode');
        if (mode === 'biz') handleRejectBiz();
        else handleReject();
    });

    document.getElementById('confirm-reject-doc-btn').addEventListener('click', handleRejectDocument);
    document.getElementById('logout-btn').addEventListener('click', handleLogout);

    // Global Delegate for Document buttons (Views/Rejects)
    document.addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        // Step 1 Docs
        if (target.hasAttribute('data-doc')) {
            const doc = target.getAttribute('data-doc');
            if (target.classList.contains('btn-view')) viewDocument(doc);
            if (target.classList.contains('btn-download')) downloadDocument(doc);
            if (target.classList.contains('btn-doc-reject')) {
                const label = target.getAttribute('data-doc-label');
                showRejectDocModal(doc, label);
            }
        }

        // Step 2 Docs
        if (target.hasAttribute('data-biz-doc')) {
            const doc = target.getAttribute('data-biz-doc');
            if (target.classList.contains('btn-view')) viewBizDocument(doc);
            if (target.classList.contains('btn-download')) downloadBizDocument(doc);
            if (target.classList.contains('btn-biz-doc-reject')) {
                const label = target.getAttribute('data-label');
                showRejectBizDocModal(doc, label);
            }
        }
    });
}

/**
 * Load both KYC and Biz details in parallel
 */
async function loadAllVerificationDetails() {
    try {
        showLoading();

        // Fetch Step 1
        const kycRes = await fetch(`/api/admin/kyc/vendor/${currentVendorId}`);
        const kycJson = await kycRes.json();
        vendorData = kycJson.data;

        // Fetch Step 2
        const bizRes = await fetch(`/api/admin/biz-verifications/vendor/${currentVendorId}`);
        const bizJson = await bizRes.json();
        bizData = bizJson.data;

        if (!vendorData && !bizData) {
            throw new Error('No verification data found for this vendor');
        }

        if (vendorData) {
            currentVerificationId = vendorData.id;
            populateVendorDetails();
        }

        if (bizData) {
            document.getElementById('biz-verification-card').style.display = 'block';
            populateBizDetails();
        }

        hideLoading();
    } catch (error) {
        showError(error.message);
    }
}

/**
 * Populate KYC (Step 1)
 */
function populateVendorDetails() {
    document.getElementById('vendor-name').textContent = vendorData.vendor_name || 'N/A';
    document.getElementById('vendor-email').textContent = vendorData.vendor_email || 'N/A';
    document.getElementById('vendor-id-display').textContent = vendorData.vendor_id;

    updateStatusBadge(vendorData.status);

    document.getElementById('business-name').textContent = vendorData.business_name || '-';
    document.getElementById('full-name').textContent = vendorData.full_name || '-';
    document.getElementById('pan-number').textContent = vendorData.pan_number || '-';
    document.getElementById('gst-number').textContent = vendorData.gst_number || 'Not Provided';
    document.getElementById('gov-id-type').textContent = vendorData.government_id_type || '-';
    document.getElementById('gov-id-number').textContent = vendorData.government_id_number || '-';
    document.getElementById('business-reg-type').textContent = vendorData.business_registration_type || '-';
    document.getElementById('business-address').textContent = vendorData.business_address || '-';

    document.getElementById('account-holder').textContent = vendorData.bank_account_holder_name || '-';
    document.getElementById('bank-name').textContent = vendorData.bank_name || '-';
    document.getElementById('ifsc-code').textContent = vendorData.bank_ifsc_code || '-';

    if (vendorData.bank_account_number) {
        document.getElementById('account-number').textContent = 'XXXX-XXXX-' + vendorData.bank_account_number.slice(-4);
    }

    if (vendorData.submitted_at) {
        document.getElementById('submitted-at').textContent = new Date(vendorData.submitted_at).toLocaleString();
    }

    if (vendorData.rejection_reason) {
        document.getElementById('rejection-reason').textContent = vendorData.rejection_reason;
        document.getElementById('rejection-row').style.display = 'grid';
    }

    if (vendorData.selfie_with_id || _isDocMentionedInRejection('selfie_with_id')) {
        document.getElementById('selfie-doc').style.display = 'flex';
    }

    if (vendorData.status !== 'pending') {
        document.getElementById('action-buttons').style.display = 'none';
    }

    populateKYCDocuments();
}

/**
 * Populate Biz (Step 2)
 */
function populateBizDetails() {
    const mapsLink = document.getElementById('biz-maps-link');
    if (bizData.google_maps_link) {
        mapsLink.href = bizData.google_maps_link;
        mapsLink.style.display = 'inline-block';
    }

    document.getElementById('biz-status-badge').textContent = bizData.status.toUpperCase();
    document.getElementById('biz-status-badge').className = `status-badge status-${bizData.status}`;

    const bizFields = ['shop_front_photo', 'shop_board_photo', 'shop_video', 'vendor_photo', 'brand_auth_certificate', 'service_certification', 'business_proof'];
    bizFields.forEach(f => populateBizDocCard(f));

    if (bizData.status !== 'pending') {
        document.getElementById('biz-action-buttons').style.display = 'none';
    }
}

/**
 * KYC Doc Helpers
 */
function populateKYCDocuments() {
    const fields = ['pan_card_image', 'government_id_proof', 'business_certificate', 'business_address_proof', 'cancelled_cheque', 'selfie_with_id'];
    fields.forEach(f => populateKYCDocCard(f));
}

function populateKYCDocCard(field) {
    const status = _getDocStatus(field);
    const reason = _getDocRejectionReason(field);
    const viewBtn = document.querySelector(`.btn-view[data-doc='${field}']`);
    if (!viewBtn) return;
    const item = viewBtn.closest('.document-item');
    if (!item) return;

    _applyDocUI(item, status, reason);
    if (status === 'not_uploaded' || status === 'rejected') {
        item.querySelectorAll('.btn-view, .btn-download').forEach(b => b.classList.add('btn--disabled'));
        item.querySelectorAll('.btn-doc-reject').forEach(b => b.style.display = 'none');
    }
}

/**
 * Biz Doc Helpers
 */
function populateBizDocCard(field) {
    const item = document.querySelector(`.biz-doc[data-field="${field}"]`);
    if (!item) return;

    const hasFile = !!bizData[field];
    const reason = _getBizDocRejectionReason(field);
    const isReuploaded = reason === 'REUPLOADED';

    let status = 'pending';
    if (!hasFile && !reason) status = 'not_uploaded';
    else if (!hasFile && reason && !isReuploaded) status = 'rejected';
    else if (hasFile && isReuploaded) status = 'reupload';
    else if (hasFile && bizData.status === 'approved') status = 'approved';
    else if (hasFile) status = 'pending';

    _applyDocUI(item, status, reason, true); // true for Step 2 3D effects

    // Disable buttons if not uploaded (Step 2 Only)
    if (status === 'not_uploaded') {
        item.querySelectorAll('.btn-view, .btn-download').forEach(b => {
            b.classList.add('btn--disabled');
            b.disabled = true;
        });
        item.querySelectorAll('.btn-biz-doc-reject').forEach(b => b.style.display = 'none');
    }
}

/**
 * UI Application logic (SHARED)
 */
function _applyDocUI(item, status, reason, isStep2 = false) {
    const statusCfg = {
        not_uploaded: { cls: 'status-not-uploaded', icon: 'fa-exclamation-triangle', label: 'Not Uploaded', color: '#94a3b8' },
        rejected: { cls: 'status-rejected', icon: 'fa-times-circle', label: 'Rejected', color: '#ef4444' },
        reupload: { cls: 'status-reuploaded', icon: 'fa-redo-alt', label: 'Re-uploaded', color: '#3b82f6' },
        pending: { cls: 'status-pending', icon: 'fa-clock', label: 'Pending', color: '#f59e0b' },
        approved: { cls: 'status-approved', icon: 'fa-check-circle', label: 'Approved', color: '#10b981' }
    };
    const cfg = statusCfg[status];

    // Apply 3D card enhancements (EXCLUSIVE TO STEP 2 AS REQUESTED)
    if (isStep2) {
        item.classList.add('doc-item-3d', `doc-status--${status}`);
        if (status === 'reupload') item.classList.add('card-reuploaded-glow');
    } else {
        item.classList.add('document-item-standard');
    }

    const info = item.querySelector('.document-info');
    if (!info) return;

    // Clear old status elements
    item.querySelectorAll('.doc-status-badge, .doc-rejection-note, .doc-status-badge-3d, .doc-rejection-note-3d').forEach(el => el.remove());

    const badge = document.createElement('div');
    badge.className = isStep2 ? `doc-status-badge-3d ${cfg.cls}` : `status-badge ${cfg.cls}`;
    if (isStep2) {
        badge.style.borderLeft = `4px solid ${cfg.color}`;
        badge.innerHTML = `<i class="fas ${cfg.icon}"></i><span>${cfg.label}</span>`;
    } else {
        badge.innerHTML = `<i class="fas ${cfg.icon}"></i> ${cfg.label}`;
    }
    info.insertBefore(badge, info.firstChild);

    if (reason && status !== 'reupload') {
        const note = document.createElement('div');
        note.className = isStep2 ? 'doc-rejection-note-3d' : 'doc-rejection-note';
        note.innerHTML = `<i class="fas fa-exclamation-triangle"></i> <span>${reason}</span>`;
        info.appendChild(note);
    }
}

function _getDocStatus(field) {
    const hasFile = !!vendorData[field];
    const inRejection = _isDocMentionedInRejection(field);
    if (!hasFile && !inRejection) return 'not_uploaded';
    if (!hasFile && inRejection) return 'rejected';
    if (hasFile && inRejection) return 'reupload';
    if (hasFile && vendorData.status === 'approved') return 'approved';
    return 'pending';
}

function _isDocMentionedInRejection(field) {
    const fieldMap = { 'pan_card_image': 'Pan Card Image', 'government_id_proof': 'Government Id Proof', 'business_certificate': 'Business Certificate', 'business_address_proof': 'Business Address Proof', 'cancelled_cheque': 'Cancelled Cheque', 'selfie_with_id': 'Selfie With Id' };
    if (!vendorData.rejection_reason) return false;
    return vendorData.rejection_reason.includes(`[${fieldMap[field]}]`);
}

function _getDocRejectionReason(field) {
    if (!vendorData.rejection_reason) return '';
    const labelMap = { pan_card_image: 'Pan Card Image', government_id_proof: 'Government Id Proof', business_certificate: 'Business Certificate', business_address_proof: 'Business Address Proof', cancelled_cheque: 'Cancelled Cheque', selfie_with_id: 'Selfie With Id' };
    const line = vendorData.rejection_reason.split('\n').find(l => l.startsWith(`[${labelMap[field]}]`));
    return line ? line.replace(/^\[.+?\]:\s*/, '') : '';
}

function _getBizDocRejectionReason(field) {
    if (!bizData.rejection_reason) return '';
    const labelMap = { shop_front_photo: 'Shop Front Photo', shop_board_photo: 'Shop Board Photo', shop_video: 'Shop Video', vendor_photo: 'Vendor Photo', brand_auth_certificate: 'Brand Authorization', service_certification: 'Service Certification', business_proof: 'Business Proof' };
    const line = bizData.rejection_reason.split('\n').find(l => l.startsWith(`[${labelMap[field]}]`));
    return line ? line.replace(/^\[.+?\]:\s*/, '') : '';
}

/**
 * Approval / Rejection Logic
 */
async function handleApprove() {
    if (confirm('Approve KYC?')) {
        const res = await fetch(`/api/admin/kyc/${currentVerificationId}/approve`, { method: 'POST', credentials: 'include' });
        if (res.ok) { alert('KYC Approved'); location.reload(); }
    }
}

async function handleReject() {
    const reason = document.getElementById('rejection-reason-input').value.trim();
    if (!reason) return alert('Reason required');
    const res = await fetch(`/api/admin/kyc/${currentVerificationId}/reject`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) });
    if (res.ok) { alert('KYC Rejected'); location.reload(); }
}

async function handleApproveBiz() {
    if (confirm('Approve Level 2?')) {
        const res = await fetch(`/api/admin/biz-verifications/${bizData.id}/approve`, { method: 'POST', credentials: 'include' });
        if (res.ok) { alert('Step 2 Approved!'); location.reload(); }
    }
}

async function handleRejectBiz() {
    const reason = document.getElementById('rejection-reason-input').value.trim();
    if (!reason) return alert('Reason required');
    const res = await fetch(`/api/admin/biz-verifications/${bizData.id}/reject`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) });
    if (res.ok) { alert('Step 2 Rejected.'); location.reload(); }
}

/**
 * Granular Rejection
 */
async function handleRejectDocument() {
    const reason = document.getElementById('reject-doc-reason-input').value.trim();
    if (!reason) return alert('Reason required');
    const res = await fetch(`/api/admin/kyc/${currentVerificationId}/reject-document`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ document_field: currentRejectDocType, reason }) });
    if (res.ok) { alert('Document Rejected'); location.reload(); }
}

async function showRejectBizDocModal(field, label) {
    const reason = prompt(`Reason for rejecting ${label}:`);
    if (!reason) return;
    const res = await fetch(`/api/admin/biz-verifications/${bizData.id}/reject-document`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ document_field: field, reason }) });
    if (res.ok) { alert('Document Rejected'); location.reload(); }
}

/**
 * Viewing logic
 */
function viewDocument(docType) {
    const docUrl = `/api/admin/view-document/${currentVendorId}/${docType}`;
    const modal = document.getElementById('document-modal');
    document.getElementById('document-iframe').src = docUrl;
    document.getElementById('document-title').textContent = docType.replace(/_/g, ' ').toUpperCase();
    modal.classList.add('show');
}

function viewBizDocument(field) {
    const docUrl = `/api/admin/biz-verifications/${currentVendorId}/view-document/${field}`;
    const modal = document.getElementById('document-modal');
    document.getElementById('document-iframe').src = docUrl;
    document.getElementById('document-title').textContent = field.replace(/_/g, ' ').toUpperCase();
    modal.classList.add('show');
}

function downloadDocument(docType) {
    window.location.href = `/api/admin/download-document/${currentVendorId}/${docType}`;
}

function downloadBizDocument(field) {
    window.location.href = `/api/admin/biz-verifications/${currentVendorId}/download-document/${field}`;
}

// Add download biz listener in delegate if needed, or just update the delegate
// Actually let's just update the delegate in setupEventListeners

/**
 * Modal control
 */
function showRejectModal(mode) {
    const modal = document.getElementById('reject-modal');
    modal.setAttribute('data-mode', mode);
    modal.classList.add('show');
    document.getElementById('rejection-reason-input').value = '';
}

function showError(msg) {
    document.getElementById('loading-state').style.display = 'none';
    document.getElementById('error-state').style.display = 'flex';
    document.getElementById('error-message').textContent = msg;
}

function hideLoading() {
    document.getElementById('loading-state').style.display = 'none';
    document.getElementById('vendor-details-content').style.display = 'block';
}

function showLoading() {
    document.getElementById('loading-state').style.display = 'flex';
    document.getElementById('vendor-details-content').style.display = 'none';
}

function updateStatusBadge(status) {
    const badge = document.getElementById('main-status-badge');
    badge.className = `status-badge status-${status}`;
    badge.innerHTML = `<span>${status.toUpperCase()}</span>`;
}

function handleLogout() {
    fetch('/api/auth/logout', { method: 'POST' }).then(() => window.location.href = '../index.html');
}

/**
 * Modal control
 */
function closeDocumentModal() {
    const modal = document.getElementById('document-modal');
    modal.classList.remove('show');
    document.getElementById('document-iframe').src = '';
}

function closeRejectModal() {
    document.getElementById('reject-modal').classList.remove('show');
}

function closeRejectDocModal() {
    document.getElementById('reject-doc-modal').classList.remove('show');
}

function showRejectDocModal(field, label) {
    currentRejectDocType = field;
    document.getElementById('reject-doc-label').textContent = label;
    document.getElementById('reject-doc-reason-input').value = '';
    document.getElementById('reject-doc-modal').classList.add('show');
}

// Close modals when clicking outside
window.onclick = function (event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('show');
    }
}
