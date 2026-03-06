/**
 * Pagination Component
 * Reusable pagination UI and logic
 */

class Pagination {
    /**
     * Create a pagination component
     * @param {string} containerId - ID of container element
     * @param {Function} onPageChange - Callback when page changes
     * @param {Object} options - Configuration options
     */
    constructor(containerId, onPageChange, options = {}) {
        this.container = document.getElementById(containerId);
        this.onPageChange = onPageChange;
        this.options = {
            maxButtons: options.maxButtons || 7,
            showInfo: options.showInfo !== false,
            showFirstLast: options.showFirstLast !== false,
            updateUrl: options.updateUrl !== false
        };
        this.currentData = null;
    }

    /**
     * Render pagination controls
     * @param {Object} paginationData - Pagination metadata from API
     */
    render(paginationData) {
        if (!this.container) {
            console.error('[PAGINATION] Container not found');
            return;
        }

        this.currentData = paginationData;

        // Clear container
        this.container.innerHTML = '';

        // Create pagination wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'pagination-wrapper';

        // Add info section
        if (this.options.showInfo) {
            wrapper.appendChild(this.createInfo());
        }

        // Add controls
        wrapper.appendChild(this.createControls());

        this.container.appendChild(wrapper);
    }

    /**
     * Create pagination info display
     */
    createInfo() {
        const info = document.createElement('div');
        info.className = 'pagination-info';

        const { current_page, per_page, total_items } = this.currentData;
        const start = (current_page - 1) * per_page + 1;
        const end = Math.min(current_page * per_page, total_items);

        info.textContent = `Showing ${start}-${end} of ${total_items} items`;

        return info;
    }

    /**
     * Create pagination controls
     */
    createControls() {
        const controls = document.createElement('div');
        controls.className = 'pagination-controls';

        const { current_page, total_pages, has_prev, has_next } = this.currentData;

        // Previous button
        controls.appendChild(this.createButton('Previous', current_page - 1, !has_prev));

        // Page number buttons
        const pageButtons = this.getPageButtons(current_page, total_pages);
        pageButtons.forEach(page => {
            if (page === '...') {
                const ellipsis = document.createElement('span');
                ellipsis.className = 'pagination-ellipsis';
                ellipsis.textContent = '...';
                controls.appendChild(ellipsis);
            } else {
                controls.appendChild(this.createButton(page, page, false, page === current_page));
            }
        });

        // Next button
        controls.appendChild(this.createButton('Next', current_page + 1, !has_next));

        return controls;
    }

    /**
     * Create a pagination button
     */
    createButton(text, page, disabled, active = false) {
        const button = document.createElement('button');
        button.className = 'pagination-btn';
        button.textContent = text;
        button.disabled = disabled;

        if (active) {
            button.classList.add('active');
        }

        if (!disabled) {
            button.addEventListener('click', () => this.handlePageChange(page));
        }

        return button;
    }

    /**
     * Get array of page numbers to display
     */
    getPageButtons(currentPage, totalPages) {
        const maxButtons = this.options.maxButtons;
        const pages = [];

        if (totalPages <= maxButtons) {
            // Show all pages
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            // Show subset with ellipsis
            const halfButtons = Math.floor(maxButtons / 2);
            let startPage = Math.max(1, currentPage - halfButtons);
            let endPage = Math.min(totalPages, currentPage + halfButtons);

            // Adjust if at start or end
            if (currentPage <= halfButtons) {
                endPage = maxButtons - 1;
            } else if (currentPage >= totalPages - halfButtons) {
                startPage = totalPages - maxButtons + 2;
            }

            // Always show first page
            if (startPage > 1) {
                pages.push(1);
                if (startPage > 2) {
                    pages.push('...');
                }
            }

            // Show middle pages
            for (let i = startPage; i <= endPage; i++) {
                pages.push(i);
            }

            // Always show last page
            if (endPage < totalPages) {
                if (endPage < totalPages - 1) {
                    pages.push('...');
                }
                pages.push(totalPages);
            }
        }

        return pages;
    }

    /**
     * Handle page change
     */
    handlePageChange(page) {
        // Update URL if enabled
        if (this.options.updateUrl) {
            const url = new URL(window.location);
            url.searchParams.set('page', page);
            window.history.pushState({}, '', url);
        }

        // Call callback
        if (this.onPageChange && typeof this.onPageChange === 'function') {
            this.onPageChange(page);
        }
    }

    /**
     * Get current page from URL
     */
    static getCurrentPageFromUrl() {
        const params = new URLSearchParams(window.location.search);
        return parseInt(params.get('page')) || 1;
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Pagination;
}
