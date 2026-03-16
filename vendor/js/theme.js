/**
 * VendorVerse — Global Theme Handler
 * ====================================
 * Applies the selected theme to <html data-theme="..."> so that every
 * page and CSS rule that uses [data-theme="..."] variables picks it up.
 *
 * Themes available: "dark" (default/root), "light", "brown"
 *
 * Rules:
 *  • Does NOT touch any existing HTML, CSS, or JS logic.
 *  • Only reads clicks on existing .theme-option[data-value] elements.
 *  • Persists selection in localStorage under key "dashboardTheme".
 *  • Restores theme instantly on every page load (before paint via
 *    a blocking <script> tag placed in <head> — see HTML files).
 */

(function () {
    'use strict';

    var STORAGE_KEY = 'dashboardTheme';
    var DEFAULT_THEME = 'dark'; // matches :root defaults in common.css

    /**
     * Apply theme globally.
     * @param {string} theme  - "dark" | "light" | "brown"
     * @param {boolean} [save=true] - persist to localStorage
     */
    function applyTheme(theme, save) {
        if (!theme) return;
        document.documentElement.setAttribute('data-theme', theme);
        if (save !== false) {
            try {
                localStorage.setItem(STORAGE_KEY, theme);
            } catch (e) { /* private-browsing / storage quota */ }
        }
        syncActiveState(theme);
    }

    /**
     * Mark the correct .theme-option as visually active.
     * All pages may have multiple menus — update all of them.
     */
    function syncActiveState(theme) {
        document.querySelectorAll('.theme-option').forEach(function (opt) {
            if (opt.getAttribute('data-value') === theme) {
                opt.classList.add('active');
            } else {
                opt.classList.remove('active');
            }
        });
    }

    /**
     * Toggle the visibility of the nearest .theme-menu when
     * the .theme-btn gear icon is clicked.
     */
    function toggleMenu(btn) {
        var menu = btn.parentElement
            ? btn.parentElement.querySelector('.theme-menu')
            : null;
        if (!menu) return;
        var isOpen = menu.classList.contains('active');
        // Close all open menus first
        document.querySelectorAll('.theme-menu').forEach(function (m) {
            m.classList.remove('active');
        });
        if (!isOpen) {
            menu.classList.add('active');
        }
    }

    /**
     * Close every open menu when the user clicks outside.
     */
    function handleOutsideClick(e) {
        if (!e.target.closest('.theme-controls')) {
            document.querySelectorAll('.theme-menu').forEach(function (m) {
                m.classList.remove('active');
            });
        }
    }

    /**
     * Wire up all theme-related click handlers using event delegation
     * on document so that dynamically‑shown pages are also covered.
     */
    function attachListeners() {
        document.addEventListener('click', function (e) {
            // ── Theme gear button ─────────────────────────────────────
            var btn = e.target.closest('.theme-btn');
            if (btn) {
                e.stopPropagation();
                toggleMenu(btn);
                return;
            }

            // ── Theme option selection ────────────────────────────────
            var opt = e.target.closest('.theme-option');
            if (opt && opt.hasAttribute('data-value')) {
                var selected = opt.getAttribute('data-value');
                applyTheme(selected);
                // Close the menu after selection
                document.querySelectorAll('.theme-menu').forEach(function (m) {
                    m.classList.remove('active');
                });
                return;
            }

            // ── Click outside → close menus ───────────────────────────
            handleOutsideClick(e);
        });
    }

    /**
     * Restore the saved theme on load (synchronously, to avoid flash).
     */
    function restoreTheme() {
        var saved;
        try {
            saved = localStorage.getItem(STORAGE_KEY);
        } catch (e) { /* ignore */ }
        applyTheme(saved || DEFAULT_THEME, false);
    }

    // ── Entry point ───────────────────────────────────────────────────────────
    // Restore theme immediately (synchronous — runs before DOM paint finish).
    restoreTheme();

    // Attach click listeners after the DOM is ready.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            attachListeners();
            // Re-sync active state now that options are in the DOM.
            var current;
            try { current = localStorage.getItem(STORAGE_KEY); } catch (e) {}
            syncActiveState(current || DEFAULT_THEME);
        });
    } else {
        // DOM already ready (script loaded with defer or at end of body).
        attachListeners();
        var current2;
        try { current2 = localStorage.getItem(STORAGE_KEY); } catch (e2) {}
        syncActiveState(current2 || DEFAULT_THEME);
    }

})();
