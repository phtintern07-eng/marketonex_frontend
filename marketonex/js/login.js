document.addEventListener('DOMContentLoaded', () => {
    console.log("LOGIN FIX VERSION 1.0.2 LOADED (marketonex)");
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
                // Use ApiService from common.js
                // Endpoint: /api/auth/login (ApiService adds /api)
                const response = await ApiService.post('/auth/login', {
                    email: email,
                    password: password
                });

                console.log('Login successful:', response);

                // Update Local Storage (Sync with common.js logic)
                if (response.user) {
                    localStorage.setItem('vendorLoggedIn', 'true');
                    localStorage.setItem('vendorEmail', response.user.email);
                    localStorage.setItem('userName', response.user.fullname); // Store full name
                    localStorage.setItem('userId', response.user.id); // Add userId for ownership check
                    localStorage.setItem('userRole', response.user.role); // Store role for RBAC
                    localStorage.setItem('userVerified', response.user.verified); // Store verification status

                    // Set one-time permission to add product (only for verified vendors)
                    if (response.user.role === 'vendor' && response.user.verified) {
                        sessionStorage.setItem('canAddProduct', 'true');
                    }
                }

                // Check if we have a saved return URL (set via sessionStorage OR query param)
                // This must be checked BEFORE the backend redirect, so users go back to where they came from
                const urlParams = new URLSearchParams(window.location.search);
                const redirectParam = urlParams.get('redirect');
                const returnUrl = sessionStorage.getItem('returnAfterLogin') || redirectParam;

                if (returnUrl) {
                    sessionStorage.removeItem('returnAfterLogin');
                    console.log('[LOGIN] Returning to:', returnUrl);
                    window.location.href = returnUrl;
                    return;
                }

                // Use backend's redirect URL if provided and no local redirect pending
                if (response.redirect) {
                    console.log('[LOGIN] Redirecting to:', response.redirect);
                    window.location.href = response.redirect;
                    return;
                }

                // Default redirect
                window.location.href = 'marketonex.html';




            } catch (error) {
                console.error('Login failed:', error);

                // Check if this is an email verification error
                if (error.message && error.message.includes('Email not verified')) {
                    const verifyBtn = document.getElementById('verifyEmailBtn');
                    if (verifyBtn) {
                        verifyBtn.style.display = 'block';
                        verifyBtn.dataset.email = emailInput.value.trim();
                    }
                    alert('⚠️ Email not verified. Please click "Verify Email" to receive a verification link.');
                    submitBtn.textContent = originalBtnText;
                    submitBtn.disabled = false;
                    return;
                }

                let errorMessage = 'Login failed. Please check your credentials.';
                if (error.message) {
                    errorMessage = error.message;
                }

                alert(errorMessage);

                // Reset UI
                submitBtn.textContent = originalBtnText;
                submitBtn.disabled = false;
            }
        });
    }

    // Verify Email Button Handler
    const verifyBtn = document.getElementById('verifyEmailBtn');
    if (verifyBtn) {
        verifyBtn.addEventListener('click', async () => {
            const email = verifyBtn.dataset.email;
            if (!email) {
                alert('Email not found. Please try logging in again.');
                return;
            }

            const originalText = verifyBtn.textContent;
            verifyBtn.textContent = 'Sending...';
            verifyBtn.disabled = true;

            try {
                await ApiService.post('/vendor/send-verification', { email });
                alert(`✅ Verification email sent to ${email}. Please check your inbox and spam folder.`);
                verifyBtn.style.display = 'none';
            } catch (error) {
                console.error('Failed to send verification email:', error);
                alert('Failed to send verification email. Please try again.');
                verifyBtn.textContent = originalText;
                verifyBtn.disabled = false;
            }
        });
    }
});
