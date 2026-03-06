/**
 * MarketplaceStorage - IndexedDB Manager
 * Handles storage of products to bypass LocalStorage limits (5MB).
 */

const MarketplaceStorage = {
    dbName: 'MarketplaceDB',
    storeName: 'products',
    dbVersion: 1,
    db: null,
    useLocalStorage: false, // Fallback flag

    /**
     * Initialize the database connection
     */
    init() {
        return new Promise((resolve, reject) => {
            if (this.db) return resolve(this.db);

            // Check if IndexedDB is available
            if (!window.indexedDB) {
                console.warn('IndexedDB not available, falling back to localStorage');
                this.useLocalStorage = true;
                return resolve(null);
            }

            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = (event) => {
                console.error('MarketplaceDB error:', event.target.error);
                console.warn('Falling back to localStorage');
                this.useLocalStorage = true;
                resolve(null);
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('MarketplaceDB Initialized');

                // Optional: Check if migration is needed
                this._migrateFromLocalStorage().then(() => resolve(this.db));
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'id' });
                }
            };
        });
    },

    /**
     * Get all products from the store
     */
    getAllProducts() {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.db) await this.init();

                // Use localStorage fallback if IndexedDB failed
                if (this.useLocalStorage) {
                    const data = localStorage.getItem('marketplaceProducts');
                    resolve(data ? JSON.parse(data) : []);
                    return;
                }

                const transaction = this.db.transaction([this.storeName], 'readonly');
                const store = transaction.objectStore(this.storeName);
                const request = store.getAll();

                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => {
                    console.warn('IndexedDB read failed, falling back to localStorage');
                    const data = localStorage.getItem('marketplaceProducts');
                    resolve(data ? JSON.parse(data) : []);
                };
            } catch (error) {
                console.error('getAllProducts error:', error);
                const data = localStorage.getItem('marketplaceProducts');
                resolve(data ? JSON.parse(data) : []);
            }
        });
    },

    /**
     * Save a product (Insert or Update)
     */
    saveProduct(product) {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.db) await this.init();

                // Use localStorage fallback if IndexedDB failed
                if (this.useLocalStorage) {
                    const data = localStorage.getItem('marketplaceProducts');
                    const products = data ? JSON.parse(data) : [];
                    const index = products.findIndex(p => p.id === product.id);

                    if (index >= 0) {
                        products[index] = product;
                    } else {
                        products.push(product);
                    }

                    try {
                        localStorage.setItem('marketplaceProducts', JSON.stringify(products));
                        resolve(product.id);
                    } catch (e) {
                        if (e.name === 'QuotaExceededError') {
                            reject(new Error('Storage quota exceeded. Please clear some data.'));
                        } else {
                            reject(e);
                        }
                    }
                    return;
                }

                const transaction = this.db.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);
                const request = store.put(product);

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            } catch (error) {
                reject(error);
            }
        });
    },

    /**
     * Delete a product by ID
     */
    deleteProduct(id) {
        return new Promise(async (resolve, reject) => {
            if (!this.db) await this.init();

            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(id);

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Internal: Migrate legacy data from localStorage if exists
     */
    _migrateFromLocalStorage() {
        return new Promise((resolve) => {
            const localData = localStorage.getItem('marketplaceProducts');
            if (!localData) return resolve();

            try {
                const products = JSON.parse(localData);
                if (products.length === 0) return resolve();

                // Check if already migrated (by checking count)
                const transaction = this.db.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);
                const countReq = store.count();

                countReq.onsuccess = () => {
                    if (countReq.result === 0) {
                        console.log('Migrating products from LocalStorage to IndexedDB...');
                        let migratedCount = 0;
                        products.forEach(p => {
                            store.put(p);
                            migratedCount++;
                        });
                        console.log(`Migrated ${migratedCount} products.`);
                        // Optional: Clear localStorage to free up space, but keeping it as backup for now might be safer
                        // localStorage.removeItem('marketplaceProducts');
                    }
                    resolve();
                };
            } catch (e) {
                console.error('Migration failed:', e);
                resolve();
            }
        });
    },

    /**
     * Get products by vendor name
     */
    getProductsByVendor(vendorName) {
        return new Promise(async (resolve, reject) => {
            try {
                const allProducts = await this.getAllProducts();
                const vendorProducts = allProducts.filter(p =>
                    p.vendor && p.vendor.toLowerCase() === vendorName.toLowerCase()
                );
                resolve(vendorProducts);
            } catch (error) {
                reject(error);
            }
        });
    },

    /**
     * Get trending products based on ratings, reviews, and recency
     */
    getTrendingProducts() {
        return new Promise(async (resolve, reject) => {
            try {
                const allProducts = await this.getAllProducts();
                const now = new Date();
                const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

                // Filter products that meet trending criteria
                const trending = allProducts.filter(product => {
                    // Must have reviews
                    if (!product.reviews || product.reviews.length < 3) return false;

                    // Calculate average rating
                    const avgRating = parseFloat(product.rating) || 0;
                    if (avgRating < 4.0) return false;

                    // Check for recent activity (at least 1 review in last 7 days)
                    const hasRecentReview = product.reviews.some(review => {
                        const reviewDate = new Date(review.date);
                        return reviewDate >= sevenDaysAgo;
                    });
                    if (!hasRecentReview) return false;

                    // Calculate positive feedback ratio
                    const positiveReviews = product.reviews.filter(r => r.rating >= 4).length;
                    const positiveRatio = positiveReviews / product.reviews.length;
                    if (positiveRatio < 0.6) return false;

                    return true;
                });

                // Calculate trending score and sort
                const scoredProducts = trending.map(product => {
                    const avgRating = parseFloat(product.rating) || 0;
                    const reviewCount = product.reviews.length;

                    // Count recent reviews (last 7 days)
                    const recentReviews = product.reviews.filter(review => {
                        const reviewDate = new Date(review.date);
                        return reviewDate >= sevenDaysAgo;
                    }).length;

                    // Trending score: rating (40%) + review count (30%) + recent activity (30%)
                    const trendingScore = (avgRating / 5 * 0.4) +
                        (Math.min(reviewCount / 20, 1) * 0.3) +
                        (Math.min(recentReviews / 5, 1) * 0.3);

                    return { ...product, trendingScore };
                });

                // Sort by trending score descending
                scoredProducts.sort((a, b) => b.trendingScore - a.trendingScore);

                resolve(scoredProducts);
            } catch (error) {
                reject(error);
            }
        });
    },

    /**
     * Calculate vendor statistics from their products
     */
    calculateVendorStats(vendorName) {
        return new Promise(async (resolve, reject) => {
            try {
                const vendorProducts = await this.getProductsByVendor(vendorName);

                if (vendorProducts.length === 0) {
                    resolve({
                        totalProducts: 0,
                        totalReviews: 0,
                        averageRating: 0,
                        vendorScore: 0
                    });
                    return;
                }

                // Aggregate all reviews from all products
                let totalReviews = 0;
                let totalRatingSum = 0;

                vendorProducts.forEach(product => {
                    if (product.reviews && product.reviews.length > 0) {
                        totalReviews += product.reviews.length;
                        product.reviews.forEach(review => {
                            totalRatingSum += review.rating;
                        });
                    }
                });

                const averageRating = totalReviews > 0 ? totalRatingSum / totalReviews : 0;

                // Calculate vendor score: rating (70%) + normalized review count (30%)
                const normalizedReviewCount = Math.min(totalReviews / 100, 1); // Cap at 100 reviews
                const vendorScore = (averageRating / 5 * 0.7) + (normalizedReviewCount * 0.3);

                resolve({
                    totalProducts: vendorProducts.length,
                    totalReviews,
                    averageRating: parseFloat(averageRating.toFixed(1)),
                    vendorScore: parseFloat(vendorScore.toFixed(3))
                });
            } catch (error) {
                reject(error);
            }
        });
    }
};

// Auto-initialize on load call
// document.addEventListener('DOMContentLoaded', () => MarketplaceStorage.init());
