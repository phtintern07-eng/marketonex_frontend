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
