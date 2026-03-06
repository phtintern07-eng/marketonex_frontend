document.addEventListener('DOMContentLoaded', () => {
    const body = document.body;
    const html = document.documentElement;

    // Standard Themes from CSS
    // Dark: Default (:root variables)
    // Light: body.theme-chrome
    // Brown: body.theme-brown

    const themes = ['dark', 'light', 'brown'];
    const themeIcons = {
        'dark': 'fas fa-palette', // Default icon
        'light': 'fas fa-palette',
        'brown': 'fas fa-palette'
    };

    // 1. Initialize Theme from LocalStorage (standard key: 'theme')
    let currentTheme = localStorage.getItem('theme') || 'dark';
    if (!themes.includes(currentTheme)) currentTheme = 'dark';

    applyTheme(currentTheme);

    // 2. Toggle Handler
    const toggleButtons = [
        document.getElementById('theme-toggle'),
        document.getElementById('customer-theme-toggle'),
        document.getElementById('mob-theme-toggle'),
        document.getElementById('theme-toggle-btn')
    ];

    toggleButtons.forEach(btn => {
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                // Cycle themes
                const currentIndex = themes.indexOf(currentTheme);
                const nextIndex = (currentIndex + 1) % themes.length;
                currentTheme = themes[nextIndex];

                applyTheme(currentTheme);
            });
        }
    });

    function applyTheme(theme) {
        // Remove existing theme classes
        body.classList.remove('theme-chrome', 'theme-brown', 'dark-mode');

        // Add specific theme classes
        if (theme === 'light' || theme === 'theme-chrome') {
            body.classList.add('theme-chrome');
        } else if (theme === 'brown' || theme === 'theme-brown') {
            body.classList.add('theme-brown');
        } else {
            // Dark mode is default
            body.classList.add('dark-mode');
        }

        // Set global attribute
        html.setAttribute('data-theme', theme);

        // Save preference
        localStorage.setItem('theme', theme);

        // Update Icons
        const currentToggleButtons = [
            document.getElementById('theme-toggle'),
            document.getElementById('customer-theme-toggle'),
            document.getElementById('mob-theme-toggle'),
            document.getElementById('theme-toggle-btn')
        ];

        currentToggleButtons.forEach(btn => {
            if (btn) {
                const icon = btn.querySelector('i');
                if (icon) {
                    if (theme === 'light' || theme === 'theme-chrome') icon.className = 'fas fa-sun';
                    else if (theme === 'brown' || theme === 'theme-brown') icon.className = 'fas fa-coffee';
                    else icon.className = 'fas fa-moon';
                }
            }
        });

        // Event for other components (like charts)
        window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme } }));
    }

    // 3. Storage Event Listener for Cross-Tab Sync
    window.addEventListener('storage', (e) => {
        if (e.key === 'theme' && themes.includes(e.newValue)) {
            currentTheme = e.newValue;
            applyTheme(currentTheme);
        }
    });

    // --- Brand Color Handler (Original Functionality Preserved) ---
    const savedColor = localStorage.getItem('brandColor');
    if (savedColor) {
        html.style.setProperty('--primary', savedColor);
    }

    const colorPicker = document.getElementById('brand-color-picker');
    const resetBtn = document.getElementById('reset-theme-btn');

    if (colorPicker) {
        if (savedColor) colorPicker.value = savedColor;
        colorPicker.addEventListener('input', (e) => {
            const color = e.target.value;
            html.style.setProperty('--primary', color);
            localStorage.setItem('brandColor', color);
        });
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            localStorage.removeItem('brandColor');
            html.style.removeProperty('--primary');
            if (colorPicker) colorPicker.value = '#1E3A8A';
            window.location.reload();
        });
    }
});

window.applyVendorTheme = function (vendor) {
    if (!vendor) return;

    const html = document.documentElement;

    // 1. Apply Theme Colors if Auto Mode
    if (vendor.theme && vendor.theme.theme_mode === 'auto') {
        if (vendor.theme.primary_color) html.style.setProperty('--primary', vendor.theme.primary_color);
        if (vendor.theme.secondary_color) html.style.setProperty('--secondary', vendor.theme.secondary_color);
        if (vendor.theme.accent_color) html.style.setProperty('--accent', vendor.theme.accent_color);
        console.log('[Theme] Auto-palette applied from logo');
    }

    // 2. Apply Brand Logo & Business Name
    const businessName = vendor.business_name || vendor.fullname || 'Store';
    const brandElements = document.querySelectorAll('#vendor-brand-name, .nav-brand, #brand-name, #footer-logo');

    brandElements.forEach(el => {
        const hasLogo = !!vendor.logo_url;
        const alreadyHasImg = !!el.querySelector('img');

        if (hasLogo && !alreadyHasImg) {
            // Inject Logo
            el.innerHTML = `<img src="${vendor.logo_url}" alt="${businessName}" style="height: 32px; margin-right: 10px; vertical-align: middle; border-radius: 4px; object-fit: contain;">`;
            el.innerHTML += ` ${businessName}`;
        } else if (!hasLogo) {
            // Just Name (with icon preservation if applicable)
            if (el.id === 'vendor-brand-name' || el.id === 'footer-logo' || el.id === 'brand-name') {
                el.textContent = businessName;
            } else {
                // For .nav-brand usually
                const icon = el.querySelector('i');
                el.innerHTML = '';
                if (icon) el.appendChild(icon);
                el.innerHTML += ` ${businessName}`;
            }
        }
    });

    // Update Footer Logo Img if exists
    if (vendor.logo_url) {
        const footerLogoImg = document.getElementById('footer-logo-img');
        if (footerLogoImg) {
            footerLogoImg.src = vendor.logo_url;
            footerLogoImg.style.display = 'block';
        }
    }
};
