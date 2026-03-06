/* ======================================================================
   reviews.js  –  Vendor Dashboard: Customer Reviews
   Fixes applied:
     1. credentials: 'include' added to GET fetch (session cookie was never sent)
     2. Paginator class is now self-contained (was not defined anywhere)
   ====================================================================== */

document.addEventListener('DOMContentLoaded', function () {
    loadVendorReviews();
});

/* ── Self-contained ReviewsPaginator ──────────────────────────────────────────── */
class ReviewsPaginator {
    constructor(items, perPage, renderFn, paginationSelector) {
        this.items = items;
        this.perPage = perPage;
        this.renderFn = renderFn;
        this.paginationSelector = paginationSelector;
        this.currentPage = 1;
        this.totalPages = Math.ceil(items.length / perPage);
    }

    init() {
        this._render();
    }

    _pageItems() {
        const start = (this.currentPage - 1) * this.perPage;
        return this.items.slice(start, start + this.perPage);
    }

    _render() {
        this.renderFn(this._pageItems());
        this._renderPagination();
    }

    _renderPagination() {
        const container = document.querySelector(this.paginationSelector);
        if (!container) return;

        if (this.totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        let html = '<div class="pagination-controls" style="display:flex;justify-content:center;gap:8px;margin-top:20px;flex-wrap:wrap;">';

        // Prev button
        html += `<button onclick="window.__reviewsPaginator.goTo(${this.currentPage - 1})"
            style="padding:8px 16px;border-radius:8px;border:1px solid var(--border-color,#ddd);cursor:pointer;background:${this.currentPage === 1 ? '#f5f5f5' : 'var(--card-bg,#fff)'};opacity:${this.currentPage === 1 ? '0.5' : '1'};"
            ${this.currentPage === 1 ? 'disabled' : ''}>‹ Prev</button>`;

        // Page buttons
        for (let p = 1; p <= this.totalPages; p++) {
            html += `<button onclick="window.__reviewsPaginator.goTo(${p})"
                style="padding:8px 14px;border-radius:8px;border:1px solid var(--border-color,#ddd);cursor:pointer;
                background:${p === this.currentPage ? 'var(--primary-color,#6366f1)' : 'var(--card-bg,#fff)'};
                color:${p === this.currentPage ? '#fff' : 'inherit'};">${p}</button>`;
        }

        // Next button
        html += `<button onclick="window.__reviewsPaginator.goTo(${this.currentPage + 1})"
            style="padding:8px 16px;border-radius:8px;border:1px solid var(--border-color,#ddd);cursor:pointer;background:${this.currentPage === this.totalPages ? '#f5f5f5' : 'var(--card-bg,#fff)'};opacity:${this.currentPage === this.totalPages ? '0.5' : '1'};"
            ${this.currentPage === this.totalPages ? 'disabled' : ''}>Next ›</button>`;

        html += '</div>';
        container.innerHTML = html;
    }

    goTo(page) {
        if (page < 1 || page > this.totalPages) return;
        this.currentPage = page;
        this._render();
        // Scroll to top of reviews grid
        const grid = document.getElementById('reviewsGridContainer');
        if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

/* ── Main fetch function ───────────────────────────────────────────────── */
async function loadVendorReviews() {
    const grid = document.getElementById('reviewsGridContainer');

    try {
        // FIX 1: credentials:'include' is REQUIRED so the session cookie is sent
        // Without this the @require_active_vendor guard returns 401 every time.
        const response = await fetch('/api/vendor/reviews', {
            method: 'GET',
            credentials: 'include',          // ← was missing: session never sent
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            const msg = errData.error || `HTTP ${response.status}`;
            throw new Error(msg);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        updateStatsCard(data);

        // FIX 2: ReviewsPaginator is now self-contained above — no external dependency
        if (data.reviews && data.reviews.length > 0) {
            const paginator = new ReviewsPaginator(
                data.reviews,
                6,
                renderReviews,
                '#reviewsPaginationContainer'
            );
            window.__reviewsPaginator = paginator; // expose for onclick handlers
            paginator.init();
        } else {
            renderReviews([]);
        }

    } catch (error) {
        console.error('Error loading reviews:', error);
        if (grid) {
            grid.innerHTML = `
                <div class="loading-reviews" style="color:#ef4444;grid-column:1/-1;">
                    <i class="fas fa-exclamation-circle" style="color:#ef4444;"></i>
                    <p>Failed to load reviews. Please try again.</p>
                    <p style="font-size:12px;opacity:0.7;">${error.message}</p>
                </div>
            `;
        }
    }
}

/* ── Stats card update ─────────────────────────────────────────────────── */
function updateStatsCard(data) {
    const avgRating = data.average_rating || 0;
    const totalCount = data.count || 0;

    document.getElementById('avgRatingBig').textContent = avgRating.toFixed(1);
    document.getElementById('totalReviewsText').textContent =
        `Based on ${totalCount} total review${totalCount !== 1 ? 's' : ''}`;

    // Render big stars
    const starsContainer = document.getElementById('avgStarsBig');
    let starsHtml = '';
    const fullStars = Math.floor(avgRating);
    const hasHalfStar = avgRating % 1 >= 0.5;
    for (let i = 0; i < 5; i++) {
        if (i < fullStars) {
            starsHtml += '<i class="fas fa-star"></i>';
        } else if (i === fullStars && hasHalfStar) {
            starsHtml += '<i class="fas fa-star-half-alt"></i>';
        } else {
            starsHtml += '<i class="far fa-star"></i>';
        }
    }
    starsContainer.innerHTML = starsHtml;

    // Rating distribution bar chart
    const distributions = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    if (data.reviews && data.reviews.length > 0) {
        data.reviews.forEach(r => {
            const rating = Math.round(r.rating);
            if (distributions[rating] !== undefined) distributions[rating]++;
        });
    }
    renderBarChart(distributions, totalCount);
}

/* ── Bar chart ─────────────────────────────────────────────────────────── */
function renderBarChart(distributions, totalCount) {
    const chartContainer = document.getElementById('ratingBarChart');
    let html = '';
    for (let i = 5; i >= 1; i--) {
        const count = distributions[i];
        const percentage = totalCount > 0 ? (count / totalCount) * 100 : 0;
        html += `
            <div class="rating-bar-row">
                <span class="rating-bar-label">${i} Stars</span>
                <div class="rating-bar-track-3d">
                    <div class="rating-bar-fill-3d" style="width:${percentage}%"></div>
                </div>
                <span class="rating-bar-count">${count}</span>
            </div>
        `;
    }
    chartContainer.innerHTML = html;
}

/* ── Review card renderer ──────────────────────────────────────────────── */
function renderReviews(reviews) {
    const grid = document.getElementById('reviewsGridContainer');

    if (!reviews || reviews.length === 0) {
        grid.innerHTML = `
            <div class="loading-reviews" style="grid-column:1/-1;">
                <i class="fas fa-comment-slash" style="opacity:0.5;"></i>
                <p>You don't have any reviews yet.</p>
            </div>
        `;
        return;
    }

    let html = '';
    reviews.forEach((review, index) => {
        // Stars
        let starsHtml = '';
        const rating = Math.round(review.rating);
        for (let i = 1; i <= 5; i++) {
            starsHtml += i <= rating
                ? '<i class="fas fa-star"></i>'
                : '<i class="far fa-star"></i>';
        }

        // Date
        const dateStr = review.created_at
            ? new Date(review.created_at).toLocaleDateString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric'
            })
            : 'Recent';

        // Avatar initials
        const initials = review.name
            ? review.name.substring(0, 2).toUpperCase()
            : 'AN';

        const staggerDelay = index * 0.1;

        html += `
            <div class="review-card-3d" style="animation-delay:${staggerDelay}s">
                <div class="review-card-header">
                    <div class="reviewer-info-3d">
                        <div class="reviewer-avatar-3d">${initials}</div>
                        <div class="reviewer-details">
                            <h4>${escapeHtml(review.name || 'Anonymous')}</h4>
                            <p>${escapeHtml(review.category || 'General')}</p>
                        </div>
                    </div>
                    <span class="review-date-badge">${dateStr}</span>
                </div>
                <div class="review-product-badge">
                    <i class="fas fa-box" style="margin-right:4px;"></i>
                    ${escapeHtml(review.product_name || 'General Product')}
                </div>
                <div class="review-stars-3d">${starsHtml}</div>
                <p class="review-comment-3d">"${escapeHtml(review.message)}"</p>
                ${review.recommend === 'yes'
                ? '<div style="margin-top:8px;font-size:12px;color:#22c55e;"><i class="fas fa-thumbs-up"></i> Recommends this product</div>'
                : '<div style="margin-top:8px;font-size:12px;color:#ef4444;"><i class="fas fa-thumbs-down"></i> Does not recommend</div>'
            }
            </div>
        `;
    });

    grid.innerHTML = html;
}

/* ── XSS helper ────────────────────────────────────────────────────────── */
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
