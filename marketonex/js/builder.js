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

    // Parts Database - Populated from Marketonex API
    const partsDatabase = {};

    // --- Load Products from Marketonex API ---
    console.log('[PC BUILDER] Fetching products from API...');

    try {
        const baseUrl = window.API_BASE_URL || '';
        const response = await fetch(`${baseUrl}/api/marketonex/products`, {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
        }

        const data = await response.json();
        const apiProducts = data.products || [];

        console.log(`[PC BUILDER] Loaded ${apiProducts.length} products from API`);

        // Group products by their product_component field
        apiProducts.forEach(product => {
            // Use product_component field to determine which builder category
            const componentType = product.product_component;

            if (componentType) {
                // Normalize component type (convert to lowercase, handle variations)
                const normalizedComponent = componentType.toLowerCase().trim();

                // Initialize array if not exists
                if (!partsDatabase[normalizedComponent]) {
                    partsDatabase[normalizedComponent] = [];
                }

                // Add product to the appropriate category
                const adaptedProduct = {
                    id: product.product_id || product.id,
                    name: product.product_name,
                    price: parseFloat(product.price) || 0,
                    rating: 4.5, // Default rating if not available
                    image: getProductImage(product),
                    meta: product.brand_name || product.model_number || 'Generic',
                    brand: product.brand_name,
                    model: product.model_number,
                    description: product.product_description,
                    stock: product.available_stock,
                    specs: product.specs ? JSON.parse(product.specs) : {}
                };

                partsDatabase[normalizedComponent].push(adaptedProduct);
            }
        });

        // Log what we found
        console.log('[PC BUILDER] Products grouped by component:');
        Object.keys(partsDatabase).forEach(key => {
            console.log(`  ${key}: ${partsDatabase[key].length} products`);
        });

    } catch (error) {
        console.error('[PC BUILDER] Failed to load products from API:', error);
        alert('Failed to load products. Please refresh the page.');
    }

    // Helper: Get product image
    function getProductImage(product) {
        if (product.product_images) {
            try {
                const images = JSON.parse(product.product_images);
                if (Array.isArray(images) && images.length > 0) {
                    return images[0];
                }
            } catch (e) {
                // If parsing fails, check if it's already a string URL
                if (typeof product.product_images === 'string' && product.product_images.startsWith('http')) {
                    return product.product_images;
                }
            }
        }
        // Return placeholder if no image
        return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="150" height="150"%3E%3Crect fill="%23ddd" width="150" height="150"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3ENo Image%3C/text%3E%3C/svg%3E';
    }

    // Helper: Get Parts - Returns products filtered by component type
    function getParts(category) {
        // Return products from database if available, otherwise empty array
        if (partsDatabase[category] && partsDatabase[category].length > 0) {
            return partsDatabase[category];
        }
        // Return empty array if no products found for this component
        console.warn(`[PC BUILDER] No products found for component: ${category}`);
        return [];
    }

    // State
    let currentBuild = {}; // { 'cpu': partObj, 'memory': [partObj] }

    // Compatibility Logic
    class CompatibilityManager {
        static check(part, build) {
            if (!part.specs) return { compatible: true };
            const issues = [];

            // 1. CPU & Motherboard Socket
            if (part.specs.socket && build.cpu && build.cpu.specs.socket) {
                if (part.specs.socket !== build.cpu.specs.socket) {
                    issues.push(`Socket Mismatch: ${part.specs.socket} vs ${build.cpu.specs.socket}`);
                }
            }
            if (part.specs.socket && build.motherboard && build.motherboard.specs.socket) {
                if (part.specs.socket !== build.motherboard.specs.socket) {
                    issues.push(`Socket Mismatch: ${part.specs.socket} vs ${build.motherboard.specs.socket}`);
                }
            }

            // 2. Motherboard & RAM Type
            if (part.specs.memory_type && build.motherboard && build.motherboard.specs.memory_type) {
                if (part.specs.memory_type !== build.motherboard.specs.memory_type) {
                    issues.push(`Memory Type Mismatch: ${part.specs.memory_type} vs Motherboard's ${build.motherboard.specs.memory_type}`);
                }
            }
            if (build.memory && build.memory.length > 0 && part.specs.memory_type) {
                if (part.specs.memory_type !== build.memory[0].specs.memory_type) {
                    issues.push(`Memory Type Mismatch with already selected RAM`);
                }
            }

            // 3. Power Requirements
            const currentTdp = this.calculateTotalTdp(build);
            if (part.product_component === 'power_supply' && part.specs.wattage) {
                if (part.specs.wattage < currentTdp + 100) {
                    issues.push(`Low Wattage: PSU (${part.specs.wattage}W) may be insufficient for build (~${currentTdp}W + buffer)`);
                }
            }

            return {
                compatible: issues.length === 0,
                issues: issues
            };
        }

        static calculateTotalTdp(build) {
            let total = 0;
            if (build.cpu) total += (build.cpu.specs.tdp || 65);
            if (build.video_card) total += (build.video_card.specs.tdp || 200);
            if (build.memory) build.memory.forEach(() => total += 5);
            if (build.storage) build.storage.forEach(() => total += 10);
            total += 50; // Base system power
            return total;
        }

        static validateTotalBuild(build) {
            const report = { status: 'pass', messages: [] };

            // Check cross-component dependencies
            if (build.cpu && build.motherboard && build.cpu.specs.socket !== build.motherboard.specs.socket) {
                report.status = 'error';
                report.messages.push(`CPU (${build.cpu.specs.socket}) is incompatible with Motherboard (${build.motherboard.specs.socket}).`);
            }

            if (build.motherboard && build.memory && build.memory.length > 0) {
                if (build.motherboard.specs.memory_type !== build.memory[0].specs.memory_type) {
                    report.status = 'error';
                    report.messages.push(`Motherboard supports ${build.motherboard.specs.memory_type}, but ${build.memory[0].specs.memory_type} RAM selected.`);
                }
            }

            const totalWattage = this.calculateTotalTdp(build);
            if (build.power_supply && build.power_supply.specs.wattage < totalWattage + 50) {
                report.status = 'warning';
                report.messages.push(`PSU wattage (${build.power_supply.specs.wattage}W) is very close to or below estimated draw (${totalWattage}W).`);
            }

            return report;
        }
    }

    // DOM Elements
    const builderGrid = document.getElementById('builder-grid');
    const totalPriceEl = document.getElementById('total-price');
    const totalWattageEl = document.getElementById('total-wattage');
    const compatibilityText = document.getElementById('compatibility-text');
    const statusPills = document.querySelectorAll('.status-pill');
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
        let wattage = 0;

        componentCategories.forEach(cat => {
            const parts = currentBuild[cat.id];

            // Handle Multiple Items (Memory/Storage)
            if (cat.isMultiple) {
                const items = Array.isArray(parts) ? parts : [];

                // Render filled slots
                items.forEach((part, index) => {
                    builderGrid.appendChild(createCard(cat, part, index));
                    total += part.price;
                    wattage += (part.tdp || 50); // Mock wattage
                });

                // Always render one empty "Add" slot for multiples
                builderGrid.appendChild(createEmptyCard(cat));
            } else {
                // Single Item
                if (parts) {
                    builderGrid.appendChild(createCard(cat, parts));
                    total += parts.price;
                    wattage += (parts.tdp || 100);
                } else {
                    builderGrid.appendChild(createEmptyCard(cat));
                }
            }
        });

        // Update Totals
        totalPriceEl.textContent = `₹${total.toFixed(2)}`;
        totalWattageEl.textContent = CompatibilityManager.calculateTotalTdp(currentBuild);

        // Update Global Status
        const report = CompatibilityManager.validateTotalBuild(currentBuild);
        updateStatusUI(report);
    }

    function updateStatusUI(report) {
        const compPill = document.getElementById('compatibility-pill');
        if (!compPill) return;

        const compIcon = compPill.querySelector('i');

        if (report.status === 'error') {
            compPill.className = 'status-pill error'; // Need to add CSS for .error
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

        // Render Selection Items
        const parts = getParts(catId);
        selectionGrid.innerHTML = '';

        if (parts.length === 0) {
            // Show empty state message
            selectionGrid.innerHTML = `
                <div style="text-align: center; padding: 3rem; color: var(--text-secondary);">
                    <i class="fas fa-box-open" style="font-size: 4rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                    <h3 style="margin-bottom: 0.5rem;">No ${cat.name} Products Available</h3>
                    <p style="margin-bottom: 1.5rem;">Add products with component type "${catId}" in the marketonex first.</p>
                    <a href="marketonex.html" class="btn" style="display: inline-block; padding: 0.75rem 1.5rem; background: var(--primary); color: white; text-decoration: none; border-radius: 8px;">
                        <i class="fas fa-plus"></i> Go to Marketonex
                    </a>
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
                    ${comp.issues.length > 0 ? `<div class="comp-reason">${comp.issues[0]}</div>` : ''}
                `;

                if (comp.compatible) {
                    item.addEventListener('click', () => {
                        selectPart(catId, part);
                    });
                } else {
                    item.title = comp.issues.join('\n');
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

    // Modal Logic
    function closeModal() {
        overlay.classList.remove('active');
    }

    closeModalBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });

    // Buy All Components
    const buyAllBtn = document.getElementById('buy-all-btn');
    if (buyAllBtn) {
        buyAllBtn.addEventListener('click', () => {
            const flatParts = [];
            Object.values(currentBuild).forEach(val => {
                if (Array.isArray(val)) {
                    flatParts.push(...val);
                } else if (val) { // Ensure it's not null/undefined for single items
                    flatParts.push(val);
                }
            });

            if (flatParts.length === 0) {
                alert('Your build is empty. Please select components first.');
                return;
            }

            let cart = JSON.parse(localStorage.getItem('marketonex_cart') || '[]');
            let count = 0;

            flatParts.forEach(item => {
                // Check if part already in cart (optional, or just add complete unit)
                // Here we just add individual parts as independent items or consolidate?
                // Simple approach: Add each as new item or increment quantity if name matches

                const existingItem = cart.find(c => c.name === item.name);
                if (existingItem) {
                    existingItem.quantity += 1;
                } else {
                    cart.push({
                        id: item.id, // Include ID for better tracking
                        name: item.name,
                        price: item.price,
                        image: item.image,
                        vendor: 'PC Builder', // Or specific vendor if we had it
                        quantity: 1
                    });
                }
                count++;
            });

            localStorage.setItem('marketonex_cart', JSON.stringify(cart));
            if (typeof window.updateCartBadge === 'function') {
                window.updateCartBadge();
            }
            alert(`Added ${count} components to your cart!`);

            // Optional: Redirect to cart
            if (confirm('Go to Cart?')) {
                window.location.href = 'cart.html';
            }
        });
    }
});
