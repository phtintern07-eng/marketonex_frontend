/**
 * Session Management Utility
 * Handles user session checking and authentication
 */

class SessionManager {
    /**
     * Check if user is currently authenticated
     * @returns {Promise<boolean>}
     */
    static async checkSession() {
        try {
            const baseUrl = window.API_BASE_URL || '';
            const response = await fetch(`${baseUrl}/api/auth/status`, {
                credentials: 'include'
            });

            if (!response.ok) {
                return false;
            }

            const data = await response.json();
            return data.isAuthenticated || false;
        } catch (error) {
            console.error('[SESSION] Error checking session:', error);
            return false;
        }
    }

    /**
     * Get current user information
     * @returns {Promise<Object|null>}
     */
    static async getCurrentUser() {
        try {
            const baseUrl = window.API_BASE_URL || '';
            const response = await fetch(`${baseUrl}/api/auth/status`, {
                credentials: 'include'
            });

            if (!response.ok) {
                return null;
            }

            const data = await response.json();
            return data.isAuthenticated ? data.vendor : null;
        } catch (error) {
            console.error('[SESSION] Error getting user:', error);
            return null;
        }
    }

    /**
     * Require authentication - redirect to login if not authenticated
     * @param {string} redirectUrl - URL to redirect to if not authenticated
     * @param {string} returnUrl - URL to return to after login
     * @returns {Promise<boolean>} - true if authenticated, false if redirected
     */
    static async requireAuth(redirectUrl = '/marketplace/login.html', returnUrl = null) {
        const isAuth = await this.checkSession();

        if (!isAuth) {
            // Store current URL to return after login
            const currentUrl = returnUrl || window.location.pathname + window.location.search;
            sessionStorage.setItem('returnUrl', currentUrl);

            // Redirect to login
            window.location.href = redirectUrl;
            return false;
        }

        return true;
    }

    /**
     * Redirect to return URL after successful login
     */
    static redirectAfterLogin(defaultUrl = '/marketplace/marketplace.html') {
        const returnUrl = sessionStorage.getItem('returnUrl');
        sessionStorage.removeItem('returnUrl');
        window.location.href = returnUrl || defaultUrl;
    }

    /**
     * Update UI based on authentication status
     * @param {Function} callback - Function to call with auth status
     */
    static async updateUI(callback) {
        const isAuth = await this.checkSession();
        const user = isAuth ? await this.getCurrentUser() : null;

        if (callback && typeof callback === 'function') {
            callback(isAuth, user);
        }
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SessionManager;
}
