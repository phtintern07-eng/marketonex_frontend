// 🛡️ PREVENT SCRIPT DOUBLE LOAD
if (window._vendorLoginScriptLoaded) {
    console.warn("Login script already loaded");
} else {
    window._vendorLoginScriptLoaded = true;
}

let _vendorLoginInProgress = false;

// ✅ FIXED: Direct API URL (NO CONFUSION)
const API_URL = "https://marketonex.in/backend/passenger_wsgi.py";

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

        // ✅ Validation
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
            // 🌐 ✅ FIXED API CALL
            const response = await fetch(`${API_URL}/auth/vendor-login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ email, password })
            });

            // 🔍 SAFE RESPONSE HANDLING
            const text = await response.text();

            let data;
            try {
                data = text ? JSON.parse(text) : {};
            } catch (err) {
                console.error('[LOGIN ERROR] Invalid JSON:', text);
                throw new Error("Server returned invalid response (not JSON)");
            }

            console.log('[LOGIN RESPONSE]', data);

            // ❌ Handle backend errors
            if (!response.ok || !data.success) {
                throw new Error(data.message || data.error || 'Login failed');
            }

            // ✅ Save login state
            localStorage.setItem('vendorLoggedIn', 'true');

            if (data.user?.email) {
                localStorage.setItem('vendorEmail', data.user.email);
            }

            if (data.user?.id || data.user?.user_id) {
                localStorage.setItem('vendorId', data.user.id || data.user.user_id);
            }

            // 🔁 Redirect
            const redirectTarget = data.redirect || '/vendor/vendor_profile_products_add-product.html';

            setTimeout(() => {
                window.location.href = redirectTarget;
            }, 100);

        } catch (error) {
            console.error('[LOGIN ERROR]', error);

            alert(error.message || 'Login failed. Please try again.');

            // 🔄 Restore button
            submitBtn.textContent = originalBtnText;
            submitBtn.disabled = false;
        }

        _vendorLoginInProgress = false;
    });
});