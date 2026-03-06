document.addEventListener('DOMContentLoaded', async () => {
    // --- Configuration ---
    const componentCategories = [
        { id: 'cpu', name: 'CPU', icon: 'fa-microchip' },
        { id: 'cpu_cooler', name: 'CPU Cooler', icon: 'fa-snowflake' },
        { id: 'motherboard', name: 'Motherboard', icon: 'fa-chess-board' },
        { id: 'memory', name: 'Memory', icon: 'fa-memory', isMultiple: true },
        { id: 'storage', name: 'Storage', icon: 'fa-hdd', isMultiple: true },
        { id: 'video_card', name: 'Video Card', icon: 'fa-gamepad' },
        { id: 'case', name: 'Case', icon: 'fa-box' },
        { id: 'power_supply', name: 'Power Supply', icon: 'fa-plug' },
        { id: 'os', name: 'Operating System', icon: 'fa-compact-disc' },
        { id: 'monitor', name: 'Monitor', icon: 'fa-desktop' },
        { id: 'peripherals', name: 'Peripherals', icon: 'fa-keyboard' },
        { id: 'accessories', name: 'Accessories', icon: 'fa-headphones' }
    ];

    // Parts Database - Populated from Vendor Context
    const partsDatabase = {};

    // --- Load Products from API (Using same logic as products.html) ---
    console.log('[VENDOR BUILDER] Fetching products from API...');

    try {
        // Use the same query param as products.html to get relevant products
        const response = await fetch('/api/marketplace/products?is_published=true');

        if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
        }

        const data = await response.json();
        const apiProducts = data.products || [];

        console.log(`[VENDOR BUILDER] Loaded ${apiProducts.length} products from API`);

        // Group products by their product_component field
        apiProducts.forEach(product => {
            const componentType = product.product_component;

            if (componentType) {
                const normalizedComponent = componentType.toLowerCase().trim();

                if (!partsDatabase[normalizedComponent]) {
                    partsDatabase[normalizedComponent] = [];
                }

                const adaptedProduct = {
                    id: product.product_id || product.id,
                    name: product.product_name,
                    price: parseFloat(product.price) || 0,
                    rating: 4.5,
                    image: product.image_url || '/images/products/placeholder.jpg',
                    meta: product.brand_name || product.model_number || 'Generic',
                    brand: product.brand_name,
                    model: product.model_number,
                    description: product.product_description,
                    stock: product.available_stock,
                    vendor: product.company_name || 'Vendor',
                    specs: product.specs ? (typeof product.specs === 'string' ? JSON.parse(product.specs) : product.specs) : {}
                };

                partsDatabase[normalizedComponent].push(adaptedProduct);
            }
        });

    } catch (error) {
        console.error('[VENDOR BUILDER] Failed to load products:', error);
        alert('Failed to load products. Please refresh the page.');
    }

    // Helper: Get Parts
    function getParts(category) {
        if (partsDatabase[category] && partsDatabase[category].length > 0) {
            return partsDatabase[category];
        }
        return [];
    }

    // State
    let currentBuild = {};

    // Compatibility Logic (Same as Marketplace)
    class CompatibilityManager {
        static check(part, build) {
            if (!part.specs) return { compatible: true };
            const issues = [];

            // 1. CPU & Motherboard Socket
            if (part.specs.socket && build.cpu && build.cpu.specs && build.cpu.specs.socket) {
                if (part.specs.socket !== build.cpu.specs.socket) {
                    issues.push(`Socket Mismatch: ${part.specs.socket} vs ${build.cpu.specs.socket}`);
                }
            }
            if (part.specs.socket && build.motherboard && build.motherboard.specs && build.motherboard.specs.socket) {
                if (part.specs.socket !== build.motherboard.specs.socket) {
                    issues.push(`Socket Mismatch: ${part.specs.socket} vs ${build.motherboard.specs.socket}`);
                }
            }

            // 2. Motherboard & RAM Type
            if (part.specs.memory_type && build.motherboard && build.motherboard.specs && build.motherboard.specs.memory_type) {
                if (part.specs.memory_type !== build.motherboard.specs.memory_type) {
                    issues.push(`Memory Type Mismatch: ${part.specs.memory_type} vs Motherboard`);
                }
            }

            return {
                compatible: issues.length === 0,
                issues: issues
            };
        }

        static calculateTotalTdp(build) {
            let total = 0;
            if (build.cpu && build.cpu.specs) total += (build.cpu.specs.tdp || 65);
            if (build.video_card && build.video_card.specs) total += (build.video_card.specs.tdp || 200);
            if (build.memory) build.memory.forEach(() => total += 5);
            if (build.storage) build.storage.forEach(() => total += 10);
            total += 50;
            return total;
        }

        static validateTotalBuild(build) {
            const report = { status: 'pass', messages: [] };

            // Simple validation hooks
            const totalWattage = this.calculateTotalTdp(build);
            if (build.power_supply && build.power_supply.specs && build.power_supply.specs.wattage < totalWattage + 50) {
                report.status = 'warning';
                report.messages.push(`PSU wattage is close to estimated draw.`);
            }

            return report;
        }
    }

    // DOM Elements
    const builderGrid = document.getElementById('builder-grid');
    const totalPriceEl = document.getElementById('total-price');
    const totalWattageEl = document.getElementById('total-wattage');
    const compatibilityText = document.getElementById('compatibility-text');
    const overlay = document.getElementById('part-selection-overlay');
    const selectionGrid = document.getElementById('selection-grid');
    const selectionTitle = document.getElementById('selection-category-title');
    const closeModalBtn = document.getElementById('close-selection-modal');

    // Init
    renderBuilderGrid();

    // Render Main Grid
    function renderBuilderGrid() {
        builderGrid.innerHTML = '';
        let total = 0;

        componentCategories.forEach(cat => {
            const parts = currentBuild[cat.id];

            if (cat.isMultiple) {
                const items = Array.isArray(parts) ? parts : [];
                items.forEach((part, index) => {
                    builderGrid.appendChild(createCard(cat, part, index));
                    total += part.price;
                });
                builderGrid.appendChild(createEmptyCard(cat));
            } else {
                if (parts) {
                    builderGrid.appendChild(createCard(cat, parts));
                    total += parts.price;
                } else {
                    builderGrid.appendChild(createEmptyCard(cat));
                }
            }
        });

        totalPriceEl.textContent = `₹${total.toFixed(2)}`;
        if (totalWattageEl) totalWattageEl.textContent = CompatibilityManager.calculateTotalTdp(currentBuild);

        const report = CompatibilityManager.validateTotalBuild(currentBuild);
        updateStatusUI(report);
    }

    function updateStatusUI(report) {
        const compPill = document.getElementById('compatibility-pill');
        if (!compPill) return;

        const compIcon = compPill.querySelector('i');
        if (report.status === 'error') {
            compPill.className = 'status-pill error';
            compIcon.className = 'fas fa-exclamation-triangle';
            compatibilityText.textContent = `Compatibility: ${report.messages[0] || 'Error'}`;
        } else if (report.status === 'warning') {
            compPill.className = 'status-pill warning';
            compIcon.className = 'fas fa-exclamation-circle';
            compatibilityText.textContent = `Compatibility: ${report.messages[0] || 'Warning'}`;
        } else {
            compPill.className = 'status-pill success';
            compIcon.className = 'fas fa-check-circle';
            compatibilityText.textContent = 'Compatibility: Pass';
        }
    }

    function createEmptyCard(cat) {
        const div = document.createElement('div');
        div.className = 'component-card empty';
        div.innerHTML = `
            <div class="card-header">
                <span class="component-type">${cat.name}</span>
                <i class="fas ${cat.icon} card-icon"></i>
            </div>
            <div class="empty-state-content">
                <i class="fas fa-plus-circle" style="font-size: 3em;"></i>
                <p>No ${cat.name} Selected</p>
            </div>
            <button class="add-component-btn" onclick="openSelection('${cat.id}')">
                <i class="fas fa-plus"></i> Add ${cat.name}
            </button>
        `;
        return div;
    }

    function createCard(cat, part, index = null) {
        const div = document.createElement('div');
        div.className = 'component-card filled';
        const removeFn = index !== null ? `removePart('${cat.id}', ${index})` : `removePart('${cat.id}')`;

        div.innerHTML = `
            <div class="card-header">
                <span class="component-type">${cat.name}</span>
                <i class="fas ${cat.icon} card-icon"></i>
            </div>
            <div class="product-preview">
                <img src="${part.image}" alt="${part.name}" class="product-img">
                <h3 class="product-name">${part.name}</h3>
                <span class="product-price">₹${part.price.toFixed(2)}</span>
            </div>
            <div class="card-actions">
                <button class="action-btn edit" onclick="openSelection('${cat.id}')">Change</button>
                <button class="action-btn remove" onclick="${removeFn}">Remove</button>
            </div>
        `;
        return div;
    }

    // Global Actions
    window.removePart = (catId, index = null) => {
        if (index !== null) {
            currentBuild[catId].splice(index, 1);
        } else {
            delete currentBuild[catId];
        }
        renderBuilderGrid();
    };

    window.openSelection = (catId) => {
        const cat = componentCategories.find(c => c.id === catId);
        selectionTitle.textContent = `Select ${cat.name}`;

        const parts = getParts(catId);
        selectionGrid.innerHTML = '';

        if (parts.length === 0) {
            selectionGrid.innerHTML = `
                <div style="text-align: center; padding: 3rem; color: var(--text-secondary);">
                    <i class="fas fa-box-open" style="font-size: 4rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                    <h3 style="margin-bottom: 0.5rem;">No ${cat.name} Products Available</h3>
                    <p style="margin-bottom: 1.5rem;">Check back later for stock.</p>
                </div>
            `;
        } else {
            parts.forEach(part => {
                const comp = CompatibilityManager.check(part, currentBuild);
                const item = document.createElement('div');
                item.className = `selection-item ${comp.compatible ? '' : 'incompatible-part'}`;

                item.innerHTML = `
                    <div class="part-badge ${comp.compatible ? 'comp-ok' : 'comp-err'}">
                        ${comp.compatible ? 'Compatible' : 'Incompatible'}
                    </div>
                    <img src="${part.image}" alt="${part.name}">
                    <h4>${part.name}</h4>
                    <div class="price">₹${part.price.toFixed(2)}</div>
                `;

                if (comp.compatible) {
                    item.addEventListener('click', () => {
                        selectPart(catId, part);
                    });
                }
                selectionGrid.appendChild(item);
            });
        }

        overlay.classList.add('active');
    };

    function selectPart(catId, part) {
        const cat = componentCategories.find(c => c.id === catId);
        if (cat.isMultiple) {
            if (!currentBuild[catId]) currentBuild[catId] = [];
            currentBuild[catId].push(part);
        } else {
            currentBuild[catId] = part;
        }
        closeModal();
        renderBuilderGrid();
    }

    function closeModal() {
        overlay.classList.remove('active');
    }

    closeModalBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });

    // Buy All Components - Vendor Cart Logic
    const buyAllBtn = document.getElementById('buy-all-btn');
    if (buyAllBtn) {
        buyAllBtn.addEventListener('click', () => {
            const flatParts = [];
            Object.values(currentBuild).forEach(val => {
                if (Array.isArray(val)) {
                    flatParts.push(...val);
                } else if (val) {
                    flatParts.push(val);
                }
            });

            if (flatParts.length === 0) {
                alert('Your build is empty. Please select components first.');
                return;
            }

            // USE VENDOR CART STORAGE
            let cart = JSON.parse(localStorage.getItem('vendor_cart') || '[]');
            let count = 0;

            flatParts.forEach(item => {
                const existing = cart.find(c => c.id === item.id);
                if (existing) {
                    existing.quantity += 1;
                } else {
                    cart.push({
                        id: item.id,
                        name: item.name,
                        price: item.price,
                        image: item.image,
                        vendor: item.vendor,
                        quantity: 1
                    });
                }
                count++;
            });

            localStorage.setItem('vendor_cart', JSON.stringify(cart));
            alert(`Added ${count} components to your Vendor Cart!`);

            if (confirm('Go to Cart?')) {
                window.location.href = '/vendor-site/cart.html';
            }
        });
    }
});
