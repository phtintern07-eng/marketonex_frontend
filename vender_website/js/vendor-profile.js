/**
 * VENDOR PROFILE DROPDOWN SYSTEM
 * Replicated from Marketonex profile dropdown functionality
 * Handles profile icon display, dropdown panel, session management, and logout
 */

document.addEventListener('DOMContentLoaded', function () {
    // ============================================================================
    // VENDOR PROFILE PANEL FUNCTIONALITY
    // ============================================================================

    const profileIconBtn = document.getElementById('profile-icon-btn');
    const profileDropdown = document.getElementById('profile-dropdown');
    const profileLogoutBtn = document.getElementById('profile-logout-btn');

    if (profileIconBtn && profileDropdown) {
        // Initialize profile panel
        initProfilePanel();

        // Toggle profile dropdown
        profileIconBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleProfilePanel();
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!profileIconBtn.contains(e.target) && !profileDropdown.contains(e.target)) {
                closeProfilePanel();
            }
        });

        // Logout functionality
        if (profileLogoutBtn) {
            profileLogoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                await handleLogout();
            });
        }
    }

    async function initProfilePanel() {
        // Check if vendor is logged in
        const isLoggedIn = localStorage.getItem('vendorLoggedIn') === 'true';

        if (!isLoggedIn) {
            // If not logged in, clicking profile icon should redirect to login
            profileIconBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                window.location.href = '/vendor/login.html';
            });

            // Show login icon instead of profile
            document.getElementById('profile-initials').textContent = '?';
            return;
        }

        // Vendor is logged in, fetch and display profile data
        await loadVendorProfile();
    }

    async function loadVendorProfile() {
        try {
            // Fetch vendor profile from backend
            const response = await fetch('/api/profile', {
                method: 'GET',
                credentials: 'include',
                headers: {}
            });

            // Handle authentication errors
            if (response.status === 400 || response.status === 401 || response.status === 403) {
                console.warn('Vendor not authenticated or session invalid:', response.status);
                // Fallback to localStorage
                const vendorName = localStorage.getItem('vendorName') || localStorage.getItem('vendorEmail');
                if (vendorName) {
                    const initials = getInitials(vendorName);
                    document.getElementById('profile-initials').textContent = initials;
                    const profileNameEl = document.getElementById('profile-name');
                    if (profileNameEl) profileNameEl.textContent = vendorName;
                } else {
                    document.getElementById('profile-initials').textContent = '?';
                }
                return;
            }

            if (!response.ok) throw new Error('Failed to fetch vendor profile');

            const data = await response.json();
            // Handle various response structures
            const vendor = data.profile?.user || data.vendor || data.user || data;

            if (vendor) {
                // UI Elements
                const profileAvatar = document.getElementById('profile-avatar');
                const profileInitials = document.getElementById('profile-initials');
                const dropdownAvatar = document.getElementById('dropdown-avatar');
                const profileName = document.getElementById('profile-name');
                const profileGreeting = document.querySelector('.profile-greeting');

                const timestamp = new Date().getTime();
                const hasImage = vendor.profile_picture && !vendor.profile_picture.includes('default') && vendor.profile_picture !== '';

                // Update Profile Icon
                if (hasImage) {
                    const src = vendor.profile_picture.startsWith('http')
                        ? vendor.profile_picture
                        : `${vendor.profile_picture}?t=${timestamp}`;

                    if (profileAvatar) {
                        profileAvatar.src = src;
                        profileAvatar.classList.remove('hidden');
                        profileAvatar.style.display = 'block';
                    }
                    if (profileInitials) {
                        profileInitials.textContent = '';
                        profileInitials.classList.add('hidden');
                        profileInitials.style.display = 'none';
                    }
                } else {
                    const initials = getInitials(vendor.fullname || vendor.full_name || vendor.email);
                    if (profileInitials) {
                        profileInitials.textContent = initials;
                        profileInitials.classList.remove('hidden');
                        profileInitials.style.display = 'flex';
                    }
                    if (profileAvatar) {
                        profileAvatar.classList.add('hidden');
                        profileAvatar.style.display = 'none';
                    }
                }

                // Update Dropdown Avatar
                if (dropdownAvatar) {
                    if (hasImage) {
                        const src = vendor.profile_picture.startsWith('http')
                            ? vendor.profile_picture
                            : `${vendor.profile_picture}?t=${timestamp}`;
                        dropdownAvatar.src = src;
                        dropdownAvatar.style.display = 'block';
                    } else {
                        dropdownAvatar.style.display = 'none';
                    }
                }

                // Update Name
                if (profileName) {
                    profileName.textContent = vendor.fullname || vendor.full_name || vendor.business_name || 'Vendor';
                }

                // Update Greeting
                if (profileGreeting) {
                    const hour = new Date().getHours();
                    let greeting = 'Hello';
                    if (hour < 12) greeting = 'Good Morning';
                    else if (hour < 18) greeting = 'Good Afternoon';
                    else greeting = 'Good Evening';
                    profileGreeting.textContent = `${greeting}!`;
                }

                // Update LocalStorage
                localStorage.setItem('vendorName', vendor.fullname || vendor.full_name || vendor.business_name || 'Vendor');
                localStorage.setItem('vendorEmail', vendor.email || '');
                localStorage.setItem('userRole', vendor.role || 'customer');

                // Role-Based Visibility for Mobile Menu
                const mobVendorLink = document.getElementById('mob-vendor-profile-link');
                const desktopVendorBtn = document.getElementById('vendor-profile-btn');

                if (vendor.role === 'vendor') {
                    if (mobVendorLink) mobVendorLink.style.display = 'flex';
                    if (desktopVendorBtn) desktopVendorBtn.style.display = 'inline-block';
                } else {
                    if (mobVendorLink) mobVendorLink.style.display = 'none';
                    if (desktopVendorBtn) desktopVendorBtn.style.display = 'none';
                }
            }
        } catch (error) {
            console.error('Failed to load vendor profile:', error);
            // Fallback
            const vendorName = localStorage.getItem('vendorName') || localStorage.getItem('vendorEmail');
            if (vendorName) {
                const initials = getInitials(vendorName);
                if (document.getElementById('profile-initials')) {
                    document.getElementById('profile-initials').textContent = initials;
                }
                const profileNameEl = document.getElementById('profile-name');
                if (profileNameEl) profileNameEl.textContent = vendorName;
            } else {
                if (document.getElementById('profile-initials')) {
                    document.getElementById('profile-initials').textContent = '?';
                }
            }
        }
    }

    function getInitials(name) {
        if (!name) return '?';
        const parts = name.split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }

    function toggleProfilePanel() {
        const isLoggedIn = localStorage.getItem('vendorLoggedIn') === 'true';

        if (!isLoggedIn) {
            window.location.href = '/vendor/login.html';
            return;
        }

        profileDropdown.classList.toggle('hidden');
    }

    function closeProfilePanel() {
        if (profileDropdown) {
            profileDropdown.classList.add('hidden');
        }
    }

    async function handleLogout() {
        try {
            // Call backend logout API
            await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        } catch (error) {
            console.error('Logout API error:', error);
        } finally {
            // Clear local storage
            localStorage.removeItem('vendorLoggedIn');
            localStorage.removeItem('vendorEmail');
            localStorage.removeItem('vendorName');
            localStorage.removeItem('userId');

            // Redirect to login page
            window.location.href = '/vendor/login.html';
        }
    }

    // ============================================================================
    // MOBILE DRAWER FUNCTIONALITY
    // ============================================================================
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const mobDrawer = document.getElementById('mob-drawer');
    const mobOverlay = document.getElementById('mob-overlay');
    const mobCloseBtn = document.getElementById('mob-drawer-close');
    const mobNavItems = document.querySelectorAll('.mob-nav-item');

    if (hamburgerBtn && mobDrawer && mobOverlay) {
        hamburgerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMobileMenu();
        });

        if (mobCloseBtn) {
            mobCloseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                closeMobileMenu();
            });
        }

        mobOverlay.addEventListener('click', (e) => {
            e.stopPropagation();
            closeMobileMenu();
        });

        // Close drawer on nav item click (for better mobile UX)
        mobNavItems.forEach(item => {
            item.addEventListener('click', () => {
                if (window.innerWidth <= 1024) {
                    closeMobileMenu();
                }
            });
        });

        // Close drawer on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && mobDrawer.classList.contains('mob-drawer--open')) {
                closeMobileMenu();
            }
        });
    }

    function toggleMobileMenu() {
        const isOpen = mobDrawer.classList.contains('mob-drawer--open');
        if (isOpen) {
            closeMobileMenu();
        } else {
            openMobileMenu();
        }
    }

    function openMobileMenu() {
        mobDrawer.classList.add('mob-drawer--open');
        mobOverlay.classList.add('mob-overlay--visible');
        hamburgerBtn.setAttribute('aria-expanded', 'true');
        mobDrawer.setAttribute('aria-hidden', 'false');
        document.body.classList.add('mob-drawer-lock');

        // Animate nav items sequentially for a premium feel
        mobNavItems.forEach((item, index) => {
            setTimeout(() => {
                item.classList.add('mob-nav-item--visible');
            }, 100 + (index * 40));
        });
    }

    function closeMobileMenu() {
        mobDrawer.classList.remove('mob-drawer--open');
        mobOverlay.classList.remove('mob-overlay--visible');
        hamburgerBtn.setAttribute('aria-expanded', 'false');
        mobDrawer.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('mob-drawer-lock');

        // Reset nav items visibility for next opening animation
        mobNavItems.forEach(item => {
            item.classList.remove('mob-nav-item--visible');
        });
    }
});
