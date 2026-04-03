// blogs.js - Dynamic Blog Loading & Interactions

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const hamburger = document.getElementById('hamburger');
    const mobileNav = document.getElementById('mobile-nav');
    const articleGrid = document.getElementById('article-grid');
    const filterBtns = document.querySelectorAll('#category-filters li');
    const themeToggle = document.getElementById('theme-toggle');
    const mobileThemeToggle = document.getElementById('mobile-theme-toggle');
    const body = document.body;

    let allBlogs = [];

    // --- Core: Fetch & Render Blogs ---
    async function fetchAndRenderBlogs() {
        try {
            // Show loading state
            articleGrid.innerHTML = '<div class="loading-spinner"><i class="fas fa-circle-notch fa-spin"></i> Loading latest stories...</div>';

            const response = await fetch('/api/blogs');
            const data = await response.json();

            if (data.success) {
                allBlogs = data.blogs;
                renderBlogGrid(allBlogs);
            } else {
                articleGrid.innerHTML = '<p class="error-msg">Failed to load blogs. Please try again later.</p>';
            }
        } catch (err) {
            console.error("Blog fetch error:", err);
            articleGrid.innerHTML = '<p class="error-msg">Connection error. Could not reach the server.</p>';
        }
    }

    function renderBlogGrid(blogsToRender) {
        if (blogsToRender.length === 0) {
            articleGrid.innerHTML = '<div class="empty-blogs"><i class="fas fa-feather-alt"></i><p>No articles found in this category.</p></div>';
            return;
        }

        let html = '';
        blogsToRender.forEach((blog, index) => {
            // Use the first image if available, else a placeholder
            const images = blog.images || [];
            const coverImg = images.length > 0 ? images[0] : 'https://images.unsplash.com/photo-1587202372634-32705e3bf49c?auto=format&fit=crop&w=600&q=80';
            
            // Calculate read time (if not saved, estimate)
            const words = blog.content.replace(/<[^>]*>/g, '').split(/\s+/).length;
            const readTime = Math.max(1, Math.ceil(words / 225));

            html += `
                <article class="article-card" data-category="${blog.category.toLowerCase()}" style="animation: fadeIn 0.5s ease forwards; animation-delay: ${index * 0.1}s">
                    <div class="img-wrapper">
                        <span class="category-badge">${blog.category}</span>
                        <img src="${coverImg}" alt="${blog.title}">
                    </div>
                    <div class="card-content">
                        <div class="card-meta">
                            <span><i class="fa-regular fa-clock"></i> ${readTime} min read</span>
                            <span>${new Date(blog.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                        <h3>${blog.title}</h3>
                        <p>${stripHtml(blog.content).substring(0, 120)}...</p>
                        <div class="card-footer">
                            <div class="author">
                                <div class="author-img">${blog.writer.charAt(0)}</div>
                                <span>${blog.writer}</span>
                                ${blog.is_expert ? '<i class="fas fa-certificate expert-mark" title="Expert Article" style="color:#E3A83C; margin-left:5px;"></i>' : ''}
                            </div>
                            <a href="#" class="read-more" onclick="openBlogModal(${blog.id})">Read <i class="fa-solid fa-arrow-right"></i></a>
                        </div>
                    </div>
                </article>
            `;

            // Inject Ad Banners at specific intervals (e.g., after 1st and 4th post)
            if (index === 0) {
                html += `
                    <div class="ad-banner">
                        <div class="ad-marquee"><span>${AD_MESSAGES.ad1}</span></div>
                    </div>
                `;
            } else if (index === 3) {
                html += `
                    <div class="ad-banner">
                        <div class="ad-marquee"><span>${AD_MESSAGES.ad2}</span></div>
                    </div>
                `;
            }
        });

        articleGrid.innerHTML = html;
    }

    function stripHtml(html) {
        let tmp = document.createElement("DIV");
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || "";
    }

    // --- Blog Search Logic ---
    const searchInput = document.getElementById('blog-search');
    const searchBtn = document.querySelector('.search-box button');

    function performSearch() {
        const query = searchInput.value.toLowerCase().trim();
        if (!query) {
            renderBlogGrid(allBlogs);
            return;
        }

        const filtered = allBlogs.filter(b => 
            b.title.toLowerCase().includes(query) || 
            b.writer.toLowerCase().includes(query)
        );
        renderBlogGrid(filtered);
    }

    if (searchInput) {
        searchInput.addEventListener('input', performSearch);
    }
    if (searchBtn) {
        searchBtn.addEventListener('click', performSearch);
    }

    // --- Category Filtering (Client-side for speed) ---
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const filter = btn.getAttribute('data-filter');
            
            // UI Update
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Logic
            if (filter === 'all') {
                renderBlogGrid(allBlogs);
            } else {
                const filtered = allBlogs.filter(b => b.category.toLowerCase().includes(filter.toLowerCase()));
                renderBlogGrid(filtered);
            }
        });
    });

    // --- Mobile Menu ---
    hamburger.addEventListener('click', () => {
        mobileNav.classList.toggle('active');
        hamburger.innerHTML = mobileNav.classList.contains('active') ? '<i class="fa-solid fa-xmark"></i>' : '<i class="fa-solid fa-bars"></i>';
    });

    // --- Theme Toggle ---
    function toggleTheme(e) {
        if (e) e.preventDefault();
        body.classList.toggle('dark-theme');
        const isDark = body.classList.contains('dark-theme');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        
        const icon = `<i class="fa-solid ${isDark ? 'fa-sun' : 'fa-moon'}"></i>`;
        if (themeToggle) themeToggle.innerHTML = icon;
        if (mobileThemeToggle) mobileThemeToggle.innerHTML = `${icon} Theme`;
    }

    if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
    if (mobileThemeToggle) mobileThemeToggle.addEventListener('click', toggleTheme);

    // --- Reader Modal Functions ---
    const readerModal = document.getElementById('blog-reader-modal');
    const closeReaderBtn = document.getElementById('close-reader');
    const readerArea = document.getElementById('reader-render-area');

    window.openBlogModal = function(id) {
        const blog = allBlogs.find(b => b.id === id);
        if (!blog) return;

        const images = blog.images || [];
        const coverImg = images.length > 0 ? images[0] : '';
        
        readerArea.innerHTML = `
            <div class="blog-reader-content">
                <div class="preview-meta">
                    <span class="preview-category">${blog.category}</span>
                    <h1 class="preview-title" style="margin-top:10px;">${blog.title}</h1>
                    <div class="preview-author">
                        By <strong>${blog.writer}</strong> • ${new Date(blog.created_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                        ${blog.is_expert ? '<span style="color:#E3A83C; margin-left:10px; font-weight:bold;"><i class="fas fa-certificate"></i> Expert Choice</span>' : ''}
                    </div>
                </div>
                ${coverImg ? `<img src="${coverImg}" alt="${blog.title}" style="width:100%; border-radius:15px; margin-bottom:30px; box-shadow:0 10px 30px rgba(0,0,0,0.15);">` : ''}
                <div class="preview-main-content ql-editor">
                    ${blog.content}
                </div>
            </div>
        `;
        readerModal.style.display = 'block';
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    };

    if (closeReaderBtn) {
        closeReaderBtn.onclick = () => {
            readerModal.style.display = 'none';
            document.body.style.overflow = 'auto';
        };
    }

    window.addEventListener('click', (e) => {
        if (e.target === readerModal) {
            readerModal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    });

    // --- Initial Load ---
    fetchAndRenderBlogs();
});

// --- Ad Configuration ---
const AD_MESSAGES = {
    ad1: "🔥 SPONSORED: GET 20% OFF NVIDIA RTX 40-SERIES GPUs! LIMITED TIME OFFER! 🔥",
    ad2: "⚡ FLASH SALE: ALL CORSAIR DDR5 RAM KITS AND AIO COOLERS ARE 30% OFF! ⚡"
};
