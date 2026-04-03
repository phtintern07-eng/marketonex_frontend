document.addEventListener("DOMContentLoaded", () => {
    const grid = document.getElementById("trackerGrid");
    const searchInput = document.getElementById("searchInput");
    const categoryItems = document.querySelectorAll(".cat-item");
    const activeCategoryText = document.getElementById("activeCategoryText");

    let productsData = [];
    let activeCategory = "All";

    // ── Category keyword mapping (fallback if no category field in data) ──────
    const KEYWORD_MAP = [
        { keywords: ["i9", "i7", "i5", "i3", "ryzen", "core", "processor", "cpu", "athlon", "xeon"], category: "Processor" },
        { keywords: ["motherboard", "mobo", "z790", "b760", "x570", "z690", "lga"], category: "Motherboard" },
        { keywords: ["rtx", "gtx", "rx ", "radeon", "geforce", "gpu", "graphics card", "graphic card"], category: "Graphic Card" },
        { keywords: ["psu", "power supply", "watt", "modular"], category: "Power Supply" },
        { keywords: ["ram", "ddr4", "ddr5", "memory", "dimm"], category: "Memory" },
        { keywords: ["hard drive", "hdd", "hard disk", "seagate", "western digital", "barracuda"], category: "Hard Drive" },
        { keywords: ["ssd", "nvme", "m.2", "solid state"], category: "SSD" },
        { keywords: ["cabinet", "case", "chassis", "mid tower", "full tower"], category: "Cabinet" },
        { keywords: ["monitor", "display", "ips", "4k screen", "led monitor"], category: "Monitor" },
        { keywords: ["cooler", "cooling", "aio", "heatsink", "fan", "liquid cool"], category: "Cooler" },
        { keywords: ["keyboard", "mechanical key"], category: "Keyboard" },
        { keywords: ["mouse", "gaming mouse"], category: "Mouse" },
        { keywords: ["headset", "headphone", "earphone"], category: "Headset" },
        { keywords: ["laptop", "notebook", "ultrabook"], category: "Laptop" },
        { keywords: ["gaming chair", "gaming desk", "controller", "joystick"], category: "Gaming" },
        { keywords: ["ups", "uninterruptible", "power backup"], category: "UPS" },
    ];

    function deriveCategory(product) {
        if (product.category && product.category.trim() !== "") {
            // Normalize: "GPU" → "Graphic Card"
            const raw = product.category.trim();
            if (raw === "GPU") return "Graphic Card";
            return raw;
        }
        // Fallback: keyword match from name + description
        const text = ((product.product_name || "") + " " + (product.description || "")).toLowerCase();
        for (const rule of KEYWORD_MAP) {
            if (rule.keywords.some(kw => text.includes(kw))) {
                return rule.category;
            }
        }
        return "Other";
    }

    // ── Fetch data from Flask proxy ───────────────────────────────────────────
    async function fetchPriceTrackerData() {
        showLoading();
        try {
            const response = await fetch("http://127.0.0.1:5005/api/price-tracker");
            if (!response.ok) throw new Error("Network response was not ok");
            const data = await response.json();
            if (data.status === "success") {
                productsData = data.data.map(p => ({ ...p, category: deriveCategory(p) }));
                renderProducts(filterData());
            } else {
                showError("Failed to load tracking data from API.");
            }
        } catch (error) {
            console.error("Error fetching price tracker data:", error);
            fallbackToMockData();
        }
    }

    // ── Fallback mock data ────────────────────────────────────────────────────
    function fallbackToMockData() {
        console.warn("Using fallback mock data because backend is offline.");

        const fallbackImg = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='8' fill='%23334155'/%3E%3Ctext x='50%25' y='54%25' dominant-baseline='middle' text-anchor='middle' font-size='9' fill='%2394a3b8' font-family='sans-serif'%3ENo Image%3C/text%3E%3C/svg%3E`;

        productsData = [
            {
                "category": "Processor",
                "description": "24 cores, 32 threads, up to 5.8 GHz",
                "image_url": `https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=64&h=64&fit=crop`,
                "product_name": "Intel Core i9-13900K",
                "offers": [
                    { "price": 539.99, "vendor": "Newegg", "currency": "USD", "product_url": "#" },
                    { "price": 549.99, "vendor": "Amazon", "currency": "USD", "product_url": "#" },
                    { "price": 569.00, "vendor": "BestBuy", "currency": "USD", "product_url": "#" }
                ]
            },
            {
                "category": "Graphic Card",
                "description": "24GB GDDR6X, Founders Edition",
                "image_url": `https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=64&h=64&fit=crop`,
                "product_name": "NVIDIA GeForce RTX 4090",
                "offers": [
                    { "price": 1599.99, "vendor": "Amazon", "currency": "USD", "product_url": "#" },
                    { "price": 1649.99, "vendor": "BestBuy", "currency": "USD", "product_url": "#" }
                ]
            },
            {
                "category": "Motherboard",
                "description": "WiFi 6E, LGA 1700 ATX Motherboard",
                "image_url": `https://images.unsplash.com/photo-1518770660439-4636190af475?w=64&h=64&fit=crop`,
                "product_name": "ASUS ROG Maximus Z790 Hero",
                "offers": [
                    { "price": 599.99, "vendor": "MicroCenter", "currency": "USD", "product_url": "#" },
                    { "price": 629.99, "vendor": "Amazon", "currency": "USD", "product_url": "#" }
                ]
            }
        ];

        window._ptFallbackImg = fallbackImg;
        renderProducts(filterData());
    }

    // ── Loading / Error states ────────────────────────────────────────────────
    function showLoading() {
        grid.innerHTML = `<div class="empty-state"><i class="fas fa-spinner fa-spin fa-2x"></i><p>Loading market prices...</p></div>`;
    }

    function showError(msg) {
        grid.innerHTML = `<div class="empty-state" style="color: var(--accent-red)"><i class="fas fa-exclamation-triangle fa-2x"></i><p>${msg}</p></div>`;
    }

    // ── Combined filter logic (search + category) ─────────────────────────────
    function filterData() {
        const query = searchInput.value.toLowerCase().trim();

        return productsData.filter(product => {
            const matchesSearch = !query ||
                product.product_name.toLowerCase().includes(query) ||
                (product.description || "").toLowerCase().includes(query);

            const matchesCategory = activeCategory === "All" || product.category === activeCategory;

            return matchesSearch && matchesCategory;
        });
    }

    // ── Render product cards ──────────────────────────────────────────────────
    function renderProducts(products) {
        grid.innerHTML = "";
        if (products.length === 0) {
            grid.innerHTML = `<div class="empty-state"><p>No products found in this category.</p></div>`;
            return;
        }

        products.forEach(product => {
            const card = document.createElement("div");
            card.className = "product-card";

            const offers = product.offers || [];
            let offersHTML = "";

            if (offers.length > 0) {
                const minPrice = Math.min(...offers.map(o => o.price));

                offers.forEach(offer => {
                    const isBest = offer.price === minPrice;
                    const isExpensive = offer.price > minPrice * 1.05;

                    let itemClass = "offer-item";
                    if (isBest) itemClass += " best-price";
                    if (isExpensive) itemClass += " expensive-price";

                    offersHTML += `
                        <div class="${itemClass}">
                            <div class="offer-vendor">
                                <i class="fas fa-store"></i> ${offer.vendor}
                            </div>
                            <div class="offer-price">
                                ${offer.currency === 'USD' ? '$' : ''}${offer.price}
                            </div>
                            <a href="${offer.product_url}" target="_blank" class="offer-link">Buy</a>
                        </div>
                    `;
                });
            } else {
                offersHTML = `<div class="empty-state" style="padding: 10px;">No offers available.</div>`;
            }

            card.innerHTML = `
                <div class="product-header">
                    <img src="${product.image_url}" alt="${product.product_name}" class="product-image"
                         onerror="this.onerror=null; this.src=window._ptFallbackImg||'https://placehold.co/64x64/png?text=No+Img'">
                    <div class="product-info">
                        <h3 class="product-name">${product.product_name}</h3>
                        <p class="product-desc">${product.description || ""}</p>
                    </div>
                </div>
                ${offers.length > 1 ? '<div class="best-badge">Best Match</div>' : ''}
                <div class="offers-list">
                    ${offersHTML}
                </div>
            `;

            grid.appendChild(card);
        });
    }

    // ── Category sidebar click handling ───────────────────────────────────────
    categoryItems.forEach(item => {
        item.addEventListener("click", () => {
            // Update active state
            categoryItems.forEach(i => i.classList.remove("active"));
            item.classList.add("active");

            activeCategory = item.getAttribute("data-category");
            activeCategoryText.textContent = activeCategory === "All" ? "All Categories" : activeCategory;

            renderProducts(filterData());
        });
    });

    // ── Search input ──────────────────────────────────────────────────────────
    searchInput.addEventListener("input", () => {
        renderProducts(filterData());
    });

    // ── Initial load ──────────────────────────────────────────────────────────
    fetchPriceTrackerData();
});
