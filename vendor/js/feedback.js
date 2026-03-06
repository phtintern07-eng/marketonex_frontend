document.addEventListener('DOMContentLoaded', async () => {
    // Extract product_id from URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('product_id');
    const productType = urlParams.get('product_type') || 'marketplace';

    const baseUrl = window.API_BASE_URL || '';

    // 1. Check Auth and Autofill
    try {
        const authRes = await fetch(`${baseUrl}/api/auth/status`, { credentials: 'include' });
        const authData = await authRes.json();

        // /api/auth/status returns { isAuthenticated: true/false, user: {...} }
        if (!authData.isAuthenticated) {
            alert("Please login to submit a review.");
            window.location.href = '../marketplace/login.html';
            return;
        }

        // Autofill Name and Email
        if (authData.user) {
            // API returns 'name' field (fullname fallback for compatibility)
            if (document.getElementById('name')) document.getElementById('name').value = authData.user.name || authData.user.fullname || '';
            if (document.getElementById('email')) {
                document.getElementById('email').value = authData.user.email || '';
                document.getElementById('email').readOnly = true; // Lock email to session user
            }
        }

        // 2. Check if already reviewed
        if (productId) {
            const statusRes = await fetch(`${baseUrl}/api/feedback/status/${productId}`, { credentials: 'include' });
            const statusData = await statusRes.json();
            if (statusData.has_reviewed) {
                alert("You have already reviewed this product.");
                window.location.href = `../marketplace/marketplace.html`;
                return;
            }
        }
    } catch (err) {
    }

    // Populate product ID fields
    if (productId) {
        document.getElementById('product-id-hidden').value = productId;
        document.getElementById('product-id-display').value = productId;
    }

    // 2. Image Upload Preview
    const imageInput = document.getElementById('image-upload');
    const imagePreview = document.getElementById('image-preview');
    let uploadedImageBase64 = null; // Store base64 data here

    imageInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                uploadedImageBase64 = e.target.result; // Store raw base64 string
                imagePreview.style.backgroundImage = `url(${e.target.result})`;
                imagePreview.classList.add('visible');
            };
            reader.readAsDataURL(file);
        } else {
            uploadedImageBase64 = null;
            imagePreview.classList.remove('visible');
            imagePreview.style.backgroundImage = '';
        }
    });

    // 3. Form Submission
    const feedbackForm = document.getElementById('feedbackForm');
    feedbackForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Get product ID from hidden field (optional)
        const productIdValue = document.getElementById('product-id-hidden').value || null;

        // Check if rating is selected
        const ratingElement = document.querySelector('input[name="rating"]:checked');
        if (!ratingElement) {
            alert('Please select a rating.');
            return;
        }

        // Gather Form Data
        const reviewData = {
            product_id: productIdValue,
            product_type: productType,
            reviewerName: document.getElementById('name').value,
            // reviewerEmail is handled by backend session, but we send it for redundancy/integrity
            reviewerEmail: document.getElementById('email').value || '',
            rating: parseInt(ratingElement.value),
            category: document.querySelector('input[name="category"]:checked').value,
            message: document.getElementById('message').value,
            recommend: document.querySelector('input[name="recommend"]:checked').value,
            image: uploadedImageBase64 || null,
            date: new Date().toISOString()
        };

        // Gather Form Data
        // Send data to backend API
        try {
            const response = await fetch('/api/feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(reviewData)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to submit feedback');
            }

            // Show Success Modal
            const successModal = document.getElementById('success-modal');
            successModal.classList.remove('hidden');
            successModal.classList.add('visible');

            // Reset form
            feedbackForm.reset();
            uploadedImageBase64 = null;
            imagePreview.classList.remove('visible');
            imagePreview.style.backgroundImage = '';

        } catch (error) {
            alert('Failed to submit feedback: ' + error.message + '\n\nPlease try again.');
        }
    });

    // Close Modal button
    document.getElementById('close-modal-btn').addEventListener('click', () => {
        window.location.href = '../marketplace/marketplace.html';
    });
});
