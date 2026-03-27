document.addEventListener('DOMContentLoaded', () => {
    console.log("LOGIN FINAL VERSION LOADED");

    const loginForm = document.getElementById('loginForm');

    if (!loginForm) {
        console.error("Login form not found!");
        return;
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        const submitBtn = loginForm.querySelector('button[type="submit"]');

        // ✅ Validation
        if (!emailInput.value.trim() || !passwordInput.value.trim()) {
            alert('Please enter both email and password');
            return;
        }

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        // ✅ Button loading state
        const originalBtnText = submitBtn.textContent;
        submitBtn.textContent = 'Signing In...';
        submitBtn.disabled = true;

        try {
            // ✅ CORRECT LOGIN REQUEST
            const response = await fetch('/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',   // 🔥 IMPORTANT (session fix)
                body: JSON.stringify({ email, password })
            });

            // ✅ Safe JSON parsing
            let data;
            try {
                data = await response.json();
            } catch (err) {
                throw new Error('Invalid server response');
            }

            console.log('[LOGIN RESPONSE]:', data);

            // ❌ If login failed
            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Login failed');
            }

            // ✅ Save optional data
            if (data.user) {
                localStorage.setItem('vendorLoggedIn', 'true');
                localStorage.setItem('vendorEmail', data.user.email || email);
                sessionStorage.setItem('canAddProduct', 'true');
            }

            // ✅ Check if redirected from another page
            const returnUrl = sessionStorage.getItem('returnAfterLogin');
            if (returnUrl) {
                sessionStorage.removeItem('returnAfterLogin');
                window.location.href = returnUrl;
                return;
            }

            // 🔥 MAIN REDIRECT (IMPORTANT)
            if (data.redirect_url) {
                console.log("Redirecting to:", data.redirect_url);
                window.location.href = data.redirect_url;
                return;
            }

            // fallback (just in case)
            window.location.href = '/vendor';

        } catch (error) {
            console.error('[LOGIN ERROR]:', error);
            alert(error.message || 'Something went wrong');

            // ❌ Reset button
            submitBtn.textContent = originalBtnText;
            submitBtn.disabled = false;
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