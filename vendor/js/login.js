document.addEventListener('DOMContentLoaded', () => {
    console.log("LOGIN FIX VERSION 1.1.0 LOADED");
    const loginForm = document.getElementById('loginForm');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const emailInput = document.getElementById('email');
            const passwordInput = document.getElementById('password');
            const submitBtn = loginForm.querySelector('button[type="submit"]');

            // Basic Validation
            if (!emailInput.value || !passwordInput.value) {
                alert('Please enter both email and password');
                return;
            }

            const email = emailInput.value.trim();
            const password = passwordInput.value;

            // UI Feedback
            const originalBtnText = submitBtn.textContent;
            submitBtn.textContent = 'Signing In...';
            submitBtn.disabled = true;

            try {
                // Perform login request with safe text-first parsing to avoid "Unexpected end of JSON input"
                const rawResponse = await fetch('/api/auth/vendor-login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ email, password })
                });

                const text = await rawResponse.text();
                let data = {};
                try {
                    if (text) data = JSON.parse(text);
                } catch (parseErr) {
                    console.error('[Login] JSON parse failed. Raw response:', text);
                    throw new Error('Server returned an invalid response. Please try again.');
                }

                if (!rawResponse.ok) {
                    const errCode = data.error || data.code || '';
                    let message;
                    if (errCode === 'not_a_vendor') {
                        message = 'This login portal is for Vendors only.';
                    } else if (errCode === 'email_not_verified') {
                        alert('Please verify your email address before logging in.');
                        window.location.href = 'signup.html';
                        return;
                    } else {
                        message = data.message || data.error || 'Login failed. Please check your credentials.';
                    }
                    throw Object.assign(new Error(message), { responseData: data, status: rawResponse.status });
                }

                // Backend returns flat JSON: { success, message, user, redirect }
                const user = data.user;
                const redirect = data.redirect;

                console.log('[Login] Vendor login successful:', user);

                // Update Local Storage
                if (user) {
                    localStorage.setItem('vendorLoggedIn', 'true');
                    localStorage.setItem('vendorEmail', user.email || email);
                    sessionStorage.setItem('canAddProduct', 'true');
                }

                // Check for a stored return URL
                const returnUrl = sessionStorage.getItem('returnAfterLogin');
                if (returnUrl) {
                    sessionStorage.removeItem('returnAfterLogin');
                    window.location.href = returnUrl;
                    return;
                }

                // Use backend-provided redirect
                if (redirect) {
                    console.log('[Login] Redirecting to:', redirect);
                    window.location.href = redirect;
                    return;
                }

                // Fallback: vendor website (backend always provides redirect, this is a safety net)
                window.location.href = '/vendor-site/';

            } catch (error) {
                console.error('[Login] Login failed:', error);

                let message = error.message || 'A network error occurred. Please try again.';
                alert(message);

                // Reset UI
                submitBtn.textContent = originalBtnText;
                submitBtn.disabled = false;
            }
        });
    }
});

// ── Password Visibility Toggle ────────────────────────────────────────
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
