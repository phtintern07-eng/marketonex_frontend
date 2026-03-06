document.addEventListener('DOMContentLoaded', () => {
    // --- Theme Toggle ---
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const themeDropdown = document.getElementById('theme-dropdown');
    const body = document.body;

    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);

    function setTheme(theme) {
        body.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);

        const icon = themeToggleBtn.querySelector('i');
        if (theme === 'dark') {
            icon.className = 'fas fa-moon';
        } else {
            icon.className = 'fas fa-sun';
        }
    }

    themeToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        themeDropdown.classList.toggle('hidden');
    });

    themeDropdown.querySelectorAll('button').forEach(button => {
        button.addEventListener('click', () => {
            const theme = button.getAttribute('data-theme');
            setTheme(theme);
            themeDropdown.classList.add('hidden');
        });
    });

    document.addEventListener('click', (e) => {
        if (!themeToggleBtn.contains(e.target) && !themeDropdown.contains(e.target)) {
            themeDropdown.classList.add('hidden');
        }
    });

    // --- Cart Management ---
    const VAT_RATE = 0.05; // 5% VAT
    const SHIPPING_THRESHOLD = 5000;
    const SHIPPING_COST = 100;
    let cart = [];
    let appliedCoupon = null;

    // Coupon codes
    const coupons = {
        'SAVE10': { type: 'percentage', value: 10, description: '10% off' },
        'WELCOME20': { type: 'percentage', value: 20, description: '20% off' },
        'FLAT50': { type: 'fixed', value: 50, description: '₹50 off' }
    };

    // Load cart from localStorage
    function loadCart() {
        const savedCart = localStorage.getItem('marketplace_cart');
        cart = savedCart ? JSON.parse(savedCart) : [];
        renderCart();
        updateSummary();
    }

    // Save cart to localStorage
    function saveCart() {
        localStorage.setItem('marketplace_cart', JSON.stringify(cart));
        if (typeof window.updateCartBadge === 'function') {
            window.updateCartBadge();
        }
    }

    // Render cart items
    function renderCart() {
        const container = document.getElementById('cart-items-container');
        const emptyMessage = document.getElementById('empty-cart-message');

        if (cart.length === 0) {
            container.innerHTML = '';
            emptyMessage.classList.remove('hidden');
            return;
        }

        emptyMessage.classList.add('hidden');
        container.innerHTML = cart.map((item, index) => `
            <div class="cart-item" data-index="${index}">
                <div class="item-image">
                    <img src="${item.image || 'https://picsum.photos/400/400?random=' + index}" alt="${item.name}">
                </div>
                <div class="item-details">
                    <h3 class="item-name">${item.name}</h3>
                    <p class="item-vendor">${item.vendor || 'Unknown Vendor'}</p>
                    <div class="item-controls">
                        <div class="quantity-control">
                            <button class="quantity-btn decrease-btn" data-index="${index}">
                                <i class="fas fa-minus"></i>
                            </button>
                            <span class="quantity-value">${item.quantity}</span>
                            <button class="quantity-btn increase-btn" data-index="${index}">
                                <i class="fas fa-plus"></i>
                            </button>
                        </div>
                        <button class="delete-item-btn" data-index="${index}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="item-price-section">
                    <div class="item-price">₹${(item.price * item.quantity).toFixed(2)}</div>
                    <div class="item-subtotal-label">Total</div>
                </div>
            </div>
        `).join('');

        // Attach event listeners
        attachCartEventListeners();
    }

    // Attach event listeners to cart items
    function attachCartEventListeners() {
        // Increase quantity
        document.querySelectorAll('.increase-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index);
                cart[index].quantity++;
                saveCart();
                renderCart();
                updateSummary();
                animateQuantityChange(btn);
            });
        });

        // Decrease quantity
        document.querySelectorAll('.decrease-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index);
                if (cart[index].quantity > 1) {
                    cart[index].quantity--;
                    saveCart();
                    renderCart();
                    updateSummary();
                    animateQuantityChange(btn);
                }
            });
        });

        // Delete item
        document.querySelectorAll('.delete-item-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index);
                const item = btn.closest('.cart-item');

                // Add removing animation
                item.classList.add('removing');

                setTimeout(() => {
                    cart.splice(index, 1);
                    saveCart();
                    renderCart();
                    updateSummary();
                    showToast('Item removed from cart', 'success');
                }, 400);
            });
        });
    }

    // Animate quantity change
    function animateQuantityChange(button) {
        const priceSection = button.closest('.cart-item').querySelector('.item-price');
        priceSection.style.animation = 'none';
        setTimeout(() => {
            priceSection.style.animation = 'pulse 0.4s ease';
        }, 10);
    }

    // Update order summary
    function updateSummary() {
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const vat = subtotal * VAT_RATE;
        const shipping = subtotal > SHIPPING_THRESHOLD ? 0 : (subtotal > 0 ? SHIPPING_COST : 0);
        let discount = 0;

        if (appliedCoupon) {
            if (appliedCoupon.type === 'percentage') {
                discount = subtotal * (appliedCoupon.value / 100);
            } else {
                discount = appliedCoupon.value;
            }
        }

        const total = subtotal + vat + shipping - discount;

        document.getElementById('subtotal-amount').textContent = `₹${subtotal.toFixed(2)}`;
        document.getElementById('vat-amount').textContent = `₹${vat.toFixed(2)}`;
        document.getElementById('shipping-amount').textContent = shipping === 0 ? 'Free' : `₹${shipping.toFixed(2)}`;
        document.getElementById('total-amount').textContent = `₹${Math.max(0, total).toFixed(2)}`;

        // Update discount display
        const discountRow = document.getElementById('applied-discount');
        if (appliedCoupon && discount > 0) {
            discountRow.classList.remove('hidden');
            document.getElementById('discount-code').textContent = appliedCoupon.code;
            document.getElementById('discount-amount').textContent = `-₹${discount.toFixed(2)}`;
        } else {
            discountRow.classList.add('hidden');
        }
    }

    // Coupon toggle
    const couponToggle = document.getElementById('coupon-toggle');
    const couponForm = document.getElementById('coupon-form');

    couponToggle.addEventListener('click', () => {
        couponForm.classList.toggle('hidden');
        couponToggle.classList.toggle('collapsed');

        const icon = couponToggle.querySelector('i');
        if (couponForm.classList.contains('hidden')) {
            icon.className = 'fas fa-plus';
        } else {
            icon.className = 'fas fa-minus';
        }
    });

    // Apply coupon
    const applyCouponBtn = document.getElementById('apply-coupon-btn');
    const couponInput = document.getElementById('coupon-input');
    const couponMessage = document.getElementById('coupon-message');

    applyCouponBtn.addEventListener('click', () => {
        const code = couponInput.value.trim().toUpperCase();

        if (!code) {
            showCouponMessage('Please enter a coupon code', 'error');
            return;
        }

        if (coupons[code]) {
            appliedCoupon = { ...coupons[code], code };
            showCouponMessage(`Coupon applied! ${coupons[code].description}`, 'success');
            updateSummary();
            couponInput.value = '';
        } else {
            showCouponMessage('Invalid coupon code', 'error');
            appliedCoupon = null;
            updateSummary();
        }
    });

    // Show coupon message
    function showCouponMessage(message, type) {
        couponMessage.textContent = message;
        couponMessage.className = `coupon-message ${type}`;
        couponMessage.classList.remove('hidden');

        setTimeout(() => {
            couponMessage.classList.add('hidden');
        }, 3000);
    }

    // Back to shopping
    document.getElementById('back-to-shopping').addEventListener('click', () => {
        window.location.href = 'marketplace.html'; // Sibling file
    });

    // Checkout
    document.getElementById('checkout-btn').addEventListener('click', () => {
        if (cart.length === 0) {
            showToast('Your cart is empty!', 'error');
            return;
        }

        showToast('Proceeding to checkout...', 'success');

        // Save Coupon State for Checkout
        if (appliedCoupon) {
            localStorage.setItem('appliedCoupon', JSON.stringify(appliedCoupon));
        } else {
            localStorage.removeItem('appliedCoupon');
        }

        // Simulate checkout process
        setTimeout(() => {
            window.location.href = 'checkout.html'; // Redirect to checkout (sibling)
        }, 1000);
    });

    // Toast notification
    function showToast(message, type = 'success') {
        const toast = document.getElementById('toast-notification');
        const toastMessage = document.getElementById('toast-message');

        toastMessage.textContent = message;
        toast.className = `toast-notification ${type}`;
        toast.classList.remove('hidden');

        setTimeout(() => {
            toast.classList.add('hidden');
        }, 3000);
    }

    // Initialize cart
    loadCart();

    // Add CSS animation for pulse
    const style = document.createElement('style');
    style.textContent = `
        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); color: var(--primary-color); }
        }
    `;
    document.head.appendChild(style);
});
