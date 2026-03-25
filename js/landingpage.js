// Landing Page Navigation and Interactions

document.addEventListener('DOMContentLoaded', () => {
    // Category card click handlers
    const categoryCards = document.querySelectorAll('.category-card');

    categoryCards.forEach(card => {
        card.addEventListener('click', () => {
            const category = card.getAttribute('data-category');
            // Navigate to marketonex with category filter
            window.location.href = `marketonex/marketonex.html?category=${category}`;
        });
    });

    // Cart icon click handlers
    const cartIcons = document.querySelectorAll('.cart-icon');
    cartIcons.forEach(icon => {
        icon.addEventListener('click', () => {
            window.location.href = 'marketonex/cart.html';
        });
    });

    // Update cart count dynamically
    function updateCartCount() {
        const cartCountElements = document.querySelectorAll('.cart-count');

        // Get cart from localStorage
        const cart = JSON.parse(localStorage.getItem('marketonex_cart') || '[]');
        const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);

        cartCountElements.forEach(el => {
            // Update the cart count
            el.textContent = totalItems;

            // Hide badge if cart is empty
            if (totalItems === 0) {
                el.style.display = 'none';
            } else {
                el.style.display = 'flex';
            }
        });
    }

    // Update cart count on page load
    updateCartCount();

    // Listen for storage changes (when cart is updated in another tab/window)
    window.addEventListener('storage', (e) => {
        if (e.key === 'marketonex_cart') {
            updateCartCount();
        }
    });

    // Listen for custom cart update events
    window.addEventListener('cartUpdated', updateCartCount);

    // Search functionality
    const searchBar = document.querySelector('.search-bar input');
    const searchBtn = document.querySelector('.search-btn');

    function performSearch() {
        if (searchBar) {
            const searchQuery = searchBar.value.trim();
            if (searchQuery) {
                window.location.href = `marketonex/marketonex.html?search=${encodeURIComponent(searchQuery)}`;
            } else {
                // If empty, just navigate to marketonex
                window.location.href = 'marketonex/marketonex.html';
            }
        }
    }

    if (searchBtn && searchBar) {
        searchBtn.addEventListener('click', performSearch);
    }

    // Allow Enter key to search
    if (searchBar) {
        searchBar.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                performSearch();
            }
        });
    }

    // Hero slider functionality
    const heroSlides = document.querySelectorAll('.hero-slide');
    const heroIndicators = document.querySelectorAll('.hero-indicators span');
    let currentSlide = 0;

    function showSlide(index) {
        // Hide all slides
        heroSlides.forEach(slide => {
            slide.classList.remove('active');
        });

        // Remove active from all indicators
        heroIndicators.forEach(indicator => indicator.classList.remove('active'));

        // Show selected slide
        if (heroSlides[index]) {
            heroSlides[index].classList.add('active');
        }

        // Activate selected indicator
        if (heroIndicators[index]) {
            heroIndicators[index].classList.add('active');
        }

        currentSlide = index;
    }

    function rotateHero() {
        currentSlide = (currentSlide + 1) % heroSlides.length;
        showSlide(currentSlide);
    }

    // Auto-rotate every 5 seconds
    if (heroSlides.length > 0) {
        setInterval(rotateHero, 5000);
    }

    // Manual indicator clicks
    heroIndicators.forEach((indicator, index) => {
        indicator.addEventListener('click', () => {
            showSlide(index);
        });
    });

    // Testimonial slider functionality
    const testimonialDots = document.querySelectorAll('.testimonial-dots .dot');
    const testimonialSlides = document.querySelectorAll('.testimonial-slide');
    let currentTestimonial = 0;

    function showTestimonial(index) {
        // Hide all slides
        testimonialSlides.forEach(slide => {
            slide.classList.remove('active');
            slide.style.opacity = '0';
            slide.style.display = 'none';
        });

        // Remove active class from all dots
        testimonialDots.forEach(dot => dot.classList.remove('active'));

        // Show selected slide with fade-in effect
        if (testimonialSlides[index]) {
            testimonialSlides[index].style.display = 'block';
            setTimeout(() => {
                testimonialSlides[index].classList.add('active');
                testimonialSlides[index].style.opacity = '1';
            }, 10);
        }

        // Activate selected dot
        if (testimonialDots[index]) {
            testimonialDots[index].classList.add('active');
        }

        currentTestimonial = index;
    }

    function rotateTestimonial() {
        currentTestimonial = (currentTestimonial + 1) % testimonialSlides.length;
        showTestimonial(currentTestimonial);
    }

    // Auto-rotate testimonials every 6 seconds
    if (testimonialSlides.length > 0) {
        setInterval(rotateTestimonial, 6000);
    }

    // Manual testimonial dot clicks
    testimonialDots.forEach((dot, index) => {
        dot.addEventListener('click', () => {
            showTestimonial(index);
        });
    });

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Mobile menu toggle
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const navCategories = document.querySelector('.nav-categories');

    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', () => {
            navCategories.classList.toggle('active');
            mobileMenuToggle.classList.toggle('active');
        });
    }
});
