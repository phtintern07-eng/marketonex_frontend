// 🛡️ DOUBLE-SUBMISSION GUARD
// Prevents duplicate API calls when this script is accidentally loaded twice
// (e.g., two <script> tags on the same page) or user clicks submit rapidly.
let _vendorLoginInProgress = false;

document.addEventListener('DOMContentLoaded', () => {
    // Guard: if another DOMContentLoaded already set up the listener, skip.
    if (window._vendorLoginListenerAttached) {
        console.warn('[VENDOR LOGIN] Listener already attached, skipping duplicate.');
        return;
    }
    window._vendorLoginListenerAttached = true;
    console.log("[VENDOR LOGIN] Script loaded — v2026-04-01");

    const loginForm = document.getElementById('loginForm');

    if (!loginForm) {
        console.error("[VENDOR LOGIN] Login form not found!");
        return;
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // 🔒 Block duplicate submissions
        if (_vendorLoginInProgress) {
            console.warn('[VENDOR LOGIN] Submission already in progress, ignoring duplicate.');
            return;
        }
        _vendorLoginInProgress = true;

        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        const submitBtn = loginForm.querySelector('button[type="submit"]');

        // ✅ Validation
        if (!emailInput.value.trim() || !passwordInput.value.trim()) {
            alert('Please enter both email and password');
            _vendorLoginInProgress = false;
            return;
        }

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        // ✅ Disable button IMMEDIATELY (before await) to block rapid clicks
        const originalBtnText = submitBtn.textContent;
        submitBtn.textContent = 'Signing In...';
        submitBtn.disabled = true;

        try {
            // ✅ VENDOR-SPECIFIC LOGIN ENDPOINT (fixes session persistence bug)
            // DO NOT use /login — that is the customer login and will not persist
            // the vendor session correctly. Always use /api/auth/vendor-login.
            const response = await fetch('/api/auth/vendor-login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',   // 🔥 CRITICAL: sends & receives session cookie
                body: JSON.stringify({ email, password })
            });

            // ✅ Safe JSON parsing
            let data;
            try {
                data = await response.json();
            } catch (err) {
                throw new Error('Invalid server response — could not parse JSON.');
            }

            console.log('[VENDOR LOGIN] Response status:', response.status);
            console.log('[VENDOR LOGIN] Response data:', data);

            // ❌ If login failed
            if (!response.ok || !data.success) {
                // Handle specific error codes from backend
                if (data.error === 'not_a_vendor') {
                    throw new Error(data.message || 'This portal is for Vendors only.');
                }
                if (data.error === 'email_not_verified') {
                    throw new Error(data.message || 'Please verify your email first.');
                }
                throw new Error(data.message || data.error || 'Login failed. Please check your credentials.');
            }

            // ✅ Save session hints in localStorage (UI convenience only — NOT security)
            if (data.user) {
                localStorage.setItem('vendorLoggedIn', 'true');
                localStorage.setItem('vendorEmail', data.user.email || email);
                sessionStorage.setItem('canAddProduct', 'true');
            }

            // ✅ Check if redirected from another page (e.g. user was bounced to login)
            const returnUrl = sessionStorage.getItem('returnAfterLogin');
            if (returnUrl) {
                sessionStorage.removeItem('returnAfterLogin');
                console.log('[VENDOR LOGIN] Redirecting to saved returnUrl:', returnUrl);
                window.location.href = returnUrl;
                return;
            }

            // 🔥 MAIN REDIRECT — backend sends 'redirect' key (NOT 'redirect_url')
            const redirectTarget = data.redirect || '/vendor/vender_profile_products_add-product.html';
            console.log('[VENDOR LOGIN] Redirecting to:', redirectTarget);
            window.location.href = redirectTarget;

        } catch (error) {
            console.error('[VENDOR LOGIN] Error:', error);
            alert(error.message || 'Something went wrong. Please try again.');

            // ❌ Reset button and allow retry
            submitBtn.textContent = originalBtnText;
            submitBtn.disabled = false;
            _vendorLoginInProgress = false;
        }
    });
});


// 🔐 PASSWORD TOGGLE (UNCHANGED)
document.querySelectorAll('.toggle-password').forEach(icon => {
    icon.addEventListener('click', function () {
        const input = this.previousElementSibling;

        if (input.type === 'password') {
            input.type = 'text';
            this.classList.remove('fa-eye');
            this.classList.add('fa-eye-slash');
        } else {
            input.type = 'password';
            this.classList.remove('fa-eye-slash');
            this.classList.add('fa-eye');
        }
    });
});