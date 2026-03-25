document.addEventListener('DOMContentLoaded', () => {
    console.log("login_v2.js loaded - FIXED VERSION");
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

                // Handle specific business errors returned by the API
                if (error.responseData) {
                    const response = error.responseData;
                    const errCode = response.error || response.code || '';

                    if (errCode === 'not_a_vendor') {
                        alert('This login portal is for Vendors only. Please use the Marketonex login instead.');
                    } else if (errCode === 'email_not_verified') {
                        alert('Please verify your email address before logging in.\n\nGo to the Signup page, enter your email, and click "Send Verification" to get a new verification link.');
                        window.location.href = 'signup.html';
                        return;
                    } else {
                        alert(response.message || response.error || 'Login failed. Please check your credentials.');
                    }
                } else {
                    alert('A network error occurred. Please try again.');
                }

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
