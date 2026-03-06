document.addEventListener('DOMContentLoaded', () => {
    // --- Constants ---
    const SHIPPING_THRESHOLD = 5000;
    const SHIPPING_COST = 100;
    const VAT_RATE = 0.05;

    // --- State ---
    let cart = [];
    let map = null;
    let marker = null;
    let selectedPaymentMethod = 'upi';
    let isPaymentVerified = false;
    let mapUpdateTimer = null; // Debounce timer

    // --- Initialization ---
    checkAuthAndAutofill();
    loadCart();
    initMap();
    setupEventListeners();

    // --- Functions ---

    function checkAuthAndAutofill() {
        const isLoggedIn = localStorage.getItem('vendorLoggedIn') === 'true';

        if (!isLoggedIn) {
            // Not logged in - redirect to login page
            window.location.href = '/vendor/login.html';
            return;
        }

        // Auto-fill details if logged in
        const userName = localStorage.getItem('userName');
        const userEmail = localStorage.getItem('vendorEmail');

        if (userName) {
            const nameInput = document.getElementById('fullname');
            if (nameInput) nameInput.value = userName;
        }

        if (userEmail) {
            const emailInput = document.getElementById('email');
            if (emailInput) emailInput.value = userEmail;
        }
    }

    // Helper to get vendor slug from URL
    function getVendorSlug() {
        const path = window.location.pathname;
        const parts = path.split('/');
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

            // Update navigation brand and page title
            const brands = document.querySelectorAll('.nav-brand');
            brands.forEach(b => {
                b.innerHTML = `<i class="fas fa-microchip"></i> ${vendor.business_name || vendor.fullname}`;
            });
            document.title = `Checkout - ${vendor.business_name || vendor.fullname}`;
        } catch (err) {
            console.error('Failed to load vendor profile:', err);
        }
    }

    function loadCart() {
        const slug = getVendorSlug();
        if (slug) loadVendorProfile(slug);

        const cartKey = slug ? `vendor_cart_${slug}` : 'vendor_cart';
        const savedCart = localStorage.getItem(cartKey);
        cart = savedCart ? JSON.parse(savedCart) : [];

        if (cart.length === 0) {
            const redirectUrl = slug ? `/vendor/${slug}/cart.html` : '/vendor-site/cart.html';
            window.location.href = redirectUrl;
            return;
        }
        renderOrderSummary();
    }

    function renderOrderSummary() {
        const container = document.getElementById('checkout-items');
        container.innerHTML = cart.map((item) => `
            <div class="checkout-item">
                <img src="${item.image || 'https://picsum.photos/400/400?random=' + Math.random()}" alt="${item.name}">
                <div class="checkout-item-details">
                    <h4>${item.name}</h4>
                    <p>Qty: ${item.quantity} × ₹${item.price}</p>
                </div>
                <div style="margin-left: auto; font-weight: 500;">
                    ₹${(item.price * item.quantity).toFixed(2)}
                </div>
            </div>
        `).join('');

        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const vat = subtotal * VAT_RATE;
        const shipping = subtotal > SHIPPING_THRESHOLD ? 0 : (subtotal > 0 ? SHIPPING_COST : 0);

        let discount = 0;
        const savedCoupon = localStorage.getItem('appliedCoupon');
        if (savedCoupon) {
            const coupon = JSON.parse(savedCoupon);
            if (coupon.type === 'percentage') {
                discount = subtotal * (coupon.value / 100);
            } else {
                discount = coupon.value;
            }
        }

        const total = subtotal + vat + shipping - discount;

        document.getElementById('summary-subtotal').textContent = `₹${subtotal.toFixed(2)}`;
        document.getElementById('summary-tax').textContent = `₹${vat.toFixed(2)}`;
        document.getElementById('summary-shipping').textContent = shipping === 0 ? 'Free' : `₹${shipping.toFixed(2)}`;
        document.getElementById('summary-total').textContent = `₹${Math.max(0, total).toFixed(2)}`;
    }

    function initMap() {
        if (!document.getElementById('map')) return;

        // Default to India center
        map = L.map('map').setView([20.5937, 78.9629], 5);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        map.on('click', function (e) {
            handleMapClick(e.latlng);
        });
    }

    function handleMapClick(latlng) {
        if (marker) {
            marker.setLatLng(latlng);
        } else {
            marker = L.marker(latlng).addTo(map);
        }
        map.setView(latlng, 15);

        // Reverse Geocode: Map -> Address Form
        fetchAddress(latlng.lat, latlng.lng);
    }

    // Forward Geocoding: Address Form -> Map
    async function updateMapFromAddress() {
        const area = document.getElementById('area').value;
        const city = document.getElementById('city').value;
        const state = document.getElementById('state').value;
        const pincode = document.getElementById('pincode').value;

        // Need at least Area and City to attempt geocoding
        if (area.length < 3 || city.length < 3) return;

        const query = `${area}, ${city}, ${state || ''}, ${pincode || ''}, India`;

        try {
            const baseUrl = window.API_BASE_URL || '';
            const response = await fetch(`${baseUrl}/api/geocoding/search?q=${encodeURIComponent(query)}`);
            const data = await response.json();

            if (data && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lon = parseFloat(data[0].lon);
                const latlng = new L.LatLng(lat, lon);

                if (marker) {
                    marker.setLatLng(latlng);
                } else {
                    marker = L.marker(latlng).addTo(map);
                }
                map.setView(latlng, 16);
            }
        } catch (e) {
            console.error("Forward geocoding failed", e);
        }
    }

    async function fetchAddress(lat, lng) {
        // Show loading state
        document.getElementById('area').placeholder = "Fetching location...";

        try {
            const baseUrl = window.API_BASE_URL || '';
            const response = await fetch(`${baseUrl}/api/geocoding/reverse?lat=${lat}&lon=${lng}`);

            if (!response.ok) throw new Error('Nominatim failed');

            const data = await response.json();
            if (data && data.address) {
                fillAddressFields(data.address);
                return;
            }
        } catch (e) {
            console.warn('Reverse geocoding failed');
            // Allow manual entry
            unlockAddressFields();
        }
    }

    function fillAddressFields(addr) {
        const houseInput = document.getElementById('house-no');
        const buildingInput = document.getElementById('building');
        const areaInput = document.getElementById('area');
        const cityInput = document.getElementById('city');
        const stateInput = document.getElementById('state');
        const zipInput = document.getElementById('pincode');

        // Reset manual entry requirement
        unlockAddressFields();

        houseInput.value = addr.house_number || '';
        buildingInput.value = addr.building || '';

        // Combine road/neighborhood for Area
        const areaParts = [addr.road, addr.neighbourhood, addr.suburb].filter(Boolean);
        areaInput.value = areaParts.join(', ');

        cityInput.value = addr.city || addr.town || addr.village || addr.county || '';
        stateInput.value = addr.state || '';
        zipInput.value = addr.postcode || '';

        // Flash inputs to show update
        [houseInput, buildingInput, areaInput, cityInput, stateInput, zipInput].forEach(el => {
            el.parentElement.classList.add('flash-highlight');
            setTimeout(() => el.parentElement.classList.remove('flash-highlight'), 500);
        });
    }

    function unlockAddressFields() {
        document.getElementById('house-no').removeAttribute('readonly');
        document.getElementById('building').removeAttribute('readonly');
        document.getElementById('area').removeAttribute('readonly');
        document.getElementById('city').removeAttribute('readonly');
        document.getElementById('state').removeAttribute('readonly');
        document.getElementById('pincode').removeAttribute('readonly');
    }

    function setupEventListeners() {
        // Locate Me
        const locateBtn = document.getElementById('locate-me-btn');
        if (locateBtn) {
            locateBtn.addEventListener('click', () => {
                if (!navigator.geolocation) {
                    alert('Geolocation is not supported by your browser');
                    return;
                }

                locateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Locating...';

                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const latlng = { lat: position.coords.latitude, lng: position.coords.longitude };
                        handleMapClick(latlng);
                        locateBtn.innerHTML = '<i class="fas fa-check"></i> Location Found';
                        setTimeout(() => {
                            locateBtn.innerHTML = '<i class="fas fa-crosshairs"></i> Use My Current Location';
                        }, 2000);
                    },
                    (error) => {
                        console.warn('Geolocation failed:', error);
                        alert('Could not get your location. Please enter manually.');
                        locateBtn.innerHTML = '<i class="fas fa-crosshairs"></i> Use My Current Location';
                        unlockAddressFields();
                    },
                    { enableHighAccuracy: true, timeout: 10000 }
                );
            });
        }

        // Strict Mobile Validation (10 digits only)
        const mobileInput = document.getElementById('mobile');
        mobileInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
            if (e.target.value.length > 10) e.target.value = e.target.value.slice(0, 10);
        });

        // Map Sync: Address Input -> Map (Debounced)
        const addressInputs = ['area', 'city', 'state', 'pincode'];
        addressInputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', () => {
                    clearTimeout(mapUpdateTimer);
                    mapUpdateTimer = setTimeout(updateMapFromAddress, 1500);
                });
            }
        });

        // Payment Toggle
        document.querySelectorAll('input[name="payment"]').forEach(input => {
            input.addEventListener('change', (e) => {
                selectedPaymentMethod = e.target.value;
                document.querySelectorAll('.payment-content').forEach(el => el.classList.add('hidden'));

                if (selectedPaymentMethod === 'upi') {
                    document.getElementById('upi-content').classList.remove('hidden');
                } else if (selectedPaymentMethod === 'card') {
                    document.getElementById('card-content').classList.remove('hidden');
                }
            });
        });

        // UPI Verify
        document.getElementById('verify-upi-btn').addEventListener('click', () => {
            const upiId = document.getElementById('upi-id').value;
            const msg = document.getElementById('upi-msg');
            if (upiId.includes('@')) {
                msg.textContent = "Verified ✓";
                msg.className = "validation-msg success";
                isPaymentVerified = true;
            } else {
                msg.textContent = "Invalid UPI ID";
                msg.className = "validation-msg error";
                isPaymentVerified = false;
            }
            msg.classList.remove('hidden');
        });

        // Form Submit
        document.getElementById('checkout-form').addEventListener('submit', (e) => {
            e.preventDefault();
            if (validateForm()) processOrder();
        });

        // Continue Shopping (Modal)
        const finishBtn = document.getElementById('finish-btn');
        if (finishBtn) {
            finishBtn.addEventListener('click', () => {
                const slug = getVendorSlug();
                if (slug) {
                    window.location.href = `/vendor/${slug}/orders.html`;
                } else {
                    window.location.href = '/vendor-site/orders.html';
                }
            });
        }
    }

    function validateForm() {
        // 1. Mobile Number Check
        const mobile = document.getElementById('mobile').value;
        if (mobile.length !== 10) {
            alert('Please enter a valid 10-digit mobile number.');
            document.getElementById('mobile').focus();
            return false;
        }

        // 2. Address Check
        if (!document.getElementById('area').value || !document.getElementById('house-no').value) {
            alert('Please complete your address details.');
            return false;
        }

        // 3. Payment
        if (selectedPaymentMethod === 'upi' && !isPaymentVerified) {
            alert('Please verify your UPI ID.');
            return false;
        }
        if (selectedPaymentMethod === 'card') {
            const num = document.getElementById('card-number').value;
            if (num.length < 16) {
                alert('Invalid Card Number');
                return false;
            }
        }

        // 4. Terms and Conditions
        if (!document.getElementById('terms-check').checked) {
            alert('You must accept the Terms and Conditions to proceed.');
            return false;
        }

        return true;
    }

    async function processOrder() {
        const overlay = document.getElementById('processing-overlay');
        overlay.classList.remove('hidden');

        try {
            // Calculate order totals
            const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const vat = subtotal * VAT_RATE;
            const shipping = subtotal > SHIPPING_THRESHOLD ? 0 : (subtotal > 0 ? SHIPPING_COST : 0);

            let discount = 0;
            const savedCoupon = localStorage.getItem('appliedCoupon');
            if (savedCoupon) {
                const coupon = JSON.parse(savedCoupon);
                if (coupon.type === 'percentage') {
                    discount = subtotal * (coupon.value / 100);
                } else {
                    discount = coupon.value;
                }
            }

            const total = subtotal + vat + shipping - discount;

            // Create Order Object
            const orderId = 'ORD-' + Date.now() + Math.floor(Math.random() * 1000);
            const orderDate = new Date().toISOString();

            const newOrder = {
                order_id: orderId,
                created_at: orderDate,
                status: 'pending', // Default status
                fullname: document.getElementById('fullname').value,
                email: document.getElementById('email').value,
                mobile: document.getElementById('mobile').value,
                house_no: document.getElementById('house-no').value,
                building: document.getElementById('building').value,
                area: document.getElementById('area').value,
                landmark: document.getElementById('landmark').value || '',
                city: document.getElementById('city').value,
                state: document.getElementById('state').value,
                pincode: document.getElementById('pincode').value,
                payment_method: selectedPaymentMethod,
                payment_id: selectedPaymentMethod === 'upi' ? document.getElementById('upi-id').value :
                    (selectedPaymentMethod === 'card' ? 'CARD-' + Date.now() : 'COD'),
                subtotal: subtotal,
                tax: vat,
                shipping: shipping,
                total: total,
                items: cart.map(item => ({
                    product_id: item.id || item.product_id || 'unknown',
                    product_type: item.product_type || 'marketplace',
                    product_name: item.name,
                    quantity: item.quantity,
                    price: item.price,
                    image: item.image || '',
                    vendor_id: item.vendor_id || 'unknown'
                }))
            };

            // Simulating network delay
            await new Promise(resolve => setTimeout(resolve, 1500));

            // --- BACKEND API CALL ---
            const apiResponse = await fetch('/api/orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    ...newOrder,
                    order_source: 'vendor_site'
                })
            });

            if (!apiResponse.ok) {
                const errorData = await apiResponse.json();
                throw new Error(errorData.error || 'Server error');
            }

            const apiResult = await apiResponse.json();
            const createdOrder = apiResult.order;
            console.log('Order created on backend:', createdOrder.order_id);

            // Clear cart
            const slug = getVendorSlug();
            const cartKey = slug ? `vendor_cart_${slug}` : 'vendor_cart';
            localStorage.removeItem(cartKey);
            localStorage.removeItem('appliedCoupon');

            // Success - Show Modal
            overlay.classList.add('hidden');

            // Update Modal Content
            document.getElementById('success-order-id').textContent = '#' + createdOrder.order_id;
            document.getElementById('success-pay-id').textContent = createdOrder.payment_id;

            const successOverlay = document.getElementById('order-success-overlay');
            successOverlay.classList.remove('hidden');

        } catch (error) {
            console.error('Error creating order:', error);
            overlay.classList.add('hidden');
            alert('Failed to place order: ' + error.message);
        }
    }
});
