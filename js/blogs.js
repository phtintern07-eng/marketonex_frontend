// script.js - HardwareHub Blog Interactions

document.addEventListener('DOMContentLoaded', () => {

  // --- Mobile Menu Toggle ---
  const hamburger = document.getElementById('hamburger');
  const mobileNav = document.getElementById('mobile-nav');

  hamburger.addEventListener('click', () => {
    mobileNav.classList.toggle('active');
    // Change icon based on state
    if (mobileNav.classList.contains('active')) {
      hamburger.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    } else {
      hamburger.innerHTML = '<i class="fa-solid fa-bars"></i>';
    }
  });

  // --- Navigation Links Active Tracker ---
  const navLinks = document.querySelectorAll('.nav-links a, .mobile-nav a');
  navLinks.forEach(link => {
    link.addEventListener('click', function (e) {
      e.preventDefault(); // prevents page jump for empty links

      // Remove active state from all nav links
      navLinks.forEach(l => l.classList.remove('active'));

      // Add active state to whichever link was clicked
      this.classList.add('active');

      // Close the mobile menu if clicked on mobile
      mobileNav.classList.remove('active');
      hamburger.innerHTML = '<i class="fa-solid fa-bars"></i>';
    });
  });

  // --- Category Filtering System ---
  const filterBtns = document.querySelectorAll('#category-filters li');
  const articles = document.querySelectorAll('.article-card');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // 1. Manage Active Class
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // 2. Filter Articles
      const selectedFilter = btn.getAttribute('data-filter');

      articles.forEach(article => {
        // Show if "all" is selected, or if the article's category matches
        if (selectedFilter === 'all' || article.getAttribute('data-category') === selectedFilter) {
          article.style.display = 'flex';
          // Small animation effect
          article.style.animation = 'fadeIn 0.5s ease forwards';
        } else {
          article.style.display = 'none';
        }
      });
    });
  });

  // Highlight functionality for newsletter submission
  const newsletterForm = document.getElementById('newsletter-form');
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const btn = newsletterForm.querySelector('button');
      const originalText = btn.textContent;

      btn.textContent = 'Subscribed!';
      btn.style.backgroundColor = '#28a745'; // Green success color

      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.backgroundColor = ''; // Reverts to CSS default
        newsletterForm.reset();
      }, 3000);
    });
  }

  // --- Theme Toggle Logic ---
  const themeToggle = document.getElementById('theme-toggle');
  const mobileThemeToggle = document.getElementById('mobile-theme-toggle');
  const body = document.body;

  function toggleTheme(e) {
    if (e) e.preventDefault();
    body.classList.toggle('dark-theme');
    const isDark = body.classList.contains('dark-theme');

    // Save to localStorage
    localStorage.setItem('theme', isDark ? 'dark' : 'light');

    // Update icons
    const iconClass = isDark ? 'fa-sun' : 'fa-moon';
    const iconHtml = `<i class="fa-solid ${iconClass}"></i>`;
    if (themeToggle) themeToggle.innerHTML = iconHtml;
    if (mobileThemeToggle) mobileThemeToggle.innerHTML = `${iconHtml} Theme`;
  }

  if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
  if (mobileThemeToggle) mobileThemeToggle.addEventListener('click', toggleTheme);

  // Check saved theme or system preference
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    body.classList.add('dark-theme');
    if (themeToggle) themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
    if (mobileThemeToggle) mobileThemeToggle.innerHTML = '<i class="fa-solid fa-sun"></i> Theme';
  }

});

// Add dynamic keyframes to head for the filtering animation
const styleSheet = document.createElement("style");
styleSheet.innerText = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;
document.head.appendChild(styleSheet);


// ads.js - Easily customize your ad text here!
// You can change the text inside the quotes to update the banners on the website.

const AD_MESSAGES = {
  // Top ad banner (After Article 1)
  ad1: "🔥 SPONSORED: GET 20% OFF NVIDIA RTX 40-SERIES GPUs! LIMITED TIME OFFER WITH FREE OVERNIGHT SHIPPING! 🔥",

  // Bottom ad banner (After Article 4)
  ad2: "⚡ FLASH SALE: ALL CORSAIR DDR5 RAM KITS AND AIO COOLERS ARE 30% OFF THIS WEEKEND ONLY! ⚡"
};

// This script safely injects the text into the ad banners when the page loads
document.addEventListener('DOMContentLoaded', () => {
  const ad1Element = document.getElementById('ad-text-1');
  const ad2Element = document.getElementById('ad-text-2');

  if (ad1Element) {
    ad1Element.textContent = AD_MESSAGES.ad1;
  }

  if (ad2Element) {
    ad2Element.textContent = AD_MESSAGES.ad2;
  }
});
