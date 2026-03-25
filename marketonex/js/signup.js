// Marketonex Signup Page — Customer accounts ONLY.
// Vendors must use /vendor/signup.html
// This page always creates a customer (role: 'user') account.

// Strong password regex: min 8 chars, uppercase, lowercase, digit, special char
const SIGNUP_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

document.addEventListener('DOMContentLoaded', () => {
    const signupForm = document.getElementById('signupForm');
    const signupBtn = signupForm ? signupForm.querySelector('button[type="submit"]') : null;
    const statusBox = document.getElementById('signupStatus');

    // ─── Helper: show status message ─────────────────────────────────────────
    function showStatus(msg, type) {
        if (!statusBox) return;
        statusBox.style.display = 'block';
        statusBox.textContent = msg;
        if (type === 'success') {
            statusBox.style.background = 'rgba(16,185,129,0.12)';
            statusBox.style.color = '#065f46';
            statusBox.style.border = '1px solid #10b981';
        } else if (type === 'error') {
            statusBox.style.background = 'rgba(220,38,38,0.1)';
            statusBox.style.color = '#991b1b';
            statusBox.style.border = '1px solid #f87171';
        } else {
            statusBox.style.background = 'rgba(234,179,8,0.1)';
            statusBox.style.color = '#78350f';
            statusBox.style.border = '1px solid #facc15';
        }
    }

    // ─── Sign Up Submission ───────────────────────────────────────────────────
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const fullname = document.getElementById('fullname').value.trim();
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            const termsCheckbox = document.getElementById('terms');

            if (!fullname || !email || !password || !confirmPassword) {
                showStatus('❌ Please fill in all fields.', 'error');
                return;
            }
            if (password !== confirmPassword) {
                showStatus('❌ Passwords do not match.', 'error');
                return;
            }
            if (!SIGNUP_PASSWORD_REGEX.test(password)) {
                showStatus('❌ Password must be at least 8 characters and include uppercase, lowercase, number, and special character (@$!%*?&). Example: User@1234', 'error');
                return;
            }
            if (!termsCheckbox || !termsCheckbox.checked) {
                showStatus('❌ Please agree to the terms of service.', 'error');
                return;
            }

            if (signupBtn) {
                signupBtn.textContent = 'Creating Account...';
                signupBtn.disabled = true;
            }

            try {
                // Use ApiService for consistent error handling and JSON safety
                const result = await ApiService.post('/auth/signup', {
                    fullname,
                    email,
                    password,
                    role: 'user',          // Always 'user' for marketonex signup
                    signup_source: 'customer' // Explicit source marker for backend
                });

                showStatus('✅ Account created successfully! Redirecting...', 'success');
                setTimeout(() => {
                    window.location.href = result.redirect || 'marketonex.html';
                }, 1000);

            } catch (error) {
                console.error('Signup error:', error);
                let msg = 'Failed to create account. Please try again.';
                if (error.responseData) {
                    msg = error.responseData.error || error.responseData.message || msg;
                }
                showStatus(msg, 'error');
                if (signupBtn) {
                    signupBtn.textContent = 'Sign Up';
                    signupBtn.disabled = false;
                }
            }
        });
    }

    function togglePassword(inputId, btn) {
        const input = document.getElementById(inputId);
        const icon = btn.querySelector('i');
        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.replace('fa-eye', 'fa-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.replace('fa-eye-slash', 'fa-eye');
        }
    }
    window.togglePassword = togglePassword;
});
