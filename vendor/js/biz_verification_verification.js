// ================= BUSINESS VERIFICATION PAGE JS =================
// JavaScript used for handling the vendor business verification process
// Code originally from biz_verification.js

/**
 * Vendor Business Verification (Step 2) JavaScript
 * Handles 3D UI interactions, file previews, and API integration.
 */

document.addEventListener('DOMContentLoaded', function () {
    loadBizVerificationStatus();
    setupBizFileUploads();
    setupBizForm();
});

/**
 * Setup file upload listeners and previews
 */
function setupBizFileUploads() {
    const fileFields = [
        'shop_front_photo', 'shop_board_photo', 'shop_video',
        'vendor_photo', 'brand_auth_certificate', 'service_certification',
        'business_proof'
    ];

    fileFields.forEach(field => {
        const input = document.getElementsByName(field)[0];
        if (!input) return;

        input.addEventListener('change', function (e) {
            handleBizPreview(field, e.target.files[0]);
        });
    });
}

/**
 * Handle document previews (images and videos)
 */
function handleBizPreview(field, file) {
    const container = document.getElementById(`preview_${field}`);
    if (!container) return;

    if (!file) {
        container.style.display = 'none';
        container.innerHTML = '';
        return;
    }

    // Size check (backend limit is 50MB, but 10MB is safer for browser performance)
    if (file.size > 50 * 1024 * 1024) {
        showBizToast('File too large. Max 50MB allowed.', 'error');
        return;
    }

    container.innerHTML = '';
    container.style.display = 'block';

    const reader = new FileReader();
    reader.onload = function (e) {
        const isVideo = file.type.startsWith('video/');
        const isPdf = file.type === 'application/pdf';

        let previewEl;
        if (isVideo) {
            previewEl = document.createElement('video');
            previewEl.src = e.target.result;
            previewEl.controls = true;
        } else if (isPdf) {
            previewEl = document.createElement('div');
            previewEl.innerHTML = `<i class="fas fa-file-pdf" style="font-size: 3rem; color: #ef4444;"></i><p>${file.name}</p>`;
            previewEl.className = 'pdf-preview';
        } else {
            previewEl = document.createElement('img');
            previewEl.src = e.target.result;
        }

        const removeBtn = document.createElement('button');
        removeBtn.className = 'preview-remove';
        removeBtn.innerHTML = '<i class="fas fa-times"></i>';
        removeBtn.onclick = function () {
            document.getElementsByName(field)[0].value = '';
            container.style.display = 'none';
            container.innerHTML = '';
        };

        container.appendChild(previewEl);
        container.appendChild(removeBtn);
    };
    reader.readAsDataURL(file);
}

/**
 * Handle form submission
 */
function setupBizForm() {
    const form = document.getElementById('bizVerificationForm');
    if (!form) return;

    form.addEventListener('submit', async function (e) {
        e.preventDefault();

        const submitBtn = document.getElementById('submitBtn');
        const origText = submitBtn.innerText;
        submitBtn.disabled = true;
        submitBtn.innerText = 'Uploading documents...';

        const formData = new FormData(form);

        try {
            const res = await fetch('/api/vendor/biz-verification/submit', {
                method: 'POST',
                body: formData
            });

            const data = await res.json();

            if (res.ok) {
                showBizToast('Verification submitted successfully!', 'success');
                setTimeout(() => location.reload(), 1500);
            } else {
                showBizToast(data.error || 'Submission failed', 'error');
                submitBtn.disabled = false;
                submitBtn.innerText = origText;
            }
        } catch (err) {
            console.error(err);
            showBizToast('Network error occurred', 'error');
            submitBtn.disabled = false;
            submitBtn.innerText = origText;
        }
    });
}

/**
 * Load current status
 */
async function loadBizVerificationStatus() {
    try {
        const res = await fetch('/api/vendor/biz-verification/status');
        const data = await res.json();

        if (res.ok && data.data && data.data.status) {
            updateBizStatusUI(data.data);
        }
    } catch (err) {
        console.error('Failed to load status', err);
    }
}

/**
 * Update UI based on verification status
 */
function updateBizStatusUI(data) {
    const statusText = document.getElementById('statusText');
    const badge = document.getElementById('overallStatusBadge');
    const form = document.getElementById('bizVerificationForm');
    const pendingMsg = document.getElementById('pendingMessage');

    statusText.innerText = data.status.replace('_', ' ').toUpperCase();

    // Reset UI states
    document.querySelectorAll('.biz-card-3d').forEach(c => {
        c.classList.remove('rejected-card', 'reuploaded-card');
        c.style.opacity = '1';

        // Remove all dynamically added elements
        c.querySelectorAll('.rejection-box, .reupload-trigger-btn, .reupload-status-indicator, .card-status-badge').forEach(el => el.remove());

        // Show the upload area (might have been hidden by renderExistingBizPreview)
        const uploadArea = c.querySelector('.upload-3d-area');
        if (uploadArea) {
            uploadArea.style.display = 'block';
            uploadArea.style.pointerEvents = 'auto';
            uploadArea.style.background = '';
        }

        // Enable inputs
        const input = c.querySelector('input');
        if (input) {
            input.disabled = false;
            input.style.opacity = '1';
        }
    });

    // Reset Google Maps link state
    const maps = document.getElementById('googleMapsLink');
    if (maps) {
        maps.disabled = false;
        maps.style.opacity = '1';
    }

    badge.className = 'badge-3d';
    if (data.status === 'pending') {
        badge.classList.add('badge-pending');
        form.style.display = 'block'; // KEEP FORM VISIBLE
        pendingMsg.style.display = 'block';

        // Hide submit button to prevent 400 Conflict if clicked again
        const mainSubmit = document.getElementById('submitBtn');
        if (mainSubmit) mainSubmit.style.display = 'none';
        // Add a banner at the top of the form instead of hiding it
        pendingMsg.className = 'biz-card-3d';
        pendingMsg.style.marginBottom = '2rem';
        pendingMsg.style.background = 'rgba(79, 70, 229, 0.05)';
        pendingMsg.style.border = '1px solid var(--primary-3d)';
    } else if (data.status === 'approved') {
        badge.classList.add('badge-approved');
        form.style.display = 'block'; // KEEP FORM VISIBLE
        pendingMsg.innerHTML = `
            <i class="fas fa-check-circle" style="font-size: 4rem; color: #10b981; margin-bottom: 1rem;"></i>
            <h2>Verification Approved!</h2>
            <p>Your physical shop is verified. You now have full access to the dashboard.</p>
            <a href="vender_profile.html" class="btn-3d" style="display:inline-block; width: auto; text-decoration: none;">Go to Profile</a>
        `;
        pendingMsg.style.display = 'block';
        pendingMsg.className = 'biz-card-3d';
        pendingMsg.style.marginBottom = '2rem';
        pendingMsg.style.background = 'rgba(16, 185, 129, 0.05)';
        pendingMsg.style.border = '1px solid #10b981';

        // Hide submit button - already approved
        const mainSubmit = document.getElementById('submitBtn');
        if (mainSubmit) mainSubmit.style.display = 'none';
    } else if (data.status === 'rejected') {
        badge.classList.add('badge-rejected');
        form.style.display = 'block';
        pendingMsg.style.display = 'none';

        // Hide the main submit button, we use per-doc re-upload
        const mainSubmit = document.getElementById('submitBtn');
        if (mainSubmit) mainSubmit.style.display = 'none';

        if (data.rejection_reason) {
            showGranularRejections(data.rejection_reason);
        }
    } else if (data.status === 'not_submitted') {
        form.style.display = 'block';
        pendingMsg.style.display = 'none';
        const mainSubmit = document.getElementById('submitBtn');
        if (mainSubmit) mainSubmit.style.display = 'block';
    }

    // Populate existing files if any
    const fileFields = [
        'shop_front_photo', 'shop_board_photo', 'shop_video',
        'vendor_photo', 'brand_auth_certificate', 'service_certification',
        'business_proof'
    ];

    fileFields.forEach(field => {
        if (data[field]) {
            renderExistingBizPreview(field, data[field], data.status);
        }
    });

    if (data.google_maps_link) {
        const maps = document.getElementById('googleMapsLink');
        if (maps) {
            maps.value = data.google_maps_link;
            if (data.status === 'pending' || data.status === 'approved') {
                maps.disabled = true;
                maps.style.opacity = '0.7';
            }
        }
    }
}

/**
 * Render previews for documents already on server
 */
function renderExistingBizPreview(field, path, overallStatus) {
    const container = document.getElementById(`preview_${field}`);
    if (!container) return;

    container.innerHTML = '';
    container.style.display = 'block';

    // Hide the upload area for this field since a file exists
    const input = document.getElementsByName(field)[0];
    if (input) {
        const uploadArea = input.closest('.upload-3d-area');
        if (uploadArea) {
            uploadArea.style.display = 'none';
        }
    }

    const fullPath = `/static/images/${path}`;
    const isVideo = path.toLowerCase().match(/\.(mp4|webm|ogg|mov)$/);
    const isPdf = path.toLowerCase().endsWith('.pdf');

    let previewEl;
    if (isVideo) {
        previewEl = document.createElement('video');
        previewEl.src = fullPath;
        previewEl.controls = true;
    } else if (isPdf) {
        previewEl = document.createElement('div');
        previewEl.innerHTML = `<i class="fas fa-file-pdf" style="font-size: 3rem; color: #ef4444;"></i><p>View PDF</p>`;
        previewEl.className = 'pdf-preview';
        previewEl.onclick = () => window.open(fullPath, '_blank');
        previewEl.style.cursor = 'pointer';
    } else {
        previewEl = document.createElement('img');
        previewEl.src = fullPath;
        previewEl.onclick = () => window.open(fullPath, '_blank');
        previewEl.style.cursor = 'pointer';
    }

    container.appendChild(previewEl);

    // Create status badge for the card
    const card = container.closest('.biz-card-3d');
    if (card) {
        let badgeClass = 'badge-pending';
        let badgeText = 'Pending Review';

        if (overallStatus === 'approved') {
            badgeClass = 'badge-approved';
            badgeText = 'Approved';
        } else if (overallStatus === 'rejected') {
            // Default to pending if not explicitly rejected via granular rejections
            // This will be overridden by showGranularRejections
            badgeClass = 'badge-pending';
            badgeText = 'Uploaded';
        }

        const badge = document.createElement('label');
        badge.className = `badge-3d ${badgeClass} card-status-badge`;
        badge.style = "position: absolute; top: 1rem; right: 1rem; margin: 0;";
        badge.innerText = badgeText;
        card.appendChild(badge);
    }

    // If approved or pending, we might want to disable the upload area for this card
    if (overallStatus === 'approved' || overallStatus === 'pending') {
        const input = document.getElementsByName(field)[0];
        if (input) {
            input.disabled = true;
            if (card) {
                card.style.opacity = '0.9';
                const uploadArea = card.querySelector('.upload-3d-area');
                if (uploadArea) {
                    uploadArea.style.pointerEvents = 'none';
                    uploadArea.style.background = 'rgba(0,0,0,0.02)';
                }
            }
        }
    }
}

/**
 * Handle individual document re-uploads if rejected
 */
function showGranularRejections(reason) {
    const lines = reason.split('\n');
    const fieldMap = {
        'Shop Front Photo': 'shop_front_photo',
        'Shop Board Photo': 'shop_board_photo',
        'Shop Video': 'shop_video',
        'Vendor Photo': 'vendor_photo',
        'Brand Authorization Certificate': 'brand_auth_certificate',
        'Service Certification': 'service_certification',
        'Business Proof': 'business_proof'
    };

    lines.forEach(line => {
        const match = line.match(/^\[(.*?)]: (.*)$/);
        if (match) {
            const label = match[1];
            const msg = match[2];
            const field = fieldMap[label];
            if (!field) return;

            const input = document.getElementsByName(field)[0];
            if (!input) return;
            const card = input.closest('.biz-card-3d');
            if (!card) return;

            if (msg === 'REUPLOADED') {
                card.classList.add('reuploaded-card');
                const indicator = document.createElement('div');
                indicator.className = 'reupload-status-indicator';
                indicator.innerHTML = '<i class="fas fa-clock"></i> <span>Re-uploaded - Pending Review</span>';
                card.appendChild(indicator);
            } else {
                card.classList.add('rejected-card');

                // Add Rejection Box
                const rejBox = document.createElement('div');
                rejBox.className = 'rejection-box';
                rejBox.innerHTML = `<i class="fas fa-exclamation-circle"></i><div><p><strong>Rejected:</strong> ${msg}</p></div>`;
                card.appendChild(rejBox);

                // Add Re-upload Button
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'reupload-trigger-btn';
                btn.innerHTML = '<i class="fas fa-upload"></i> Re-upload Document';
                btn.onclick = () => handleFieldReupload(field, input);
                card.appendChild(btn);
            }
        }
    });

    // Disable all fields EXCEPT those that have a re-upload button
    document.querySelectorAll('.biz-card-3d:not(.rejected-card) input').forEach(inp => {
        inp.disabled = true;
        inp.style.opacity = '0.6';
    });

    // Disable Google Maps link too if not rejected
    if (!reason.includes('[Google Maps Location]')) {
        const maps = document.getElementById('googleMapsLink');
        if (maps) { maps.disabled = true; maps.style.opacity = '0.6'; }
    }
}

/**
 * Perform single-field re-upload
 */
async function handleFieldReupload(field, input) {
    // Create hidden file picker if needed or trigger existing
    input.onchange = async () => {
        const file = input.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('document_field', field);
        formData.append(field, file);

        try {
            showBizToast('Uploading re-submission...', 'info');
            const res = await fetch('/api/vendor/biz-verification/reupload-document', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (res.ok) {
                showBizToast('Re-uploaded successfully!', 'success');
                setTimeout(() => location.reload(), 1000);
            } else {
                showBizToast(data.error || 'Upload failed', 'error');
            }
        } catch (err) {
            console.error(err);
            showBizToast('Network error', 'error');
        }
    };
    input.click();
}

function showBizToast(msg, type = 'info') {
    const toast = document.getElementById('toast');
    const msgEl = document.getElementById('toastMsg');

    toast.style.display = 'block';
    toast.style.borderLeft = `5px solid ${type === 'success' ? '#10b981' : '#ef4444'}`;
    msgEl.innerText = msg;

    setTimeout(() => {
        toast.style.display = 'none';
    }, 4000);
}


// ================= VERIFICATION PAGE JS =================
// JavaScript used for handling vendor account verification
// Code originally from verification.js

/**
 * Vendor KYC Verification JavaScript
 * Handles form validation, file uploads, step navigation, and API integration
 */

// Global state
let currentStep = 1;
const totalSteps = 4;
let verificationStatus = 'not_submitted';
let formDisabled = false;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function () {
    initializeVerification();
    setupEventListeners();
    loadVerificationStatus();
});

/**
 * Initialize verification page
 */
function initializeVerification() {
    showStep(1);
    updateProgressSteps();
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
    // Navigation buttons
    document.getElementById('nextBtn').addEventListener('click', nextStep);
    document.getElementById('prevBtn').addEventListener('click', prevStep);
    document.getElementById('submitBtn').addEventListener('click', submitVerification);

    // Real-time validation
    document.getElementById('panNumber').addEventListener('input', validatePAN);
    document.getElementById('gstNumber').addEventListener('input', validateGST);
    document.getElementById('ifscCode').addEventListener('input', validateIFSC);
    document.getElementById('confirmAccount').addEventListener('input', validateAccountMatch);
    document.getElementById('govIdNumber').addEventListener('input', () => validateGovId());

    // File upload handlers
    setupFileUpload('govIdProof', 'government_id_proof');
    setupFileUpload('panCard', 'pan_card_image');
    setupFileUpload('businessCert', 'business_certificate');
    setupFileUpload('addressProof', 'business_address_proof');
    setupFileUpload('selfieId', 'selfie_with_id');
    setupFileUpload('cancelledCheque', 'cancelled_cheque');

    // Preview specific listeners
    const previewBtn = document.getElementById('previewBtn');
    if (previewBtn) previewBtn.addEventListener('click', openPreview);

    const closePreviewBtn = document.getElementById('closePreview');
    if (closePreviewBtn) closePreviewBtn.addEventListener('click', closePreview);

    const confirmSubmitBtn = document.getElementById('confirmSubmitBtn');
    if (confirmSubmitBtn) confirmSubmitBtn.addEventListener('click', (e) => {
        closePreview();
        submitVerification(e);
    });

    const closeViewerBtn = document.getElementById('closeViewer');
    if (closeViewerBtn) closeViewerBtn.addEventListener('click', closeViewer);

    // Close viewer on background click
    document.getElementById('docViewer').addEventListener('click', (e) => {
        if (e.target.id === 'docViewer') closeViewer();
    });
}

/**
 * Load verification status from API
 */
async function loadVerificationStatus() {
    try {
        const response = await fetch('/api/vendor/kyc/status', {
            method: 'GET',
            credentials: 'include'
        });

        if (response.ok) {
            const data = await response.json();
            verificationStatus = data.status || 'not_submitted';
            updateStatusBadge(data);

            // FIX: disableForm() FIRST — before re-upload cards are injected
            // so it cannot accidentally disable them.
            if (data.status === 'pending') {
                disableForm();
                showToast('Your verification is pending admin review', 'info');
            } else if (data.status === 'approved') {
                disableForm();
                showToast('Your KYC is approved! Redirecting to Business Verification...', 'success');
                setTimeout(() => {
                    window.location.href = 'verification_biz_verification_website_editor.html#store-verification-page';
                }, 2000);
            } else if (data.status === 'rejected') {
                showRejectionAlert(data.rejection_reason);
            }

            // THEN render re-upload cards AFTER form is disabled so these elements
            // are not touched by disableForm().
            if (data.rejected_documents && data.rejected_documents.length > 0) {
                showRejectedDocuments(data.rejected_documents);
            }
        }
    } catch (error) {
        console.error('Error loading verification status:', error);
    }
}

/**
 * Update status badge
 */
function updateStatusBadge(data) {
    const badge = document.getElementById('statusBadge');
    badge.className = 'verification-status-badge';

    switch (data.status) {
        case 'pending':
            badge.classList.add('status-pending');
            badge.innerHTML = '<span class="status-icon">🟡</span><span class="status-text">Pending Review</span>';
            break;
        case 'approved':
            badge.classList.add('status-approved');
            badge.innerHTML = '<span class="status-icon">🟢</span><span class="status-text">Approved</span>';
            break;
        case 'rejected':
            badge.classList.add('status-rejected');
            badge.innerHTML = '<span class="status-icon">🔴</span><span class="status-text">Rejected</span>';
            break;
        default:
            badge.classList.add('status-not-submitted');
            badge.innerHTML = '<span class="status-icon">⚪</span><span class="status-text">Not Submitted</span>';
    }
}

/**
 * Show rejection alert
 */
function showRejectionAlert(reason) {
    const alert = document.getElementById('rejectionAlert');
    const reasonText = document.getElementById('rejectionReason');
    reasonText.textContent = reason || 'Your documents did not meet verification requirements. Please review and resubmit.';
    alert.style.display = 'flex';
}

// ═══════════════════════════════════════════════════════════════════════════
// Per-Document Rejection Re-Upload
// ═══════════════════════════════════════════════════════════════════════════

const DOC_ICONS = {
    pan_card_image: 'fa-credit-card',
    government_id_proof: 'fa-id-card',
    business_certificate: 'fa-certificate',
    business_address_proof: 'fa-map-marker-alt',
    cancelled_cheque: 'fa-money-check-alt',
    selfie_with_id: 'fa-camera'
};

const DOC_COLORS = {
    pan_card_image: '#6366f1',
    government_id_proof: '#0ea5e9',
    business_certificate: '#f59e0b',
    business_address_proof: '#10b981',
    cancelled_cheque: '#8b5cf6',
    selfie_with_id: '#ec4899'
};

/**
 * Render a re-upload card for each rejected document.
 * Called AFTER disableForm() so the injected elements are never disabled.
 */
function showRejectedDocuments(rejectedDocs) {
    const section = document.getElementById('rejected-docs-section');
    const listEl = document.getElementById('rejected-docs-list');
    listEl.innerHTML = '';

    rejectedDocs.forEach((doc, idx) => {
        const icon = DOC_ICONS[doc.field] || 'fa-file-alt';
        const accent = DOC_COLORS[doc.field] || '#ef4444';
        const cardId = `rdoc-card-${doc.field}`;
        const inputId = `rdoc-input-${doc.field}`;
        const dropId = `rdoc-drop-${doc.field}`;
        const prevId = `rdoc-prev-${doc.field}`;
        const btnId = `rdoc-btn-${doc.field}`;

        const card = document.createElement('div');
        card.className = 'rdc';
        card.id = cardId;
        card.style.animationDelay = `${idx * 0.08}s`;
        card.innerHTML = `
          <div class="rdc-accent" style="background:${accent}"></div>
          <div class="rdc-body">

            <!-- Header -->
            <div class="rdc-head">
              <div class="rdc-icon-wrap" style="background:${accent}18;border-color:${accent}33">
                <i class="fas ${icon}" style="color:${accent}"></i>
              </div>
              <div class="rdc-meta">
                <span class="rdc-tag"><i class="fas fa-times-circle"></i> Rejected</span>
                <h3 class="rdc-title">${doc.label}</h3>
              </div>
            </div>

            <!-- Reason -->
            <div class="rdc-reason">
              <div class="rdc-reason-icon"><i class="fas fa-exclamation-triangle"></i></div>
              <div class="rdc-reason-text">
                <span class="rdc-reason-label">Rejection Reason</span>
                <p>${doc.reason}</p>
              </div>
            </div>

            <!-- Drop Zone -->
            <div class="rdc-drop" id="${dropId}" tabindex="0" role="button"
                 aria-label="Upload replacement for ${doc.label}">
              <input type="file" id="${inputId}" accept=".pdf,.jpg,.jpeg,.png">
              <div class="rdc-drop-inner" id="rdci-${doc.field}">
                <div class="rdc-drop-icon">
                  <i class="fas fa-cloud-upload-alt"></i>
                </div>
                <p class="rdc-drop-title">Drag &amp; drop or <span>browse file</span></p>
                <p class="rdc-drop-hint">PDF, JPG, PNG &nbsp;·&nbsp; Max 5 MB</p>
              </div>
              <div class="rdc-selected" id="rdcs-${doc.field}" style="display:none">
                <div class="rdc-sel-file">
                  <i class="fas fa-file-alt"></i>
                  <span class="rdc-sel-name"></span>
                </div>
                <button type="button" class="rdc-sel-remove" aria-label="Remove file">
                  <i class="fas fa-times"></i>
                </button>
              </div>
            </div>

            <!-- Action Button -->
            <button class="rdc-btn" id="${btnId}" style="--accent:${accent}" disabled>
              <span class="rdc-btn-icon"><i class="fas fa-upload"></i></span>
              <span class="rdc-btn-text">Re-upload Document</span>
            </button>

          </div>
        `;

        listEl.appendChild(card);
        _wireRDC(doc.field, inputId, dropId, prevId, btnId);
    });

    section.style.display = 'block';
}

/** Wire interactions for a single rejected-doc card */
function _wireRDC(field, inputId, dropId, prevId, btnId) {
    const inputEl = document.getElementById(inputId);
    const dropEl = document.getElementById(dropId);
    const innerEl = document.getElementById(`rdci-${field}`);
    const selEl = document.getElementById(`rdcs-${field}`);
    const btnEl = document.getElementById(btnId);

    if (!inputEl || !dropEl || !innerEl || !selEl || !btnEl) {
        console.error(`[RDC] Missing elements for field: ${field}`);
        return;
    }

    // ── Helpers ──────────────────────────────────────────────────────────────
    function showSelected(file) {
        selEl.querySelector('.rdc-sel-name').textContent = file.name;
        innerEl.style.display = 'none';
        selEl.style.display = 'flex';
        btnEl.disabled = false;
    }

    function resetDrop() {
        inputEl.value = '';
        innerEl.style.display = '';
        selEl.style.display = 'none';
        btnEl.disabled = true;
        dropEl.classList.remove('rdc-drop--drag');
    }

    function validateAndShow(file) {
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            showToast('File must be smaller than 5 MB', 'error'); return;
        }
        const ok = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        if (!ok.includes(file.type)) {
            showToast('Only PDF, JPG or PNG allowed', 'error'); return;
        }
        showSelected(file);
    }

    // ── Events ───────────────────────────────────────────────────────────────
    // Click drop zone → open picker (but not if clicking the remove button)
    dropEl.addEventListener('click', (e) => {
        if (e.target.closest('.rdc-sel-remove')) return;
        inputEl.click();
    });
    dropEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') inputEl.click(); });

    // File picker
    inputEl.addEventListener('change', () => validateAndShow(inputEl.files[0]));

    // Drag & drop
    dropEl.addEventListener('dragover', (e) => { e.preventDefault(); dropEl.classList.add('rdc-drop--drag'); });
    dropEl.addEventListener('dragleave', () => { dropEl.classList.remove('rdc-drop--drag'); });
    dropEl.addEventListener('drop', (e) => {
        e.preventDefault();
        dropEl.classList.remove('rdc-drop--drag');
        const dt = e.dataTransfer;
        if (dt && dt.files.length) validateAndShow(dt.files[0]);
    });

    // Remove selected file
    selEl.querySelector('.rdc-sel-remove').addEventListener('click', (e) => {
        e.stopPropagation();
        resetDrop();
    });

    // Re-upload
    btnEl.addEventListener('click', () => _submitRDC(field, inputEl, btnEl));
}

/** POST the single document to the backend */
async function _submitRDC(field, inputEl, btnEl) {
    if (!inputEl.files || !inputEl.files.length) {
        showToast('Please pick a file first', 'error'); return;
    }

    const origHTML = btnEl.innerHTML;
    btnEl.disabled = true;
    btnEl.innerHTML = '<span class="rdc-btn-icon"><i class="fas fa-spinner fa-spin"></i></span><span class="rdc-btn-text">Uploading…</span>';

    const fd = new FormData();
    fd.append('document_field', field);
    fd.append(field, inputEl.files[0]);

    try {
        const res = await fetch('/api/vendor/kyc/reupload-document', { method: 'POST', credentials: 'include', body: fd });
        const data = await res.json();

        if (res.ok) {
            showToast(data.message || 'Document re-uploaded! Admin will review shortly.', 'success');
            const card = document.getElementById(`rdoc-card-${field}`);
            if (card) {
                card.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
                card.style.opacity = '0';
                card.style.transform = 'scale(0.95) translateY(-8px)';
                setTimeout(() => {
                    card.remove();
                    if (!document.querySelector('.rdc')) {
                        document.getElementById('rejected-docs-section').style.display = 'none';
                    }
                }, 380);
            }
        } else {
            showToast(data.error || 'Upload failed — please try again.', 'error');
            btnEl.disabled = false;
            btnEl.innerHTML = origHTML;
        }
    } catch (err) {
        console.error('[RDC_SUBMIT]', err);
        showToast('Network error — please try again.', 'error');
        btnEl.disabled = false;
        btnEl.innerHTML = origHTML;
    }
}


/**
 * Enable form for resubmission
 */
function enableForm() {
    formDisabled = false;
    document.getElementById('rejectionAlert').style.display = 'none';
    const inputs = document.querySelectorAll('input, select, textarea, button');
    inputs.forEach(input => input.disabled = false);
    showToast('You can now edit and resubmit your documents', 'info');
}

/**
 * Disable form
 * Skips theme/mobile controls, website editor, and anything inside #rejected-docs-section
 */
function disableForm() {
    formDisabled = true;
    const rejectedSection = document.getElementById('rejected-docs-section');
    const editorPage = document.getElementById('website-editor-page');
    const inputs = document.querySelectorAll('input, select, textarea, button');
    inputs.forEach(el => {
        // Never disable theme/mobile controls, elements in the website editor, or re-upload section elements
        if (el.classList.contains('theme-btn') || el.classList.contains('mobile-menu-btn')) return;
        if (rejectedSection && rejectedSection.contains(el)) return;
        if (editorPage && editorPage.contains(el)) return;
        el.disabled = true;
    });
}

/**
 * Show specific step
 */
function showStep(step) {
    // Hide all steps
    document.querySelectorAll('.form-step').forEach(s => s.classList.remove('active'));

    // Show current step
    document.querySelector(`.form-step[data-step="${step}"]`).classList.add('active');

    // Update buttons
    document.getElementById('prevBtn').style.display = step === 1 ? 'none' : 'inline-flex';
    document.getElementById('nextBtn').style.display = step === totalSteps ? 'none' : 'inline-flex';
    document.getElementById('submitBtn').style.display = step === totalSteps ? 'inline-flex' : 'none';

    const previewBtn = document.getElementById('previewBtn');
    if (previewBtn) {
        previewBtn.style.display = step === totalSteps ? 'inline-flex' : 'none';
    }

    currentStep = step;
    updateProgressSteps();
}

/**
 * Update progress steps UI
 */
function updateProgressSteps() {
    document.querySelectorAll('.step').forEach((step, index) => {
        const stepNum = index + 1;
        step.classList.remove('active', 'completed');

        if (stepNum < currentStep) {
            step.classList.add('completed');
        } else if (stepNum === currentStep) {
            step.classList.add('active');
        }
    });
}

/**
 * Next step
 */
function nextStep() {
    if (validateCurrentStep()) {
        if (currentStep < totalSteps) {
            showStep(currentStep + 1);
        }
    }
}

/**
 * Previous step
 */
function prevStep() {
    if (currentStep > 1) {
        showStep(currentStep - 1);
    }
}

/**
 * Validate current step
 */
function validateCurrentStep() {
    const currentStepElement = document.querySelector(`.form-step[data-step="${currentStep}"]`);
    const requiredFields = currentStepElement.querySelectorAll('[required]');

    for (let field of requiredFields) {
        if (!field.value && field.type !== 'file') {
            showToast(`Please fill in all required fields`, 'error');
            field.focus();
            return false;
        }

        // Check file uploads
        if (field.type === 'file' && field.hasAttribute('required')) {
            if (!field.files || field.files.length === 0) {
                showToast(`Please upload ${field.name.replace(/_/g, ' ')}`, 'error');
                return false;
            }
        }
    }

    // Step-specific validation
    if (currentStep === 1) {
        if (!validatePAN(true)) return false;
        if (!validateIFSC(true)) return false;
        if (!validateGovId(true)) return false;
        const gstInput = document.getElementById('gstNumber');
        if (gstInput.value && !validateGST(true)) return false;
    }

    if (currentStep === 3) {
        if (!validateAccountMatch(true)) return false;
    }

    return true;
}

/**
 * Validate PAN number
 */
function validatePAN(silent = false) {
    const input = document.getElementById('panNumber');
    const hint = document.getElementById('panHint');
    const value = input.value.toUpperCase();
    const pattern = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

    input.value = value;

    if (!value) {
        hint.textContent = 'Format: ABCDE1234F';
        hint.className = 'field-hint validation-hint';
        return true;
    }

    if (pattern.test(value)) {
        hint.textContent = '✓ Valid PAN format';
        hint.className = 'field-hint validation-hint valid';
        return true;
    } else {
        hint.textContent = '✗ Invalid PAN format (e.g., ABCDE1234F)';
        hint.className = 'field-hint validation-hint invalid';
        if (!silent) showToast('Invalid PAN format', 'error');
        return false;
    }
}

/**
 * Validate GST number
 */
function validateGST(silent = false) {
    const input = document.getElementById('gstNumber');
    const hint = document.getElementById('gstHint');
    const value = input.value.toUpperCase();
    const pattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

    input.value = value;

    if (!value) {
        hint.textContent = 'Format: 22ABCDE1234F1Z5';
        hint.className = 'field-hint validation-hint';
        return true;
    }

    if (pattern.test(value)) {
        hint.textContent = '✓ Valid GST format';
        hint.className = 'field-hint validation-hint valid';
        return true;
    } else {
        hint.textContent = '✗ Invalid GST format (e.g., 22ABCDE1234F1Z5)';
        hint.className = 'field-hint validation-hint invalid';
        if (!silent) showToast('Invalid GST format', 'error');
        return false;
    }
}

/**
 * Validate IFSC code and fetch bank details
 */
async function validateIFSC(silent = false) {
    const input = document.getElementById('ifscCode');
    const hint = document.getElementById('ifscHint');
    const bankInput = document.getElementById('bankName');
    const loading = document.getElementById('ifscLoading');
    const value = input.value.toUpperCase();
    const pattern = /^[A-Z]{4}0[A-Z0-9]{6}$/;

    input.value = value;

    if (!value) {
        hint.textContent = 'Format: ABCD0123456';
        hint.className = 'field-hint validation-hint';
        bankInput.value = '';
        return true;
    }

    if (pattern.test(value)) {
        hint.textContent = '✓ IFSC format valid. Fetching bank...';
        hint.className = 'field-hint validation-hint valid';

        // Fetch bank info
        try {
            if (loading) loading.style.display = 'block';
            const res = await fetch(`/api/vendor/bank/ifsc/${value}`);
            if (res.ok) {
                const data = await res.json();
                bankInput.value = data.bank;
                hint.textContent = `✓ Bank: ${data.bank} (${data.branch})`;
                if (loading) loading.style.display = 'none';
                return true;
            } else {
                bankInput.value = '';
                hint.textContent = '✗ Bank not found for this IFSC';
                hint.className = 'field-hint validation-hint invalid';
                if (loading) loading.style.display = 'none';
                return false;
            }
        } catch (err) {
            console.error('IFSC Lookup Error:', err);
            if (loading) loading.style.display = 'none';
            return false;
        }
    } else {
        hint.textContent = '✗ Invalid IFSC format (e.g., ABCD0123456)';
        hint.className = 'field-hint validation-hint invalid';
        bankInput.value = '';
        if (!silent) {
            showToast('Invalid IFSC code format', 'error');
        }
        return false;
    }
}

/**
 * Validate account number match
 */
function validateAccountMatch(silent = false) {
    const account = document.getElementById('accountNumber').value;
    const confirm = document.getElementById('confirmAccount').value;
    const hint = document.getElementById('accountMatchHint');

    if (!confirm) {
        hint.textContent = '';
        hint.className = 'field-hint validation-hint';
        return true;
    }

    if (account === confirm) {
        hint.textContent = '✓ Account numbers match';
        hint.className = 'field-hint validation-hint valid';
        return true;
    } else {
        hint.textContent = '✗ Account numbers do not match';
        hint.className = 'field-hint validation-hint invalid';
        if (!silent) showToast('Account numbers do not match', 'error');
        return false;
    }
}

/**
 * Validate Government ID Number
 * Supports Aadhaar, Passport, and Driving License
 */
function validateGovId(silent = false) {
    const input = document.getElementById('govIdNumber');
    const hint = document.getElementById('govIdHint');
    const value = input.value.trim();

    if (!value) {
        hint.textContent = 'Enter Aadhaar, Passport, or DL';
        hint.className = 'field-hint validation-hint';
        return true;
    }

    // Regex patterns
    const aadhaarRegex = /^[0-9]{4}\s?[0-9]{4}\s?[0-9]{4}$/;
    const passportRegex = /^[A-Z][0-9]{7}$/;
    const dlRegex = /^[A-Z]{2}-?[0-9]{2}-?[0-9]{4}[0-9]{7}$/;

    if (aadhaarRegex.test(value) || passportRegex.test(value) || dlRegex.test(value)) {
        hint.textContent = '✓ Valid ID format';
        hint.className = 'field-hint validation-hint valid';
        return true;
    } else {
        hint.textContent = '✗ Invalid ID format';
        hint.className = 'field-hint validation-hint invalid';
        if (!silent) showToast('Enter a valid Aadhaar, Passport, or Driving License number.', 'error');
        return false;
    }
}

/**
 * Setup file upload for a field
 */
function setupFileUpload(inputId, fieldName) {
    const input = document.getElementById(inputId);
    const uploadArea = document.querySelector(`.upload-area[data-field="${fieldName}"]`);
    const placeholder = uploadArea.querySelector('.upload-placeholder');
    const preview = uploadArea.querySelector('.upload-preview');
    const removeBtn = preview.querySelector('.remove-file');

    // Click to upload
    placeholder.addEventListener('click', () => input.click());

    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#3b82f6';
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.style.borderColor = '';
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '';

        if (e.dataTransfer.files.length > 0) {
            input.files = e.dataTransfer.files;
            handleFileSelect(input, placeholder, preview);
        }
    });

    // File input change
    input.addEventListener('change', () => {
        handleFileSelect(input, placeholder, preview);
    });

    // Remove file
    removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        input.value = '';
        placeholder.style.display = 'block';
        preview.style.display = 'none';
    });
}

/**
 * Handle file selection
 */
function handleFileSelect(input, placeholder, preview) {
    const file = input.files[0];

    if (!file) return;

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
        showToast('File size must be less than 5MB', 'error');
        input.value = '';
        return;
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
        showToast('Only PDF, JPG, and PNG files are allowed', 'error');
        input.value = '';
        return;
    }

    // Show preview
    const fileName = preview.querySelector('.file-name');
    fileName.textContent = file.name;
    placeholder.style.display = 'none';
    preview.style.display = 'flex';
}

/**
 * Submit verification form
 */
async function submitVerification(e) {
    e.preventDefault();

    if (formDisabled) {
        showToast('Form is disabled', 'error');
        return;
    }

    // Validate declaration checkbox
    const declaration = document.getElementById('declaration');
    if (!declaration.checked) {
        showToast('Please accept the declaration', 'error');
        return;
    }

    // Validate all steps
    for (let step = 1; step <= totalSteps; step++) {
        currentStep = step;
        if (!validateCurrentStep()) {
            showStep(step);
            return;
        }
    }

    // Prepare form data
    const formData = new FormData(document.getElementById('kycForm'));

    // Show loading
    const submitBtn = document.getElementById('submitBtn');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
    submitBtn.disabled = true;

    try {
        const response = await fetch('/api/vendor/kyc/submit', {
            method: 'POST',
            credentials: 'include',
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            // Hide form, show success message
            document.getElementById('kycForm').style.display = 'none';
            document.querySelector('.progress-steps').style.display = 'none';
            document.querySelector('.form-navigation').style.display = 'none';
            document.getElementById('successMessage').style.display = 'block';

            // Update status badge
            updateStatusBadge({ status: 'pending' });

            showToast('Verification submitted successfully!', 'success');
        } else {
            showToast(data.error || 'Failed to submit verification', 'error');
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    } catch (error) {
        console.error('Error submitting verification:', error);
        showToast('An error occurred. Please try again.', 'error');
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const icon = toast.querySelector('.toast-icon i');
    const messageEl = toast.querySelector('.toast-message');

    // Set icon based on type
    toast.className = `toast ${type}`;
    switch (type) {
        case 'success':
            icon.className = 'fas fa-check-circle';
            break;
        case 'error':
            icon.className = 'fas fa-exclamation-circle';
            break;
        default:
            icon.className = 'fas fa-info-circle';
    }

    messageEl.textContent = message;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

/**
 * Open Preview Modal
 */
function openPreview() {
    if (!validateCurrentStep()) return;

    const bizGrid = document.getElementById('previewBusinessData');
    const docGrid = document.getElementById('previewDocsData');
    const bankGrid = document.getElementById('previewBankData');

    // 1. Fill Business Data
    const bizFields = [
        { label: 'Business Name', id: 'businessName' },
        { label: 'Full Owner Name', id: 'fullName' },
        { label: 'PAN Number', id: 'panNumber' },
        { label: 'GST Number', id: 'gstNumber' },
        { label: 'ID Type', id: 'govIdType' },
        { label: 'ID Number', id: 'govIdNumber' },
        { label: 'Registration Type', id: 'businessRegType' },
        { label: 'Business Address', id: 'businessAddress' }
    ];

    bizGrid.innerHTML = bizFields.map(field => {
        const el = document.getElementById(field.id);
        const val = el ? (el.tagName === 'SELECT' ? el.options[el.selectedIndex].text : el.value) : '—';
        return `
            <div class="preview-item">
                <span class="preview-label">${field.label}</span>
                <span class="preview-value">${val || '—'}</span>
            </div>
        `;
    }).join('');

    // 2. Fill Bank Data
    const bankFields = [
        { label: 'Account Holder', id: 'accountHolder' },
        { label: 'Bank Name', id: 'bankName' },
        { label: 'Account Number', id: 'accountNumber' },
        { label: 'IFSC Code', id: 'ifscCode' }
    ];

    bankGrid.innerHTML = bankFields.map(field => {
        const el = document.getElementById(field.id);
        return `
            <div class="preview-item">
                <span class="preview-label">${field.label}</span>
                <span class="preview-value">${el ? el.value : '—'}</span>
            </div>
        `;
    }).join('');

    // 3. Fill Document Data
    const docFields = [
        { label: 'Government ID', id: 'govIdProof' },
        { label: 'PAN Card', id: 'panCard' },
        { label: 'Business Certificate', id: 'businessCert' },
        { label: 'Address Proof', id: 'addressProof' },
        { label: 'Selfie with ID', id: 'selfieId' },
        { label: 'Cancelled Cheque', id: 'cancelledCheque' }
    ];

    docGrid.innerHTML = '';
    docFields.forEach(doc => {
        const input = document.getElementById(doc.id);
        if (input && input.files && input.files[0]) {
            const file = input.files[0];
            const isImage = file.type.startsWith('image/');
            const card = document.createElement('div');
            card.className = 'preview-doc-card';

            let thumbHTML = '';
            if (isImage) {
                const url = URL.createObjectURL(file);
                thumbHTML = `<div class="preview-doc-thumb" onclick="openViewer('${url}')"><img src="${url}" alt="${doc.label}"></div>`;
            } else {
                thumbHTML = `<div class="preview-doc-thumb"><i class="fas fa-file-pdf"></i></div>`;
            }

            card.innerHTML = `
                ${thumbHTML}
                <div class="preview-file-info">
                    <span class="preview-label">${doc.label}</span>
                    <span class="preview-file-name" title="${file.name}">${file.name}</span>
                    <span class="preview-file-type">${(file.size / 1024 / 1024).toFixed(2)} MB · ${file.type.split('/')[1].toUpperCase()}</span>
                </div>
            `;
            docGrid.appendChild(card);
        }
    });

    document.getElementById('previewModal').classList.add('active');
}

/**
 * Close Preview Modal
 */
function closePreview() {
    document.getElementById('previewModal').classList.remove('active');
}

/**
 * Document Viewer Logic
 */
function openViewer(src) {
    const viewer = document.getElementById('docViewer');
    const img = document.getElementById('viewerImg');
    img.src = src;
    viewer.classList.add('active');
}

function closeViewer() {
    document.getElementById('docViewer').classList.remove('active');
}
