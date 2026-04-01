// 🛡️ PREVENT SCRIPT DOUBLE LOAD
if (window._vendorLoginScriptLoaded) {
    console.warn("Login script already loaded");
} else {
    window._vendorLoginScriptLoaded = true;
}

let _vendorLoginInProgress = false;

document.addEventListener('DOMContentLoaded', () => {

    // 🔁 Prevent duplicate event binding
    if (window._vendorLoginListenerAttached) {
        console.warn('[VENDOR LOGIN] Listener already attached, skipping duplicate.');
        return;
    }
    window._vendorLoginListenerAttached = true;

    const loginForm = document.getElementById('loginForm');

    if (!loginForm) {
        console.error("[VENDOR LOGIN] Login form not found!");
        return;
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // 🚫 Prevent multiple submissions
        if (_vendorLoginInProgress) {
            console.warn('[VENDOR LOGIN] Submission already in progress');
            return;
        }

        _vendorLoginInProgress = true;

        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        const submitBtn = loginForm.querySelector('button[type="submit"]');

        // ✅ Basic validation
        if (!emailInput.value.trim() || !passwordInput.value.trim()) {
            alert('Please enter both email and password');
            _vendorLoginInProgress = false;
            return;
        }

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        const originalBtnText = submitBtn.textContent;
        submitBtn.textContent = 'Signing In...';
        submitBtn.disabled = true;

        try {
            // 🌐 API Call (FIXED)
            const response = await fetch(`${window.API_BASE_URL}/auth/vendor-login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ email, password })
            });

            // ✅ Safe JSON parsing
            const text = await response.text();
            const data = text ? JSON.parse(text) : {};

            console.log('[LOGIN RESPONSE]', data);

            // ❌ Handle errors
            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Login failed');
            }

            // ✅ Store login state
            localStorage.setItem('vendorLoggedIn', 'true');

            // Optional (helpful for other pages)
            if (data.user && data.user.email) {
                localStorage.setItem('vendorEmail', data.user.email);
            }

            if (data.user && (data.user.id || data.user.user_id)) {
                localStorage.setItem('vendorId', data.user.id || data.user.user_id);
            }

            _vendorLoginInProgress = false;

            // 🔁 Redirect (FIXED PATH)
            const redirectTarget = data.redirect || 'vender_profile_products_add-product.html';

            setTimeout(() => {
                window.location.href = redirectTarget;
            }, 100);

        } catch (error) {
            console.error('[LOGIN ERROR]', error);

            alert(error.message || 'Login failed. Please try again.');

            // 🔄 Restore button
            submitBtn.textContent = originalBtnText;
            submitBtn.disabled = false;

            _vendorLoginInProgress = false;
        }
    });
});