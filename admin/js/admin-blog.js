/**
 * Blog Management System Logic (Admin Panel Extension)
 * Handles Rich Text Editor, Tags System, Auto-Save, and API Submission
 */

document.addEventListener('DOMContentLoaded', () => {
    // ---------------------------------------------------------
    // 1. QUILL RICH TEXT EDITOR SETUP
    // ---------------------------------------------------------
    
    // Ensure Quill is loaded bounds
    if (typeof Quill === 'undefined') {
        console.error("Quill.js failed to load.");
        return;
    }

    const toolbarOptions = [
        [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
        [{ 'font': [] }],
        [{ 'size': ['small', false, 'large', 'huge'] }],
        ['bold', 'italic', 'underline', 'strike'],        // toggled buttons
        [{ 'color': [] }, { 'background': [] }],          // dropdown with defaults from theme
        [{ 'align': [] }],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }, { 'list': 'check' }],
        ['blockquote', 'code-block'],
        ['link', 'image', 'video'],
        ['clean']                                         // remove formatting button
    ];

    const quill = new Quill('#quill-editor', {
        theme: 'snow',
        placeholder: 'Write your inspiring blog post here...',
        modules: {
            toolbar: toolbarOptions
        }
    });

    // Editor Auto-resize/CSS fixes
    const qlContainer = document.querySelector('.ql-container');
    if (qlContainer) {
        qlContainer.style.fontSize = '1rem';
        qlContainer.style.fontFamily = "'Inter', sans-serif";
    }

    // Advanced: Modify Image Drop / Click handlers here if needed
    // Native base64 works, but typical prod setup uploads via drop handler
    
    // ---------------------------------------------------------
    // 2. LIVE STATISTICS (Word Count / Read Time)
    // ---------------------------------------------------------
    const statsLabel = document.getElementById('blog-stats');
    
    quill.on('text-change', () => {
        const text = quill.getText().trim();
        const words = text.length > 0 ? text.split(/\s+/).length : 0;
        const readTime = Math.max(1, Math.ceil(words / 200)); // ~200 WPM
        
        if (statsLabel) {
            statsLabel.textContent = `${words} words | ${readTime} min read`;
        }
        
        scheduleAutoSave(); // Trigger debounce auto-save
    });

    // ---------------------------------------------------------
    // 3. TAGS SYSTEM
    // ---------------------------------------------------------
    const tagInput = document.getElementById('blog-tag-input');
    const tagsContainer = document.getElementById('blog-tags-container');
    const tagsHidden = document.getElementById('blog-tags-hidden');
    let tagsArray = [];

    function updateTagsUI() {
        // Clear existing visual tags (keep input)
        document.querySelectorAll('.tag-pill').forEach(el => el.remove());
        
        tagsArray.forEach((tag, index) => {
            const pill = document.createElement('span');
            pill.className = 'tag-pill';
            pill.style.cssText = `
                background-color: #eef2ff;
                color: #4f46e5;
                padding: 4px 8px;
                border-radius: 6px;
                font-size: 0.85rem;
                display: inline-flex;
                align-items: center;
                font-weight: 500;
            `;
            
            pill.innerHTML = `
                #${tag} 
                <i class="fas fa-times remove-tag" style="margin-left: 6px; cursor: pointer; font-size: 0.75rem;"></i>
            `;
            
            // Remove functionality
            pill.querySelector('.remove-tag').addEventListener('click', () => {
                tagsArray.splice(index, 1);
                updateTagsUI();
            });
            
            tagsContainer.insertBefore(pill, tagInput);
        });
        
        tagsHidden.value = JSON.stringify(tagsArray);
    }

    if (tagInput) {
        tagInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const newTag = tagInput.value.trim().replace(/^#/, '');
                
                if (newTag && !tagsArray.includes(newTag)) {
                    tagsArray.push(newTag);
                    updateTagsUI();
                }
                tagInput.value = '';
            } else if (e.key === 'Backspace' && tagInput.value === '' && tagsArray.length > 0) {
                // Delete last tag on backspace if input is empty
                tagsArray.pop();
                updateTagsUI();
            }
        });

        // Focus input when clicking container
        tagsContainer.addEventListener('click', () => tagInput.focus());
    }

    // ---------------------------------------------------------
    // 4. AUTO-SAVE (DRAFT LOGIC)
    // ---------------------------------------------------------
    let autoSaveTimeout;
    const saveBtn = document.getElementById('blog-save-draft');
    const statusMsg = document.getElementById('blog-status-message');
    const statusText = document.getElementById('blog-status-text');

    function showStatus(message, isError = false) {
        if (!statusMsg) return;
        statusText.textContent = message;
        statusMsg.style.color = isError ? '#ef4444' : '#10b981';
        statusMsg.innerHTML = `<i class="fas ${isError ? 'fa-exclamation-circle' : 'fa-check-circle'}"></i> <span>${message}</span>`;
        statusMsg.style.opacity = '1';
        
        setTimeout(() => {
            statusMsg.style.opacity = '0';
        }, 3000);
    }

    function saveDraftLocally() {
        const draft = {
            title: document.getElementById('blog-title')?.value || '',
            writer: document.getElementById('blog-writer')?.value || '',
            category: document.getElementById('blog-category')?.value || '',
            expert: document.getElementById('blog-expert')?.checked || false,
            tags: tagsArray,
            content: quill.root.innerHTML,
            timestamp: new Date().toISOString()
        };
        
        localStorage.setItem('vendorverse_admin_blog_draft', JSON.stringify(draft));
        showStatus('Draft saved locally');
    }

    function scheduleAutoSave() {
        clearTimeout(autoSaveTimeout);
        autoSaveTimeout = setTimeout(saveDraftLocally, 5000); // 5 sec debounce
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', saveDraftLocally);
    }

    // Load Draft on Startup
    try {
        const savedDraft = localStorage.getItem('vendorverse_admin_blog_draft');
        if (savedDraft) {
            const draft = JSON.parse(savedDraft);
            if (draft.title) document.getElementById('blog-title').value = draft.title;
            if (draft.writer) document.getElementById('blog-writer').value = draft.writer;
            if (draft.category) document.getElementById('blog-category').value = draft.category;
            if (draft.expert) document.getElementById('blog-expert').checked = draft.expert;
            
            if (draft.tags && Array.isArray(draft.tags)) {
                tagsArray = draft.tags;
                updateTagsUI();
            }
            
            if (draft.content && draft.content !== '<p><br></p>') {
                // To avoid triggering text-change instantly
                const Delta = quill.clipboard.convert(draft.content);
                quill.setContents(Delta, 'silent');
            }
            
            // showStatus('Draft restored'); // Optional notice
        }
    } catch (e) { console.warn("Could not load blog draft", e); }


    // ---------------------------------------------------------
    // 5. FORM SUBMISSION (PUBLISH)
    // ---------------------------------------------------------
    const publishBtn = document.getElementById('blog-publish-btn');
    
    if (publishBtn) {
        publishBtn.addEventListener('click', async () => {
            // Validation
            const title = document.getElementById('blog-title').value.trim();
            const writer = document.getElementById('blog-writer').value.trim();
            const category = document.getElementById('blog-category').value;
            const contentHTML = quill.root.innerHTML;
            const imagesInput = document.getElementById('blog-images');
            
            if (!title) return alert("Please enter a blog title.");
            if (!writer) return alert("Please enter the writer's name.");
            if (!category) return alert("Please select a category.");
            if (quill.getText().trim().length < 10) return alert("Blog content is too short.");
            if (!imagesInput.files || imagesInput.files.length === 0) return alert("Please upload at least one cover image.");

            // Build FormData
            const formData = new FormData();
            formData.append('title', title);
            formData.append('writer', writer);
            formData.append('category', category);
            formData.append('expert', document.getElementById('blog-expert').checked);
            formData.append('content', contentHTML);
            formData.append('tags', JSON.stringify(tagsArray));
            
            // Append Multiple Files
            for (let i = 0; i < imagesInput.files.length; i++) {
                formData.append('images', imagesInput.files[i]);
            }

            // UI Loading state
            const originalBtnHtml = publishBtn.innerHTML;
            publishBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Publishing...';
            publishBtn.disabled = true;

            try {
                // Dynamic base URL detection for Admin API (using global API_BASE_URL if it exists)
                const baseUrl = window.API_BASE_URL || (window.location.protocol === 'file:' ? 'http://127.0.0.1:5000' : '');
                const API_ENDPOINT = `${baseUrl}/api/add-blog`;

                const response = await fetch(API_ENDPOINT, {
                    method: 'POST',
                    body: formData
                    // Note: omit 'Content-Type' so browser sets multipart/form-data boundary automatically!
                });

                const result = await response.json();

                if (response.ok) {
                    alert('Blog published successfully!');
                    localStorage.removeItem('vendorverse_admin_blog_draft'); // Clear draft
                    
                    // Reset Form
                    document.getElementById('blog-form').reset();
                    tagsArray = [];
                    updateTagsUI();
                    quill.setContents([{ insert: '\n' }]);
                } else {
                    alert('Failed to publish: ' + (result.error || result.message || 'Unknown error'));
                }
                
            } catch (error) {
                console.error("Blog submission error:", error);
                alert("Network error. Failed to reach the server.");
            } finally {
                // Restore UI
                publishBtn.innerHTML = originalBtnHtml;
                publishBtn.disabled = false;
            }
        });
    }

    // ---------------------------------------------------------
    // 6. PREVIEW FUNCTIONALITY
    // ---------------------------------------------------------
    const previewBtn = document.getElementById('blog-preview-btn');
    if (previewBtn) {
        previewBtn.addEventListener('click', () => {
            alert('Preview feature ready! You can link this to open a modal with quill.root.innerHTML injected.');
            // Implementation detail: Can easily open a new window or trigger modal showing real blog layout
        });
    }

});
