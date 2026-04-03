/**
 * Blog Management System Logic
 * Handles Quill editor, Tag system, Image uploads, Auto-save, and API submission.
 */

document.addEventListener('DOMContentLoaded', () => {
    // === DOM ELEMENTS ===
    const titleInput = document.getElementById('blog-title');
    const categorySelect = document.getElementById('blog-category');
    const writerInput = document.getElementById('blog-writer');
    const expertToggle = document.getElementById('blog-expert-toggle');
    const imageInput = document.getElementById('blog-images');
    const imageDropzone = document.getElementById('blog-image-dropzone');
    const imagePreview = document.getElementById('blog-image-preview');
    const tagInput = document.getElementById('blog-tag-input');
    const tagsList = document.getElementById('blog-tags-list');
    const wordCountEl = document.getElementById('word-count');
    const readingTimeEl = document.getElementById('reading-time');
    const autoSaveStatus = document.getElementById('auto-save-status');
    
    const previewBtn = document.getElementById('btn-preview-blog');
    const saveDraftBtn = document.getElementById('btn-save-draft');
    const publishBtn = document.getElementById('btn-publish-blog');
    
    const previewModal = document.getElementById('blog-preview-modal');
    const closePreview = document.getElementById('close-preview');

    let uploadedFiles = [];
    let blogTags = [];

    // === QUILL EDITOR INITIALIZATION ===
    // We use the full toolbar as requested
    const quill = new Quill('#blog-editor-content', {
        theme: 'snow',
        modules: {
            toolbar: {
                container: [
                    [{ 'font': [] }, { 'size': ['small', false, 'large', 'huge'] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'color': [] }, { 'background': [] }],
                    [{ 'script': 'sub' }, { 'script': 'super' }],
                    [{ 'header': 1 }, { 'header': 2 }, { 'header': [3, 4, 5, 6, false] }],
                    [{ 'list': 'ordered' }, { 'list': 'bullet' }, { 'list': 'check' }],
                    [{ 'indent': '-1' }, { 'indent': '+1' }],
                    [{ 'direction': 'rtl' }, { 'align': [] }],
                    ['link', 'image', 'video'],
                    ['code-block', 'blockquote'],
                    ['clean']
                ]
            }
        },
        placeholder: 'Compose your masterpiece...'
    });

    // === DYNAMIC TAG SYSTEM ===
    tagInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const val = tagInput.value.trim().replace(/^#/, '');
            if (val && !blogTags.includes(val)) {
                blogTags.push(val);
                renderTags();
                tagInput.value = '';
            }
        }
    });

    function renderTags() {
        tagsList.innerHTML = '';
        blogTags.forEach(tag => {
            const pill = document.createElement('div');
            pill.className = 'tag-pill';
            pill.innerHTML = `<span>#${tag}</span><i class="fas fa-times-circle"></i>`;
            pill.querySelector('i').onclick = () => {
                blogTags = blogTags.filter(t => t !== tag);
                renderTags();
            };
            tagsList.appendChild(pill);
        });
    }

    // === IMAGE UPLOAD & DRAG/DROP ===
    imageDropzone.addEventListener('click', () => imageInput.click());
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        imageDropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
        }, false);
    });

    imageDropzone.addEventListener('dragover', () => imageDropzone.style.borderColor = 'var(--blog-primary)');
    imageDropzone.addEventListener('dragleave', () => imageDropzone.style.borderColor = '#cbd5e1');

    imageDropzone.addEventListener('drop', (e) => {
        imageDropzone.style.borderColor = '#cbd5e1';
        const files = e.dataTransfer.files;
        handleFiles(files);
    });

    imageInput.addEventListener('change', (e) => handleFiles(e.target.files));

    function handleFiles(files) {
        Array.from(files).forEach(file => {
            if (!file.type.startsWith('image/')) return;
            uploadedFiles.push(file);
            
            const reader = new FileReader();
            reader.onload = (e) => {
                const item = document.createElement('div');
                item.className = 'preview-item';
                item.innerHTML = `
                    <img src="${e.target.result}">
                    <button class="remove-img"><i class="fas fa-times"></i></button>
                `;
                item.querySelector('.remove-img').onclick = () => {
                    uploadedFiles = uploadedFiles.filter(f => f !== file);
                    item.remove();
                };
                imagePreview.appendChild(item);
            };
            reader.readAsDataURL(file);
        });
    }

    // === WORD COUNT & READING TIME ===
    quill.on('text-change', () => {
        const text = quill.getText().trim();
        const words = text ? text.split(/\s+/).length : 0;
        const time = Math.max(1, Math.ceil(words / 225)); // ~225 wpm
        
        wordCountEl.textContent = `${words} words`;
        readingTimeEl.textContent = `${time} min read`;
    });

    // === AUTO-SAVE TO LOCAL STORAGE ===
    function performAutoSave() {
        const data = {
            title: titleInput.value,
            category: categorySelect.value,
            writer: writerInput.value,
            expert: expertToggle.checked,
            content: quill.root.innerHTML,
            tags: blogTags
        };
        localStorage.setItem('admin_blog_draft', JSON.stringify(data));
        
        const now = new Date();
        const timeStr = now.getHours() + ':' + now.getMinutes().toString().padStart(2, '0');
        autoSaveStatus.textContent = `Draft saved at ${timeStr}`;
        autoSaveStatus.style.opacity = '1';
        setTimeout(() => autoSaveStatus.style.opacity = '0.7', 2000);
    }

    setInterval(performAutoSave, 10000); // Every 10 seconds

    // Restore draft if exists
    const saved = localStorage.getItem('admin_blog_draft');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            titleInput.value = data.title || '';
            categorySelect.value = data.category || 'Technology';
            writerInput.value = data.writer || '';
            expertToggle.checked = !!data.expert;
            quill.root.innerHTML = data.content || '';
            blogTags = data.tags || [];
            renderTags();
        } catch (e) {
            console.error("Draft restoration failed", e);
        }
    }

    // === PREVIEW MODAL LOGIC ===
    const previewArea = document.getElementById('preview-render-area');

    function renderBlogPreview(data) {
        const images = data.images || [];
        // Handle images differently if they are from the server (relative path) or local (Base64)
        const coverImg = images.length > 0 ? (images[0].startsWith('data:') || images[0].startsWith('blob:') ? images[0] : '../../' + images[0]) : '';
        
        previewArea.innerHTML = `
            <div class="preview-meta">
                <span class="preview-category">${data.category}</span>
                <h1 class="preview-title">${data.title || 'Untitled Masterpiece'}</h1>
                <div class="preview-author">
                    ${data.expert ? '<i class="fas fa-certificate" style="color:var(--blog-warning)"></i> ' : ''}
                    By <strong>${data.writer || 'Anonymous'}</strong> • ${new Date().toLocaleDateString()}
                    ${data.expert ? '<span class="badge-expert" style="margin-left:10px; color:var(--blog-accent); font-size:0.8rem;"><i class="fas fa-check-circle"></i> Expert Verified</span>' : ''}
                </div>
            </div>
            ${coverImg ? `<img src="${coverImg}" class="preview-main-img" style="width:100%; border-radius:1rem; margin-bottom:2rem; box-shadow:0 10px 25px rgba(0,0,0,0.1);">` : ''}
            <div class="preview-main-content ql-editor">${data.content}</div>
            <div class="preview-tags" style="margin-top:2rem; border-top:1px solid #eee; padding-top:1rem;">
                ${(data.tags || []).map(t => `<span class="preview-tag" style="margin-right:10px; color:#6b7280;">#${t}</span>`).join('')}
            </div>
        `;
        previewModal.style.display = 'flex';
    }

    previewBtn.onclick = () => {
        const data = {
            title: titleInput.value,
            category: categorySelect.value,
            writer: writerInput.value,
            expert: expertToggle.checked,
            content: quill.root.innerHTML,
            tags: blogTags,
            images: Array.from(imagePreview.querySelectorAll('img')).map(img => img.src)
        };
        renderBlogPreview(data);
    };

    closePreview.onclick = () => previewModal.style.display = 'none';
    
    window.addEventListener('click', (e) => {
        if (e.target === previewModal) previewModal.style.display = 'none';
    });

    // === API SUBMISSION ===
    async function handleBlogSubmit(status) {
        // Validation
        if (!titleInput.value.trim()) return alert('Please enter a title');
        if (quill.getText().trim().length < 10) return alert('Content is too short');

        const formData = new FormData();
        formData.append('title', titleInput.value.trim());
        formData.append('category', categorySelect.value);
        formData.append('writer', writerInput.value.trim() || 'Admin');
        formData.append('expert', expertToggle.checked);
        formData.append('content', quill.root.innerHTML);
        formData.append('tags', JSON.stringify(blogTags));
        formData.append('status', status);

        uploadedFiles.forEach(file => {
            formData.append('images', file);
        });

        const activeBtn = status === 'published' ? publishBtn : saveDraftBtn;
        const originalHTML = activeBtn.innerHTML;
        
        activeBtn.disabled = true;
        activeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

        try {
            const response = await fetch('/add-blog', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                alert(`Success! Blog ${status === 'published' ? 'published' : 'saved as draft'}.`);
                if (status === 'published') {
                    localStorage.removeItem('admin_blog_draft');
                    loadAdminBlogs();
                } else {
                    loadAdminBlogs();
                }
            } else {
                alert('Error: ' + (result.error || 'Server error'));
            }
        } catch (err) {
            console.error(err);
            alert('Network error. Check console.');
        } finally {
            activeBtn.disabled = false;
            activeBtn.innerHTML = originalHTML;
        }
    }

    publishBtn.onclick = () => handleBlogSubmit('published');
    saveDraftBtn.onclick = () => handleBlogSubmit('draft');

    // === ADMIN LISTING & MANAGEMENT ===
    window.loadAdminBlogs = async function() {
        const tableBody = document.getElementById('admin-blogs-table-body');
        if (!tableBody) return;

        try {
            const response = await fetch('/api/admin/blogs/list');
            const data = await response.json();

            if (data.success) {
                if (data.blogs.length === 0) {
                    tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No blogs found.</td></tr>';
                    return;
                }

                tableBody.innerHTML = data.blogs.map(blog => `
                    <tr>
                        <td>${new Date(blog.created_at).toLocaleDateString()}</td>
                        <td style="font-weight:600;">${blog.title}</td>
                        <td><span class="badge-mini">${blog.category}</span></td>
                        <td><span class="status-badge ${blog.status}">${blog.status.toUpperCase()}</span></td>
                        <td>
                            <div class="action-btns-mini">
                                <button class="btn-icon view" title="View" onclick="viewBlogDetails(${blog.id})"><i class="fas fa-eye"></i></button>
                                <button class="btn-icon delete" title="Delete" onclick="deleteBlog(${blog.id})"><i class="fas fa-trash"></i></button>
                            </div>
                        </td>
                    </tr>
                `).join('');
            }
        } catch (err) {
            console.error("Failed to load blogs", err);
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Error loading blogs.</td></tr>';
        }
    };

    window.deleteBlog = async function(id) {
        if (!confirm('Are you sure you want to delete this blog? This action cannot be undone.')) return;

        try {
            const response = await fetch(`/api/admin/blogs/delete/${id}`, { method: 'DELETE' });
            const result = await response.json();

            if (result.success) {
                alert('Blog deleted successfully');
                loadAdminBlogs();
            } else {
                alert('Error: ' + result.error);
            }
        } catch (err) {
            console.error(err);
            alert('Failed to delete blog.');
        }
    };

    window.viewBlogDetails = async function(id) {
        try {
            // Find in current table data or fetch (let's just fetch for clean data)
            const response = await fetch('/api/admin/blogs/list');
            const data = await response.json();
            const blog = data.blogs.find(b => b.id === id);

            if (blog) {
                // Prepare data for preview (parse JSON fields)
                const previewData = {
                    ...blog,
                    expert: blog.is_expert,
                    tags: JSON.parse(blog.tags || '[]'),
                    images: JSON.parse(blog.images || '[]')
                };
                renderBlogPreview(previewData);
                previewModal.style.display = 'block';
            }
        } catch (err) {
            console.error(err);
            alert('Failed to load blog details.');
        }
    };

    // Initial load
    loadAdminBlogs();
});
