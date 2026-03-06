
// Landing Page Interactions

document.addEventListener('DOMContentLoaded', () => {
    const vendorSlug = getVendorSlug();
    if (vendorSlug) {
        console.log('Vendor Storefront Mode:', vendorSlug);//venderwebsite link creating // 
        loadVendorProfile(vendorSlug);
    }
    initCategoryScroll();
    loadFeaturedProducts(vendorSlug); // load the link of vender website// 
    updateCartBadge();

    // Mobile menu toggle
    const menuToggle = document.getElementById('menu-toggle');
    const navLinks = document.querySelector('.nav-links');
    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
        });
    }
});

function getVendorSlug() {// vender website link creating //  
    const path = window.location.pathname;
    const parts = path.split('/');
    // Format: /vendor/<slug>
    if (parts.length >= 3 && parts[1] === 'vendor') {
        return parts[2];
    }
    return null;
}

async function loadVendorProfile(slug) {
    try {
        const res = await fetch(`/api/vendors/info/${slug}`);
        if (!res.ok) return;
        const vendor = await res.json();

        // ── Apply Theme and Logo via Centralized Function ───────────────────
        if (window.applyVendorTheme) {
            window.applyVendorTheme(vendor);
        } else {
            // Fallback if theme-switcher hasn't loaded yet
            if (vendor.theme && vendor.theme.theme_mode === 'auto') {
                const root = document.documentElement;
                if (vendor.theme.primary_color) root.style.setProperty('--primary', vendor.theme.primary_color);
                if (vendor.theme.secondary_color) root.style.setProperty('--secondary', vendor.theme.secondary_color);
                if (vendor.theme.accent_color) root.style.setProperty('--accent', vendor.theme.accent_color);
            }
        }

        // Hero Update
        const heroTitle = document.getElementById('hero-title');
        if (heroTitle) heroTitle.innerHTML = `${vendor.business_name || vendor.fullname}<br>STOREFRONT`;

        document.title = `${vendor.business_name || vendor.fullname} - Storefront`;

        // Load targeted reviews once we have vendor ID
        if (vendor.id) {
            loadReviews(vendor.id);
        }
    } catch (err) {
        console.error('Failed to load vendor profile:', err);
    }
}

async function loadReviews(vendorId) {
    const testimonialContent = document.getElementById('testimonial-content');
    if (!testimonialContent) return;

    try {
        const res = await fetch(`/api/feedback/vendor/${vendorId}`);
        if (!res.ok) return;
        const data = await res.json();
        const reviews = data.feedback || [];

        if (reviews.length > 0) {
            // Show the 3 most recent reviews
            const recent = reviews.slice(0, 3);
            testimonialContent.innerHTML = '';

            recent.forEach((rev, idx) => {
                const reviewDiv = document.createElement('div');
                reviewDiv.className = 'testimonial-item' + (idx === 0 ? ' active' : '');
                reviewDiv.style.display = idx === 0 ? 'block' : 'none';
                reviewDiv.innerHTML = `
                    <h4 style="font-size: 1.5rem; margin-bottom: 1.5rem; color: var(--text-primary);">"${rev.comment.substring(0, 30)}..."</h4>
                    <p class="testimonial-text">"${rev.comment}"</p>
                    <div style="margin-top: 1rem; font-weight: 600; color: var(--accent);">
                        ${'★'.repeat(rev.rating)}${'☆'.repeat(5 - rev.rating)}
                        <span style="margin-left: 0.5rem; color: var(--text-secondary); font-size: 0.9rem;">- ${rev.customer_name || 'Verified Buyer'}</span>
                    </div>
                `;
                testimonialContent.appendChild(reviewDiv);
            });

            // If more than 1 review, setup a small interval to cycle or just show dots
            initTestimonialSlider(recent.length);
        }
    } catch (err) {
        console.error('Failed to load reviews:', err);
    }
}

function initTestimonialSlider(count) {
    const dotsContainer = document.getElementById('testimonial-dots');
    if (!dotsContainer) return;

    dotsContainer.innerHTML = '';
    for (let i = 0; i < count; i++) {
        const dot = document.createElement('span');
        dot.style.cssText = `width: 10px; height: 10px; background: ${i === 0 ? 'var(--accent)' : '#ccc'}; border-radius: 50%; cursor: pointer;`;
        dot.onclick = () => {
            const items = document.querySelectorAll('.testimonial-item');
            items.forEach((item, idx) => {
                item.style.display = idx === i ? 'block' : 'none';
            });
            document.querySelectorAll('#testimonial-dots span').forEach((d, idx) => {
                d.style.background = idx === i ? 'var(--accent)' : '#ccc';
            });
        };
        dotsContainer.appendChild(dot);
    }
}

// Infinite Scroll for Categories
function initCategoryScroll() {
    const track = document.getElementById('category-track');
    if (!track) return;

    // Duplicate content for smooth infinite scroll
    track.innerHTML += track.innerHTML;
}

// Load Featured Products (New Arrivals)
async function loadFeaturedProducts(vendorSlug = null) {
    const container = document.getElementById('featured-products');
    if (!container) return;

    try {
        let apiUrl = '/api/marketplace/products?limit=4';
        if (vendorSlug) {
            apiUrl += `&vendor_slug=${vendorSlug}`;
        }

        const response = await fetch(apiUrl);
        const data = await response.json();
        const products = data.products || data;

        container.innerHTML = '';

        if (products.length === 0) {
            container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-secondary);">No products available.</p>';
            return;
        }

        const featured = products.slice(0, 4);

        featured.forEach(p => {
            const card = document.createElement('div');
            card.className = 'product-card animate-fade-in';
            // Using inline styles for card here as we might not have global product card styles in landingpage.css
            // We should ensure brand.css or main.css has it, or add it here.
            // For safety, I'll add a class that relies on main.css or add distinct layout styles here
            card.style.cssText = `
                background: var(--bg-card);
                border: 1px solid var(--border-light);
                border-radius: var(--radius-lg);
                overflow: hidden;
                transition: transform 0.3s;
                cursor: pointer;
            `;

            card.onmouseenter = () => card.style.transform = 'translateY(-5px)';
            card.onmouseleave = () => card.style.transform = 'translateY(0)';
            card.onclick = () => {
                if (vendorSlug) {
                    window.location.href = `/vendor/${vendorSlug}/products.html?id=${p.id}`;
                } else {
                    window.location.href = `/vendor-site/products.html?id=${p.id}`;
                }
            };

            const finalImgUrl = (p.image_url && !p.image_url.startsWith('http') && !p.image_url.startsWith('/') && !p.image_url.startsWith('data:')) ? ('/' + p.image_url) : (p.image_url || '/images/products/placeholder.jpg');

            card.innerHTML = `
                <div style="height: 200px; overflow: hidden;">
                    <img src="${finalImgUrl}" alt="${p.name}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.onerror=null; this.src='data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'300\' height=\'200\'><rect width=\'100%\' height=\'100%\' fill=\'%23222\'/><text x=\'50%\' y=\'50%\' dominant-baseline=\'middle\' text-anchor=\'middle\' font-family=\'sans-serif\' font-size=\'14\' fill=\'%23888\'>No Image</text></svg>'">
                </div>
                <div style="padding: 1.25rem;">
                    <div style="font-size: 0.75rem; color: var(--accent); margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">${p.category}</div>
                    <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.name}</h3>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem;">
                        <span style="font-weight: 700; font-size: 1.25rem; color: var(--primary)">₹${p.price.toFixed(2)}</span>
                        <button class="btn-icon" style="width: 32px; height: 32px; border-radius: 50%; background: var(--bg-light); border: none; color: var(--text-primary); cursor: pointer; display: flex; align-items: center; justify-content: center;">
                            <i class="fas fa-arrow-right"></i>
                        </button>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });

    } catch (error) {
        console.error('Error loading featured products:', error);
        container.innerHTML = '<p style="color: red; text-align: center;">Failed to load new arrivals.</p>';
    }
}

// Update Cart Badge
function updateCartBadge() {
    const badge = document.getElementById('cart-count');
    if (!badge) return;

    const slug = getVendorSlug();
    const cartKey = slug ? `vendor_cart_${slug}` : 'vendor_cart';
    const cart = JSON.parse(localStorage.getItem(cartKey) || '[]');
    const count = cart.reduce((acc, item) => acc + (item.quantity || 1), 0);

    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
}

window.addEventListener('storage', updateCartBadge);
window.addEventListener('cartUpdated', updateCartBadge);
