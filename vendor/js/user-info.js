/**
 * user-info.js — Profile page logic for user-info.html (3D redesign)
 * Uses /api/profile (GET/PUT) — no backend changes required.
 */

/* ── Toast helper ─────────────────────────────────────────────── */
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'error' : ''}`;
    toast.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 420);
    }, 3200);
}

/* ── Populate field helper ────────────────────────────────────── */
function setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val || '';
}

/* ── Badge helper ─────────────────────────────────────────────── */
function setBadge(id, status) {
    const el = document.getElementById(id);
    if (!el) return;

    const map = {
        approved: { cls: 'approved', icon: 'fa-check-circle', label: 'Approved' },
        pending: { cls: 'pending', icon: 'fa-clock', label: 'Pending' },
        rejected: { cls: 'rejected', icon: 'fa-times-circle', label: 'Rejected' },
        not_submitted: { cls: 'not_submitted', icon: 'fa-minus-circle', label: 'Not Submitted' },
        resubmitted: { cls: 'pending', icon: 'fa-clock', label: 'Resubmitted' },
    };

    const s = (status || 'not_submitted').toLowerCase();
    const cfg = map[s] || map['not_submitted'];

    el.className = `badge ${cfg.cls}`;
    el.innerHTML = `<i class="fas ${cfg.icon}"></i> ${cfg.label}`;
}

/* ── Load user profile ───────────────────────────────────────── */
async function loadUserProfile() {
    try {
        const res = await fetch('/api/profile', { credentials: 'include' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        const user = data.vendor || data.customer || data;

        // Avatar / top-bar
        const profileImg = document.getElementById('userInfoProfileImg');
        const topbarImg = document.getElementById('topbarAvatar');
        const pic = user.profile_picture || user.photo_url || '';
        if (pic) {
            if (profileImg) profileImg.src = pic;
            if (topbarImg) topbarImg.src = pic;
        }

        // Avatar meta text
        const avatarName = document.getElementById('avatarName');
        const avatarEmail = document.getElementById('avatarEmail');
        if (avatarName) avatarName.textContent = user.fullname || user.name || '—';
        if (avatarEmail) avatarEmail.textContent = user.email || '—';

        // Form fields
        setVal('u-name', user.fullname || user.name || '');
        setVal('u-email', user.email || '');
        setVal('u-dob', user.date_of_birth || user.dob || '');
        setVal('u-phone', user.phone || user.phone_number || '');
        setVal('u-address', user.address || '');
        setVal('u-city', user.city || '');
        setVal('u-state', user.state || '');

        // Gender select
        const genderEl = document.getElementById('u-gender');
        if (genderEl && user.gender) genderEl.value = user.gender;

        // Business details
        const bizName = document.getElementById('businessNameDisplay');
        if (bizName) bizName.textContent = user.business_name || user.biz_name || '—';

        setBadge('kycBadge', user.kyc_status);
        setBadge('verificationBadge', user.biz_verification_status);

        // Account badge
        const accountBadge = document.getElementById('accountBadge');
        if (accountBadge) {
            const isActive =
                user.kyc_status === 'approved' &&
                user.biz_verification_status === 'approved';
            accountBadge.className = `badge ${isActive ? 'approved' : 'pending'}`;
            accountBadge.innerHTML = isActive
                ? '<i class="fas fa-check-circle"></i> Active'
                : '<i class="fas fa-lock"></i> Limited';
        }

    } catch (err) {
        console.warn('[UserInfo] Profile load failed:', err.message);
    }
}

/* ── Save profile ────────────────────────────────────────────── */
async function saveUserProfile() {
    const btn = document.getElementById('saveUserProfileBtn');

    const fullname = (document.getElementById('u-name')?.value || '').trim();
    const email = (document.getElementById('u-email')?.value || '').trim();
    const dob = (document.getElementById('u-dob')?.value || '').trim();
    const phone = (document.getElementById('u-phone')?.value || '').trim();
    const address = (document.getElementById('u-address')?.value || '').trim();
    const city = (document.getElementById('u-city')?.value || '').trim();
    const state = (document.getElementById('u-state')?.value || '').trim();
    const gender = (document.getElementById('u-gender')?.value || '').trim();

    if (!fullname) { showToast('Full name is required.', 'error'); return; }

    // Button feedback
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…';

    try {
        const payload = {
            name: fullname, phone: phone || null, address: address || null,
            city: city || null, state: state || null, dob: dob || null,
            gender: gender || null
        };

        const res = await fetch('/api/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `HTTP ${res.status}`);
        }

        // Update avatar name live
        const avatarName = document.getElementById('avatarName');
        if (avatarName) avatarName.textContent = fullname;

        btn.innerHTML = '<i class="fas fa-check"></i> Saved!';
        showToast('Profile updated successfully!', 'success');
        setTimeout(() => { btn.innerHTML = originalHTML; btn.disabled = false; }, 2500);

    } catch (err) {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
        showToast(`Failed to save: ${err.message}`, 'error');
        console.error('[UserInfo] Save error:', err);
    }
}

/* ── Profile photo change ────────────────────────────────────── */
function initPhotoUpload() {
    const wrapper = document.getElementById('profileImgContainer');
    const input = document.getElementById('profilePhotoInput');
    const img = document.getElementById('userInfoProfileImg');
    const topbar = document.getElementById('topbarAvatar');

    if (!wrapper || !input || !img) return;

    wrapper.addEventListener('click', () => input.click());

    input.addEventListener('change', async () => {
        const file = input.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            showToast('Photo must be under 5 MB.', 'error'); return;
        }

        // 1. Instant local preview for responsiveness
        const reader = new FileReader();
        reader.onload = (e) => {
            img.src = e.target.result;
            if (topbar) topbar.src = e.target.result;
        };
        reader.readAsDataURL(file);

        // 2. Upload to backend for persistence
        try {
            showToast('Uploading photo…', 'success');
            const formData = new FormData();
            formData.append('photo', file);

            const res = await fetch('/api/profile/upload-photo', {
                method: 'POST',
                credentials: 'include',
                body: formData
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Upload failed');

            // Use the server URL (cache-busted) as the authoritative source
            const url = result.profile_picture + '?t=' + Date.now();
            img.src = url;
            if (topbar) topbar.src = url;
            // Also update any other avatar images on the page
            document.querySelectorAll('.user-avatar img, #topbarAvatar').forEach(el => el.src = url);

            showToast('Profile photo saved!', 'success');
            console.log('[UserInfo] Photo uploaded:', result.profile_picture);
        } catch (err) {
            showToast('Photo upload failed: ' + err.message, 'error');
            console.error('[UserInfo] Photo upload error:', err);
        }
    });

    // NOTE: Do NOT restore from localStorage — always use the DB value loaded in loadUserProfile()
}

/* ── Init ────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    loadUserProfile();
    initPhotoUpload();

    // Save button
    const saveBtn = document.getElementById('saveUserProfileBtn');
    if (saveBtn) saveBtn.addEventListener('click', saveUserProfile);

    // Business Details redirect
    const bizBtn = document.getElementById('businessDetailsBtn');
    if (bizBtn) bizBtn.addEventListener('click', () => {
        window.location.href = 'vender_profile.html';
    });

    // Quick link hover effect (inline-styled links)
    document.querySelectorAll('.ui-page a[style]').forEach(link => {
        link.addEventListener('mouseenter', () => {
            link.style.background = 'rgba(6,182,212,0.08)';
            link.style.borderColor = 'var(--accent-blue,#06B6D4)';
            link.style.transform = 'translateX(4px)';
        });
        link.addEventListener('mouseleave', () => {
            link.style.background = 'rgba(139,146,176,0.06)';
            link.style.borderColor = 'var(--border-color,#262626)';
            link.style.transform = 'translateX(0)';
        });
    });
});
