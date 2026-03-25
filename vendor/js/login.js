document.addEventListener('DOMContentLoaded', () => {
    console.log("LOGIN FIX VERSION 1.0.2 LOADED");
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
                // Use ApiService from common.js for consistent error handling and JSON safety
                const response = await ApiService.post('/auth/vendor-login', { email, password });

                const user = response.data ? response.data.user : response.user;
                const redirect = response.data ? response.data.redirect : response.redirect;

                console.log('Vendor login successful:', user);

                // Update Local Storage
                if (user) {
                    localStorage.setItem('vendorLoggedIn', 'true');
                    localStorage.setItem('vendorEmail', user.email);
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
                    console.log('Redirecting to:', redirect);
                    window.location.href = redirect;
                    return;
                }

                // Fallback: vendor dashboard
                window.location.href = '/vendor-site/index.html';

            } catch (error) {
                console.error('Login failed:', error);

                // Detailed error alert for user
                let message = 'A network error occurred. Please try again.';

                if (error.responseData) {
                    const response = error.responseData;
                    const errCode = response.error || response.code || '';

                    if (errCode === 'not_a_vendor') {
                        message = 'This login portal is for Vendors only.';
                    } else if (errCode === 'email_not_verified') {
                        message = 'Please verify your email address before logging in.';
                        alert(message);
                        window.location.href = 'signup.html';
                        return;
                    } else if (error.status === 403) {
                        message = response.message || response.error || 'Your account is not verified. Please wait for Admin approval.';
                    } else {
                        message = response.message || response.error || 'Login failed. Please check your credentials.';
                    }
                } else if (error.message) {
                    message = error.message;
                }

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
