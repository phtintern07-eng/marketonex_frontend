document.addEventListener('DOMContentLoaded', () => {
    // --- Theme Loader ---
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);

    // --- Constants ---
    const MAP_API_KEY = 'd6b961e852ba08ddc2f9d888e156b5d0';
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
    let sessionUser = null;   // Populated by checkAuthAndAutofill; used by processOrder

    // --- Initialization ---
    checkAuthAndAutofill();
    loadCart();
    initMap();
    setupEventListeners();

    // --- Functions ---

    async function checkAuthAndAutofill() {
        try {
            // Verify session server-side — don't rely on localStorage flags
            const res = await fetch('/api/auth/status', { credentials: 'include' });
            const data = await res.json();

            if (!res.ok || !data.isAuthenticated) {
                // Not logged in — redirect to marketplace login
                sessionStorage.setItem('returnAfterLogin', window.location.href);
                window.location.href = 'login.html';
                return;
            }

            sessionUser = data.user || {};

            // Auto-fill name and email from session data (read-only so user can't accidentally change email)
            const nameInput = document.getElementById('fullname');
            const emailInput = document.getElementById('email');

            if (nameInput && (sessionUser.name || sessionUser.fullname)) {
                nameInput.value = sessionUser.name || sessionUser.fullname || '';
            }
            if (emailInput && sessionUser.email) {
                emailInput.value = sessionUser.email;
                emailInput.setAttribute('readonly', 'readonly'); // prevent accidental email mismatch
            }
        } catch (err) {
            console.warn('[Checkout] Auth check failed, assuming guest mode', err);
        }
    }

    function loadCart() {
        const savedCart = localStorage.getItem('marketplace_cart');
        cart = savedCart ? JSON.parse(savedCart) : [];

        if (cart.length === 0) {
            window.location.href = 'cart.html';
            return;
        }
        renderOrderSummary();
    }

    function renderOrderSummary() {
        const container = document.getElementById('checkout-items');
        container.innerHTML = cart.map((item) => `
            <div class="checkout-item">
                <img src="${item.image || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgcHJlc2VydmVBc3BlY3RSYXRpbz0ieE1pZFlNaWQgc2xpY2UiIGZvY3VzYWJsZT0iZmFsc2UiIHJvbGU9ImltZyIgYXJpYS1sYWJlbD0iUGxhY2Vob2xkZXIiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNlZWUiPjwvcmVjdD48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZmlsbD0iI2FhYSIgZHk9Ii4zZW0iIHN0eWxlPSJmb250LWZhbWlseTpBcmlhbDtmb250LXNpemU6MTBweDt0ZXh0LWFuY2hvcjptaWRkbGUiPk5vPC90ZXh0Pjwvc3ZnPg=='}" alt="${item.name}">
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

        if (discount > 0) {
            // Check if discount row already exists to avoid dupes
            if (!document.getElementById('discount-row-display')) {
                const discountRow = document.createElement('div');
                discountRow.id = 'discount-row-display';
                discountRow.className = 'row';
                discountRow.style.color = 'var(--primary-color)';
                discountRow.innerHTML = `<span>Discount</span><span>-₹${discount.toFixed(2)}</span>`;
                const totalRow = container.parentElement.querySelector('.total-row');
                totalRow.parentNode.insertBefore(discountRow, totalRow);
            }
        }
    }

    function initMap() {
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
        console.log("Geocoding Query:", query);

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

        // Best effort mapping logic
        // Nominatim fields: house_number, road, neighbourhood, suburb, city, state, postcode

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
        // Remove readonly if it was set (though we removed it in HTML for this task, good safety)
        document.getElementById('house-no').removeAttribute('readonly');
        document.getElementById('building').removeAttribute('readonly');
        document.getElementById('area').removeAttribute('readonly');
        document.getElementById('city').removeAttribute('readonly');
        document.getElementById('state').removeAttribute('readonly');
        document.getElementById('pincode').removeAttribute('readonly');
    }

    function setupEventListeners() {
        // Locate Me
        document.getElementById('locate-me-btn').addEventListener('click', () => {
            const btn = document.getElementById('locate-me-btn');

            console.log('[GEOLOCATION] Button clicked');
            console.log('[GEOLOCATION] navigator.geolocation available:', !!navigator.geolocation);
            console.log('[GEOLOCATION] Current protocol:', window.location.protocol);
            console.log('[GEOLOCATION] Is secure context:', window.isSecureContext);

            if (!navigator.geolocation) {
                console.error('[GEOLOCATION] Geolocation API not supported by browser');
                const originalText = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-times"></i> Geo Not Supported';
                btn.classList.add('btn-error');
                setTimeout(() => {
                    btn.innerHTML = originalText;
                    btn.classList.remove('btn-error');
                }, 2000);
                return;
            }

            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Locating...';
            console.log('[GEOLOCATION] Requesting current position...');

            const options = {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            };

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    console.log('[GEOLOCATION] ✅ Success! Position:', position);
                    console.log('[GEOLOCATION] Latitude:', position.coords.latitude);
                    console.log('[GEOLOCATION] Longitude:', position.coords.longitude);
                    console.log('[GEOLOCATION] Accuracy:', position.coords.accuracy, 'meters');

                    const latlng = { lat: position.coords.latitude, lng: position.coords.longitude };
                    handleMapClick(latlng);
                    btn.innerHTML = '<i class="fas fa-check"></i> Location Found';
                    setTimeout(() => {
                        btn.innerHTML = '<i class="fas fa-crosshairs"></i> Use My Current Location';
                    }, 2000);
                },
                (error) => {
                    console.warn('[GEOLOCATION] Geolocation request status:', error.code, error.message);

                    // Detailed error handling
                    let errorMsg = '';
                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            errorMsg = 'Location access denied by user';
                            console.info('[GEOLOCATION] User denied the request for Geolocation.');
                            break;
                        case error.POSITION_UNAVAILABLE:
                            errorMsg = 'Location information unavailable';
                            console.warn('[GEOLOCATION] Location information is unavailable.');
                            break;
                        case error.TIMEOUT:
                            errorMsg = 'Geolocation request timed out';
                            console.warn('[GEOLOCATION] The request to get user location timed out.');
                            break;
                        default:
                            errorMsg = 'An unknown geolocation error occurred';
                            console.warn('[GEOLOCATION] An unknown error occurred.');
                            break;
                    }

                    console.info('[GEOLOCATION] Falling back to manual entry');
                    unlockAddressFields(); // Enable manual entry
                    document.getElementById('house-no').focus(); // Auto-focus first field

                    btn.innerHTML = '<i class="fas fa-keyboard"></i> Enter Details Manually';
                    btn.classList.add('btn-warning'); // Use warning style instead of error

                    setTimeout(() => {
                        btn.innerHTML = '<i class="fas fa-crosshairs"></i> Use My Current Location';
                        btn.classList.remove('btn-warning');
                    }, 4000);
                },
                options
            );
        });

        // Strict Mobile Validation (10 digits only)
        const mobileInput = document.getElementById('mobile');
        mobileInput.addEventListener('input', (e) => {
            // Remove non-numeric
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
            // Limit to 10
            if (e.target.value.length > 10) e.target.value = e.target.value.slice(0, 10);
        });

        // Map Sync: Address Input -> Map (Debounced)
        const addressInputs = ['area', 'city', 'state', 'pincode'];
        addressInputs.forEach(id => {
            document.getElementById(id).addEventListener('input', () => {
                clearTimeout(mapUpdateTimer);
                mapUpdateTimer = setTimeout(updateMapFromAddress, 1500); // Wait 1.5s after typing stops
            });
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

            // Map frontend field names to backend expected names
            const orderData = {
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
                    (selectedPaymentMethod === 'card' ? document.getElementById('card-number').value : 'COD'),
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
                    vendor_id: item.vendor_id || 'unknown'
                }))
            };

            console.log('Sending order to backend:', orderData);

            // Call backend API
            const baseUrl = window.API_BASE_URL || '';
            const response = await fetch(`${baseUrl}/api/orders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(orderData)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to create order');
            }

            console.log('Order created successfully:', result);

            // --- UNIFIED ORDER SYNC: Save to localStorage ---
            try {
                const allOrders = JSON.parse(localStorage.getItem('allOrders') || '[]');

                // Add unique order details for dashboard rendering
                const unifiedOrder = {
                    ...orderData,
                    order_id: result.order.order_id,
                    created_at: new Date().toISOString(),
                    status: 'pending'
                };

                allOrders.unshift(unifiedOrder);
                localStorage.setItem('allOrders', JSON.stringify(allOrders));
                console.log('Order synced to unified storage:', result.order.order_id);
            } catch (e) {
                console.warn('Failed to save order to unified storage', e);
            }

            // Clear cart
            localStorage.removeItem('marketplace_cart');
            localStorage.removeItem('appliedCoupon');

            if (typeof window.updateCartBadge === 'function') {
                window.updateCartBadge();
            }

            // Redirect to confirmation page
            window.location.href = `order-confirmation.html?orderId=${result.order.order_id}&payId=${orderData.payment_id}`;

        } catch (error) {
            console.error('Error creating order:', error);
            overlay.classList.add('hidden');
            alert('Failed to place order: ' + error.message + '\n\nPlease try again or contact support.');
        }
    }
});
