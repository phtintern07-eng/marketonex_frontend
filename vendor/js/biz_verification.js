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
