// Vendor Signup Page — with pre-signup email verification
// Flow: Enter email → Send Verification → Check link in email → Check Status → Sign Up
// VERSION: v3 (plain fetch, no ApiService dependency)
console.log("SIGNUP V3_PLAIN_FETCH LOADED - " + new Date().toISOString());

/**
 * Safe JSON fetcher - never throws "Unexpected end of JSON input"
 */
async function safeFetch(url, options) {
    const response = await fetch(url, options);
    let data = null;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        try {
            data = await response.json();
        } catch (e) {
            data = { error: 'Server returned malformed JSON.' };
        }
    } else {
        const text = await response.text().catch(() => '');
        console.warn("[signup] Non-JSON response (" + response.status + "):", text.substring(0, 200));
        data = { error: 'Server error (' + response.status + '). Please try again.' };
    }

    if (!response.ok) {
        const err = new Error(data.error || data.message || 'Request failed');
        err.data = data;
        err.status = response.status;
        throw err;
    }
    return data;
}

document.addEventListener('DOMContentLoaded', () => {
    const signupForm = document.getElementById('signupForm');
    const sendVerificationBtn = document.getElementById('sendVerificationBtn');
    const checkVerificationBtn = document.getElementById('checkVerificationBtn');
    const signupBtn = signupForm ? signupForm.querySelector('button[type="submit"]') : null;
    const statusBox = document.getElementById('verificationStatus');

    let emailVerified = false;

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

    function setSignupEnabled(enabled) {
        if (!signupBtn) return;
        signupBtn.disabled = !enabled;
        signupBtn.style.opacity = enabled ? '1' : '0.5';
        signupBtn.title = enabled ? '' : 'Verify your email first';
    }

    setSignupEnabled(false);

    const BASE = window.API_BASE_URL || '';

    // ─── Send Verification ───────────────────────────────────────────────────
    if (sendVerificationBtn) {
        sendVerificationBtn.addEventListener('click', async () => {
            const email = (document.getElementById('email')?.value || '').trim();
            if (!email) { showStatus('Please enter your email address first.', 'error'); return; }

            sendVerificationBtn.disabled = true;
            sendVerificationBtn.textContent = 'Sending...';
            showStatus('Sending verification email...', 'info');

            try {
                const data = await safeFetch(BASE + '/api/auth/send-email-verification', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });

                if (data.status === 'already_verified') {
                    showStatus('✅ ' + data.message + ' Redirecting to login...', 'success');
                    setTimeout(() => { window.location.href = 'loginvender.html'; }, 2500);
                } else if (data.status === 'already_exists') {
                    showStatus('ℹ️ ' + data.message, 'info');
                } else {
                    showStatus('✉️ Verification mail sent! Check your inbox and click the link, then click "Check Verification Status".', 'info');
                }
            } catch (error) {
                console.error('Send verification failed:', error);
                showStatus(error.message || 'Failed to send verification email.', 'error');
            } finally {
                sendVerificationBtn.disabled = false;
                sendVerificationBtn.textContent = 'Send Verification';
            }
        });
    }

    // ─── Check Verification Status ───────────────────────────────────────────
    if (checkVerificationBtn) {
        checkVerificationBtn.addEventListener('click', async () => {
            const email = (document.getElementById('email')?.value || '').trim();
            if (!email) { showStatus('Please enter your email address first.', 'error'); return; }

            checkVerificationBtn.disabled = true;
            checkVerificationBtn.textContent = 'Checking...';

            try {
                const data = await safeFetch(BASE + '/api/auth/check-email-verification', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });

                if (data.verified) {
                    emailVerified = true;
                    setSignupEnabled(true);
                    if (data.existing_account) {
                        showStatus('✅ Email Verified! Your existing account is now verified. Please log in.', 'success');
                        setTimeout(() => { window.location.href = 'loginvender.html'; }, 2500);
                    } else {
                        showStatus('✅ Email Verified — You can now Sign Up!', 'success');
                    }
                } else {
                    emailVerified = false;
                    setSignupEnabled(false);
                    showStatus('⏳ Verification Pending — Please click the link in your email first.', 'info');
                }
            } catch (error) {
                console.error('Check verification failed:', error);
                showStatus(error.message || 'Error checking verification. Please try again.', 'error');
            } finally {
                checkVerificationBtn.disabled = false;
                checkVerificationBtn.textContent = 'Check Verification Status';
            }
        });
    }

    // ─── Sign Up Submission ──────────────────────────────────────────────────
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (!emailVerified) {
                showStatus('⚠️ Please verify your email first before signing up.', 'error');
                return;
            }

            const fullname = document.getElementById('fullname').value.trim();
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            const termsCheckbox = document.getElementById('terms');

            if (!fullname || !email || !password || !confirmPassword) { alert('Please fill in all fields'); return; }
            if (password !== confirmPassword) { alert('Passwords do not match'); return; }
            if (!termsCheckbox.checked) { alert('Please agree to the terms of service'); return; }

            const submitBtn = signupForm.querySelector('button[type="submit"]');
            const origText = submitBtn.textContent;
            submitBtn.textContent = 'Creating Account...';
            submitBtn.disabled = true;

            try {
                const result = await safeFetch(BASE + '/api/auth/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ fullname, email, password, role: 'vendor', signup_source: 'vendor' })
                });

                showStatus('✅ Signup successful!', 'success');
                alert(result.message || result.data?.message || 'Account created! Please log in.');
                window.location.href = 'loginvender.html';

            } catch (error) {
                console.error('Signup error:', error);
                showStatus(error.message || 'Signup failed. Please try again.', 'error');
                submitBtn.textContent = origText;
                submitBtn.disabled = false;
            }
        });
    }
});

// ── Password Visibility Toggle ────────────────────────────────────────
document.querySelectorAll('.toggle-password').forEach(icon => {
    icon.addEventListener('click', function () {
        const input = this.previousElementSibling;
        if (input && input.tagName === 'INPUT') {
            if (input.type === 'password') {
                input.type = 'text';
                this.classList.remove('fa-eye');
                this.classList.add('fa-eye-slash');
            } else {
                input.type = 'password';
                this.classList.remove('fa-eye-slash');
                this.classList.add('fa-eye');
            }
        }
    });
});
