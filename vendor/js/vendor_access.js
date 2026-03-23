/**
 * vendor_access.js
 * Enforces vendor access control in the UI based on verification status.
 * Dynamically hides unverified sections from the sidebar.
 */
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/api/auth/status', { credentials: 'include' });
        const data = await response.json();

        if (data.isAuthenticated && data.role === 'vendor') {
            const user = data.user;
            const isVerified = user.verified;
            const kycStatus = user.kyc_status;
            const bizStatus = user.biz_verification_status;

            const restrictedNavIds = [
                'nav-profile', 'nav-products', 'nav-orders',
                'nav-feedback', 'nav-insights', 'nav-settings',
                'nav-reviews', 'nav-website-editor'
            ];

            // Level 1: Brand new / KYC not approved -> only "Verification" allowed
            if (!isVerified || kycStatus !== 'approved') {
                hideNavItems([...restrictedNavIds, 'nav-store-verification']);
            }
            // Level 2: KYC Approved, Business Verification pending -> "Store Verification" allowed
            else if (bizStatus !== 'approved') {
                hideNavItems([...restrictedNavIds, 'nav-verification']);
            }
        }
    } catch (error) {
        console.error('Error fetching auth status for access control:', error);
    }
});

function hideNavItems(navIds) {
    navIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.style.display = 'none';
        }
    });
}

