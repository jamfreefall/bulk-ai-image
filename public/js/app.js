// Application State
let selectedFiles = [];
let currentJobId = null;
let pollingInterval = null;
let imageRouterModels = []; // Store fetched models
let imageRouterAllModels = []; // Store all models before filtering
let selectedImageRouterSize = null; // ImageRouter specific settings
let selectedImageRouterQuality = 'auto';
let selectedMode = 'image-to-image'; // Default mode

// DOM Elements
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const selectedFilesContainer = document.getElementById('selectedFiles');
const promptInput = document.getElementById('promptInput');
const apiKeyInput = document.getElementById('apiKeyInput');
const imageRouterApiKeyInput = document.getElementById('imageRouterApiKeyInput');
const uploadBtn = document.getElementById('uploadBtn');
const uploadSection = document.getElementById('uploadSection');
const processingSection = document.getElementById('processingSection');
const resultsSection = document.getElementById('resultsSection');
const progressBar = document.getElementById('progressBar');
const progressStats = document.getElementById('progressStats');
const imageList = document.getElementById('imageList');
const resultsSummary = document.getElementById('resultsSummary');
const downloadBtn = document.getElementById('downloadBtn');
const newBatchBtn = document.getElementById('newBatchBtn');
const toastContainer = document.getElementById('toastContainer');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadApiKey();
    loadImageRouterModels(); // Load models on page load
});

// API Key Management
function loadApiKey() {
    const savedGeminiKey = sessionStorage.getItem('gemini_api_key');
    if (savedGeminiKey) {
        apiKeyInput.value = savedGeminiKey;
    }
    const savedImageRouterKey = sessionStorage.getItem('imagerouter_api_key');
    if (savedImageRouterKey) {
        imageRouterApiKeyInput.value = savedImageRouterKey;
    }
}

function saveApiKey() {
    const apiKey = apiKeyInput.value.trim();
    if (apiKey) {
        sessionStorage.setItem('gemini_api_key', apiKey);
    }
    const imageRouterKey = imageRouterApiKeyInput.value.trim();
    if (imageRouterKey) {
        sessionStorage.setItem('imagerouter_api_key', imageRouterKey);
    }
}

function validateApiKey() {
    const provider = document.querySelector('input[name="provider"]:checked').value;

    if (provider === 'imagerouter') {
        const apiKey = imageRouterApiKeyInput.value.trim();
        if (!apiKey) {
            showToast('Please enter your ImageRouter API key', 'error');
            imageRouterApiKeyInput.focus();
            return false;
        }
    } else {
        const apiKey = apiKeyInput.value.trim();
        if (!apiKey) {
            showToast('Please enter your Gemini API key', 'error');
            apiKeyInput.focus();
            return false;
        }
        if (!apiKey.startsWith('AIza')) {
            showToast('Invalid API key format. Key should start with "AIza"', 'error');
            apiKeyInput.focus();
            return false;
        }
    }
    return true;
}

// Event Listeners
function setupEventListeners() {
    // Upload zone click
    uploadZone.addEventListener('click', () => fileInput.click());

    // File input change
    fileInput.addEventListener('change', handleFileSelect);

    // Drag and drop
    uploadZone.addEventListener('dragover', handleDragOver);
    uploadZone.addEventListener('dragleave', handleDragLeave);
    uploadZone.addEventListener('drop', handleDrop);

    // Upload button
    uploadBtn.addEventListener('click', handleUpload);

    // Download button
    downloadBtn.addEventListener('click', handleDownload);

    // New batch button
    newBatchBtn.addEventListener('click', resetApp);

    // API key input - save on change
    apiKeyInput.addEventListener('change', saveApiKey);
    apiKeyInput.addEventListener('blur', saveApiKey);
    imageRouterApiKeyInput.addEventListener('change', saveApiKey);
    imageRouterApiKeyInput.addEventListener('blur', saveApiKey);

    // Provider selection change
    document.querySelectorAll('input[name="provider"]').forEach(radio => {
        radio.addEventListener('change', toggleProviderUI);
    });

    // Mode selection change
    document.querySelectorAll('input[name="mode"]').forEach(radio => {
        radio.addEventListener('change', toggleModeUI);
    });

    // Model selection change - update cost estimate and show/hide advanced settings
    document.querySelectorAll('input[name="model"]').forEach(radio => {
        radio.addEventListener('change', () => {
            updateCostEstimate();
            toggleAdvancedSettings();
        });
    });

    // Resolution change - update cost estimate
    document.getElementById('imageSize').addEventListener('change', updateCostEstimate);
}

// Toggle Provider UI
function toggleProviderUI() {
    const provider = document.querySelector('input[name="provider"]:checked').value;

    // Toggle API key sections
    const geminiApiKeySection = document.getElementById('geminiApiKeySection');
    const imageRouterApiKeySection = document.getElementById('imageRouterApiKeySection');

    // Toggle model selection sections
    const geminiModelSelection = document.getElementById('geminiModelSelection');
    const imageRouterModelSelection = document.getElementById('imageRouterModelSelection');

    // Toggle advanced settings
    const advancedSettings = document.getElementById('advancedSettings');

    if (provider === 'imagerouter') {
        geminiApiKeySection.classList.add('hidden');
        imageRouterApiKeySection.classList.remove('hidden');
        geminiModelSelection.classList.add('hidden');
        imageRouterModelSelection.classList.remove('hidden');
        advancedSettings.classList.add('hidden');
    } else {
        geminiApiKeySection.classList.remove('hidden');
        imageRouterApiKeySection.classList.add('hidden');
        geminiModelSelection.classList.remove('hidden');
        imageRouterModelSelection.classList.add('hidden');
        toggleAdvancedSettings();
    }

    updateCostEstimate();
    toggleModeUI(); // Update mode UI when provider changes
}

// Toggle Advanced Settings
function toggleAdvancedSettings() {
    const provider = document.querySelector('input[name="provider"]:checked').value;
    if (provider !== 'gemini') return;

    const selectedModel = document.querySelector('input[name="model"]:checked').value;
    const advancedSettings = document.getElementById('advancedSettings');

    if (selectedModel === 'gemini-3-pro-image-preview') {
        advancedSettings.classList.remove('hidden');
    } else {
        advancedSettings.classList.add('hidden');
    }
}

// Toggle Mode UI
function toggleModeUI() {
    const mode = document.querySelector('input[name="mode"]:checked').value;
    selectedMode = mode;

    const uploadZone = document.getElementById('uploadZone');
    const uploadCard = uploadZone.parentElement; // The upload-card div
    const promptHint = document.getElementById('promptHint');
    const provider = document.querySelector('input[name="provider"]:checked').value;

    if (mode === 'text-to-image') {
        // Hide upload zone for text-to-image
        uploadZone.classList.add('hidden');
        document.getElementById('selectedFiles').classList.add('hidden');

        // Update prompt hint
        promptHint.textContent = 'Describe the image you want to generate in detail';

        // Clear selected files
        selectedFiles = [];
        selectedFilesContainer.innerHTML = '';
        uploadBtn.disabled = false; // Enable button even without files

        // For ImageRouter, filter models to show all
        if (provider === 'imagerouter') {
            applyImageRouterFilters();
        }
    } else {
        // Show upload zone for image-to-image
        uploadZone.classList.remove('hidden');
        document.getElementById('selectedFiles').classList.remove('hidden');

        // Update prompt hint
        promptHint.textContent = 'Customize the instructions to tell the AI exactly how to process your images';

        // Disable button if no files
        uploadBtn.disabled = selectedFiles.length === 0;

        // For ImageRouter, filter models to show only edit-capable
        if (provider === 'imagerouter') {
            applyImageRouterFilters();
        }
    }

    // Update cost estimate when mode changes
    updateCostEstimate();
}

// ImageRouter Model Management
async function loadImageRouterModels() {
    try {
        const response = await fetch('/api/imagerouter/models');
        const data = await response.json();

        imageRouterAllModels = data.models || [];
        imageRouterModels = imageRouterAllModels;

        // Populate provider filter
        const providers = [...new Set(imageRouterModels.map(m => m.provider))].sort();
        const providerSelect = document.getElementById('irFilterProvider');
        providers.forEach(provider => {
            const option = document.createElement('option');
            option.value = provider;
            option.textContent = formatProviderName(provider);
            providerSelect.appendChild(option);
        });

        // Setup filter event listeners
        document.getElementById('irFilterFree').addEventListener('change', applyImageRouterFilters);
        document.getElementById('irFilterProvider').addEventListener('change', applyImageRouterFilters);
        document.getElementById('irFilterType').addEventListener('change', applyImageRouterFilters);

        // Initial render
        applyImageRouterFilters();
    } catch (error) {
        console.error('Error loading ImageRouter models:', error);
        document.getElementById('irFilterResults').innerHTML =
            '<span style="color: var(--color-error);">Failed to load models. Using defaults.</span>';

        // Render fallback models
        renderImageRouterModels([
            {
                id: 'black-forest-labs/FLUX-1.1-pro',
                name: 'FLUX 1.1 Pro',
                provider: 'black-forest-labs',
                isFree: false,
                pricing: { min: 0.04, max: 0.04 }
            }
        ]);
    }
}

function formatProviderName(provider) {
    return provider.split('-').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
}

function applyImageRouterFilters() {
    const freeOnly = document.getElementById('irFilterFree').checked;
    const provider = document.getElementById('irFilterProvider').value;
    const type = document.getElementById('irFilterType').value;
    const modeRadio = document.querySelector('input[name="mode"]:checked');
    const mode = modeRadio ? modeRadio.value : 'image-to-image';

    imageRouterModels = imageRouterAllModels.filter(model => {
        if (freeOnly && !model.isFree) return false;
        if (provider && model.provider !== provider) return false;
        if (type && !model.output.includes(type)) return false;

        // Filter by edit capability for image-to-image mode
        if (mode === 'image-to-image') {
            if (!model.supported_params || !model.supported_params.edit) return false;
        }

        return true;
    });

    renderImageRouterModels(imageRouterModels);
}

function renderImageRouterModels(models) {
    const container = document.getElementById('imageRouterModelList');
    const resultsEl = document.getElementById('irFilterResults');

    if (models.length === 0) {
        container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: var(--color-text-muted);">No models match your filters</div>';
        resultsEl.innerHTML = 'Showing <strong>0</strong> models';
        document.getElementById('imageRouterModelDetails').classList.add('hidden');
        return;
    }

    resultsEl.innerHTML = `Showing <strong>${models.length}</strong> model${models.length !== 1 ? 's' : ''}`;

    container.innerHTML = models.map((model, index) => `
        <div class="model-card">
            <input type="radio" 
                   id="irModel${index}" 
                   name="imageRouterModel" 
                   value="${model.id}"
                   data-model-id="${model.id}"
                   ${index === 0 ? 'checked' : ''}>
            <label for="irModel${index}">
                <div class="model-details">
                    <div class="model-header">
                        <span class="model-name">${model.name}</span>
                        ${model.isFree ? '<span class="badge-free">FREE</span>' : ''}
                    </div>
                    <div class="model-meta">
                        <span class="model-provider">${formatProviderName(model.provider)}</span>
                        ${!model.isFree ? `<span class="model-price">$${model.pricing.min.toFixed(4)}</span>` : ''}
                    </div>
                </div>
            </label>
        </div>
    `).join('');

    // Add event listeners to all radio buttons
    const radioButtons = container.querySelectorAll('input[type="radio"]');
    radioButtons.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.checked) {
                fetchModelDetails(e.target.dataset.modelId);
                updateCostEstimate(); // Update cost estimate when model changes
            }
        });
    });

    // Load details for the first model
    if (models.length > 0) {
        fetchModelDetails(models[0].id);
    }
}

// Fetch detailed model information
async function fetchModelDetails(modelId) {
    const detailsPanel = document.getElementById('imageRouterModelDetails');
    const nameEl = document.getElementById('irModelDetailsName');
    const dateEl = document.getElementById('irModelDetailsDate');
    const sizesEl = document.getElementById('irModelDetailsSizes');

    try {
        // Show loading state
        detailsPanel.classList.remove('hidden');
        nameEl.textContent = 'Loading...';
        dateEl.textContent = '';
        sizesEl.innerHTML = '<span style="color: var(--color-text-muted); font-size: 0.875rem;">Loading details...</span>';

        // Fetch model details
        const encodedModelId = encodeURIComponent(modelId);
        const response = await fetch(`https://api.imagerouter.io/v1/models/${encodedModelId}`);

        if (!response.ok) {
            throw new Error('Failed to fetch model details');
        }

        const data = await response.json();

        // Update model name
        const modelName = modelId.split('/')[1] || modelId;
        nameEl.textContent = modelName.replace(':free', '');

        // Update release date
        if (data.release_date) {
            const date = new Date(data.release_date);
            dateEl.textContent = `Released: ${date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`;
        } else {
            dateEl.textContent = '';
        }

        // Update sizes
        if (data.sizes && data.sizes.length > 0) {
            sizesEl.innerHTML = `
                <div class="model-sizes-label">Available Sizes:</div>
                <div class="model-sizes-grid">
                    ${data.sizes.map((size, idx) => `<div class="size-badge ${idx === 0 ? 'selected' : ''}" data-size="${size}">${size}</div>`).join('')}
                </div>
            `;

            // Add click handlers to size badges
            sizesEl.querySelectorAll('.size-badge').forEach(badge => {
                badge.style.cursor = 'pointer';
                badge.addEventListener('click', function () {
                    // Remove selected class from all badges
                    sizesEl.querySelectorAll('.size-badge').forEach(b => b.classList.remove('selected'));
                    // Add selected class to clicked badge
                    this.classList.add('selected');
                    // Update aspect ratio preview
                    updateAspectRatioPreview(this.dataset.size);
                    // Track selected size
                    selectedImageRouterSize = this.dataset.size;
                });
            });

            // Show initial aspect ratio preview and set initial size
            if (data.sizes.length > 0) {
                updateAspectRatioPreview(data.sizes[0]);
                selectedImageRouterSize = data.sizes[0];
            }
        } else if (data.seconds) {
            // For video models, show duration options
            const durations = Array.isArray(data.seconds) ? data.seconds : [data.seconds];
            sizesEl.innerHTML = `
                <div class="model-sizes-label">Available Durations:</div>
                <div class="model-sizes-grid">
                    ${durations.map((sec, idx) => `<div class="size-badge ${idx === 0 ? 'selected' : ''}" data-duration="${sec}">${sec}s</div>`).join('')}
                </div>
            `;

            // Add click handlers to duration badges
            sizesEl.querySelectorAll('.size-badge').forEach(badge => {
                badge.style.cursor = 'pointer';
                badge.addEventListener('click', function () {
                    // Remove selected class from all badges
                    sizesEl.querySelectorAll('.size-badge').forEach(b => b.classList.remove('selected'));
                    // Add selected class to clicked badge
                    this.classList.add('selected');
                });
            });
        } else {
            sizesEl.innerHTML = '<span style="color: var(--color-text-muted); font-size: 0.875rem;">Size: Auto</span>';
            selectedImageRouterSize = null; // Reset size for auto
        }

        // Handle quality settings
        const qualitySettings = document.getElementById('irQualitySettings');
        const qualitySelect = document.getElementById('irQualitySelect');

        if (data.supported_params && data.supported_params.quality) {
            // Model supports quality settings
            qualitySettings.classList.remove('hidden');

            // Check if model is free - default to 'low' for free models
            const isFree = modelId.endsWith(':free');
            if (isFree) {
                qualitySelect.value = 'low';
                selectedImageRouterQuality = 'low';
            } else {
                qualitySelect.value = 'auto';
                selectedImageRouterQuality = 'auto';
            }

            // Add change listener
            qualitySelect.onchange = function () {
                selectedImageRouterQuality = this.value;
            };
        } else {
            // Model doesn't support quality settings
            qualitySettings.classList.add('hidden');
            selectedImageRouterQuality = 'auto';
        }

    } catch (error) {
        console.error('Error fetching model details:', error);
        nameEl.textContent = 'Error loading details';
        dateEl.textContent = '';
        sizesEl.innerHTML = '<span style="color: var(--color-error); font-size: 0.875rem;">Failed to load model details</span>';
    }
}

// Update aspect ratio preview
function updateAspectRatioPreview(sizeString) {
    const previewEl = document.getElementById('irAspectRatioPreview');
    const boxEl = document.getElementById('irAspectRatioBox');
    const dimensionsEl = document.getElementById('irAspectRatioDimensions');

    if (!sizeString || sizeString === 'auto') {
        previewEl.classList.add('hidden');
        return;
    }

    // Parse size string (e.g., "1024x1024", "1920x1080")
    const parts = sizeString.toLowerCase().split('x');
    if (parts.length !== 2) {
        previewEl.classList.add('hidden');
        return;
    }

    const width = parseInt(parts[0]);
    const height = parseInt(parts[1]);

    if (isNaN(width) || isNaN(height)) {
        previewEl.classList.add('hidden');
        return;
    }

    // Calculate aspect ratio
    const aspectRatio = width / height;

    // Set max dimensions for the preview box
    const maxWidth = 200;
    const maxHeight = 150;

    let boxWidth, boxHeight;

    if (aspectRatio > 1) {
        // Landscape
        boxWidth = maxWidth;
        boxHeight = maxWidth / aspectRatio;
        if (boxHeight > maxHeight) {
            boxHeight = maxHeight;
            boxWidth = maxHeight * aspectRatio;
        }
    } else {
        // Portrait or square
        boxHeight = maxHeight;
        boxWidth = maxHeight * aspectRatio;
        if (boxWidth > maxWidth) {
            boxWidth = maxWidth;
            boxHeight = maxWidth / aspectRatio;
        }
    }

    // Update box dimensions
    boxEl.style.width = `${boxWidth}px`;
    boxEl.style.height = `${boxHeight}px`;

    // Update dimensions text
    dimensionsEl.textContent = `${width} × ${height} (${aspectRatio.toFixed(2)}:1)`;

    // Show preview
    previewEl.classList.remove('hidden');
}

// Cost Calculation
const PRICING = {
    'gemini-2.5-flash-image': {
        '1K': { input: 0, output: 0.039 },
        '2K': { input: 0, output: 0.134 },
        '4K': { input: 0, output: 0.24 },
        name: 'Gemini 2.5 Flash'
    },
    'gemini-3-pro-image-preview': {
        '1K': { input: 0.0011, output: 0.039 },
        '2K': { input: 0.0011, output: 0.134 },
        '4K': { input: 0.0011, output: 0.24 },
        name: 'Gemini 3 Pro Image'
    }
};

function updateCostEstimate() {
    const costEstimateEl = document.getElementById('costEstimate');
    const costValueEl = document.getElementById('costValue');
    const costBreakdownEl = document.getElementById('costBreakdown');

    const provider = document.querySelector('input[name="provider"]:checked').value;
    const modeRadio = document.querySelector('input[name="mode"]:checked');
    const mode = modeRadio ? modeRadio.value : 'image-to-image';

    // For text-to-image mode, use 1 as count, otherwise use selectedFiles length
    const imageCount = mode === 'text-to-image' ? 1 : selectedFiles.length;

    if (imageCount === 0) {
        costEstimateEl.classList.add('hidden');
        return;
    }

    if (provider === 'gemini') {
        // Gemini pricing
        const selectedModel = document.querySelector('input[name="model"]:checked').value;
        const resolution = document.getElementById('imageSize').value;
        const pricing = PRICING[selectedModel][resolution];

        const totalCost = imageCount * (pricing.input + pricing.output);

        costValueEl.textContent = `$${totalCost.toFixed(4)}`;
        costBreakdownEl.textContent = `${imageCount} image${imageCount > 1 ? 's' : ''} × $${(pricing.input + pricing.output).toFixed(4)} (${PRICING[selectedModel].name}, ${resolution})`;

        costEstimateEl.classList.remove('hidden');
    } else if (provider === 'imagerouter') {
        // ImageRouter pricing
        const selectedModelRadio = document.querySelector('input[name="imageRouterModel"]:checked');
        if (!selectedModelRadio) {
            costEstimateEl.classList.add('hidden');
            return;
        }

        const selectedModelId = selectedModelRadio.value;
        const model = imageRouterModels.find(m => m.id === selectedModelId);

        if (!model) {
            costEstimateEl.classList.add('hidden');
            return;
        }

        if (model.isFree) {
            costValueEl.textContent = 'FREE';
            costBreakdownEl.textContent = `${imageCount} image${imageCount > 1 ? 's' : ''} × $0.00 (${model.name})`;
            costEstimateEl.classList.remove('hidden');
        } else {
            // Use average pricing if available, otherwise use min
            const pricePerImage = model.pricing.average || model.pricing.min;
            const totalCost = imageCount * pricePerImage;

            costValueEl.textContent = `$${totalCost.toFixed(4)}`;

            // Show price range if min and max differ
            if (model.pricing.min !== model.pricing.max) {
                costBreakdownEl.textContent = `${imageCount} image${imageCount > 1 ? 's' : ''} × $${pricePerImage.toFixed(4)} (${model.name}, estimated)`;
            } else {
                costBreakdownEl.textContent = `${imageCount} image${imageCount > 1 ? 's' : ''} × $${pricePerImage.toFixed(4)} (${model.name})`;
            }

            costEstimateEl.classList.remove('hidden');
        }
    } else {
        costEstimateEl.classList.add('hidden');
    }
}

// File Selection Handlers
function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    addFiles(files);
}

function handleDragOver(e) {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');

    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
}

function addFiles(files) {
    // Filter image files
    const imageFiles = files.filter(file => file.type.startsWith('image/'));

    // Check limits
    const totalFiles = selectedFiles.length + imageFiles.length;
    if (totalFiles > 20) {
        showToast('Maximum 20 images allowed', 'error');
        return;
    }

    // Check file sizes
    const oversizedFiles = imageFiles.filter(file => file.size > 10 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
        showToast('Some files exceed 10MB limit', 'error');
        return;
    }

    // Add to selected files
    selectedFiles = [...selectedFiles, ...imageFiles];

    // Update UI
    renderSelectedFiles();

    // Only disable button if in image-to-image mode and no files
    const mode = document.querySelector('input[name="mode"]:checked').value;
    if (mode === 'image-to-image') {
        uploadBtn.disabled = selectedFiles.length === 0;
    }

    updateCostEstimate();

    showToast(`${imageFiles.length} image(s) added`, 'success');
}

function renderSelectedFiles() {
    selectedFilesContainer.innerHTML = '';

    selectedFiles.forEach((file, index) => {
        const preview = document.createElement('div');
        preview.className = 'file-preview';

        // Create image preview
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.alt = file.name;

        const fileName = document.createElement('div');
        fileName.className = 'file-name';
        fileName.textContent = file.name;

        preview.appendChild(img);
        preview.appendChild(fileName);
        selectedFilesContainer.appendChild(preview);
    });
}

// Upload Handler
async function handleUpload() {
    const mode = document.querySelector('input[name="mode"]:checked').value;

    // Only check for files in image-to-image mode
    if (mode === 'image-to-image' && selectedFiles.length === 0) {
        showToast('Please select at least one image', 'error');
        return;
    }

    // Validate API key first
    if (!validateApiKey()) {
        return;
    }

    uploadBtn.disabled = true;

    try {
        const formData = new FormData();
        selectedFiles.forEach(file => {
            formData.append('images', file);
        });

        // Add provider selection
        const provider = document.querySelector('input[name="provider"]:checked').value;
        formData.append('provider', provider);

        // Add API keys
        if (provider === 'imagerouter') {
            formData.append('imageRouterApiKey', imageRouterApiKeyInput.value.trim());
        } else {
            formData.append('apiKey', apiKeyInput.value.trim());
        }

        // Add custom prompt
        const customPrompt = promptInput.value.trim();
        if (customPrompt) {
            formData.append('prompt', customPrompt);
        }

        // Add selected model based on provider
        let selectedModel;
        if (provider === 'imagerouter') {
            selectedModel = document.querySelector('input[name="imageRouterModel"]:checked').value;
        } else {
            selectedModel = document.querySelector('input[name="model"]:checked').value;
        }
        formData.append('model', selectedModel);

        // Add mode to form data
        formData.append('mode', selectedMode);

        // Add advanced settings if Gemini 3 Pro is selected
        if (provider === 'gemini' && selectedModel === 'gemini-3-pro-image-preview') {
            const aspectRatio = document.getElementById('aspectRatio').value;
            const imageSize = document.getElementById('imageSize').value;
            formData.append('aspectRatio', aspectRatio);
            formData.append('imageSize', imageSize);
        }

        // Add ImageRouter specific settings
        if (provider === 'imagerouter') {
            formData.append('quality', selectedImageRouterQuality);
            formData.append('size', selectedImageRouterSize || 'auto');
        }

        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            currentJobId = data.jobId;
            showProcessingSection();
            startPolling();
            showToast('Processing started!', 'success');
        } else {
            throw new Error(data.error || 'Upload failed');
        }
    } catch (error) {
        console.error('Upload error:', error);
        showToast(error.message, 'error');
        uploadBtn.disabled = false;
    }
}

// Processing Section
function showProcessingSection() {
    uploadSection.classList.add('hidden');
    processingSection.classList.remove('hidden');

    // Initialize image list
    imageList.innerHTML = '';

    if (selectedFiles.length > 0) {
        selectedFiles.forEach((file, index) => {
            const item = createImageItem(file.name, 'pending');
            imageList.appendChild(item);
        });
    } else if (selectedMode === 'text-to-image') {
        const item = createImageItem('Generating from prompt...', 'pending');
        imageList.appendChild(item);
    }
}

function createImageItem(name, status) {
    const item = document.createElement('div');
    item.className = 'image-item';

    const icon = document.createElement('div');
    icon.className = 'image-item-icon';
    icon.innerHTML = getStatusIcon(status);

    const info = document.createElement('div');
    info.className = 'image-item-info';

    const nameEl = document.createElement('div');
    nameEl.className = 'image-item-name';
    nameEl.textContent = name;

    const statusEl = document.createElement('div');
    statusEl.className = 'image-item-status';
    statusEl.innerHTML = `<span class="status-badge ${status}">${status}</span>`;

    info.appendChild(nameEl);
    info.appendChild(statusEl);

    item.appendChild(icon);
    item.appendChild(info);

    return item;
}

function getStatusIcon(status) {
    const icons = {
        pending: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg>',
        processing: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"></path></svg>',
        completed: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
        failed: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>'
    };
    return icons[status] || icons.pending;
}

// Polling
function startPolling() {
    pollingInterval = setInterval(checkJobStatus, 2000);
    checkJobStatus(); // Check immediately
}

function stopPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
}

async function checkJobStatus() {
    if (!currentJobId) return;

    try {
        const response = await fetch(`/api/status/${currentJobId}`);
        const data = await response.json();

        console.log('Status response:', data);

        // Server returns the job object directly, not wrapped in {success: true, job: ...}
        if (data && data.jobId) {
            updateProcessingUI(data);

            if (data.status === 'completed') {
                console.log('Job completed! Calling showResultsSection...');
                stopPolling();
                showResultsSection(data);
            }
        }
    } catch (error) {
        console.error('Status check error:', error);
    }
}

function updateProcessingUI(job) {
    // Update progress bar
    const percentage = (job.progress.completed / job.progress.total) * 100;
    progressBar.style.width = `${percentage}%`;

    // Update stats
    progressStats.innerHTML = `
    <span class="stat">${job.progress.completed} / ${job.progress.total} completed</span>
    ${job.progress.failed > 0 ? `<span class="stat" style="background: rgba(239, 68, 68, 0.2);">${job.progress.failed} failed</span>` : ''}
  `;

    // Update image list
    const items = imageList.querySelectorAll('.image-item');
    job.images.forEach((image, index) => {
        if (items[index]) {
            const statusBadge = items[index].querySelector('.status-badge');
            const icon = items[index].querySelector('.image-item-icon');
            const statusContainer = items[index].querySelector('.image-item-status');

            if (statusBadge) {
                statusBadge.className = `status-badge ${image.status}`;
                statusBadge.textContent = image.status;
            }

            if (icon) {
                icon.innerHTML = getStatusIcon(image.status);
            }

            // Show error message if failed
            if (image.status === 'failed' && image.error && statusContainer) {
                const errorMsg = statusContainer.querySelector('.error-message');
                if (!errorMsg) {
                    const errorDiv = document.createElement('div');
                    errorDiv.className = 'error-message';
                    errorDiv.textContent = `Error: ${image.error}`;
                    statusContainer.appendChild(errorDiv);
                }
            }
        }
    });
}

// Results Section
function showResultsSection(job) {
    processingSection.classList.add('hidden');
    resultsSection.classList.remove('hidden');

    // Create summary
    resultsSummary.innerHTML = `
    <div class="summary-card">
      <div class="summary-value">${job.progress.completed}</div>
      <div class="summary-label">Successfully Processed</div>
    </div>
    <div class="summary-card">
      <div class="summary-value">${job.progress.failed}</div>
      <div class="summary-label">Failed</div>
    </div>
    <div class="summary-card">
      <div class="summary-value">${job.progress.total}</div>
      <div class="summary-label">Total Images</div>
    </div>
  `;

    console.log('showResultsSection called with job:', job);
    console.log('Completed images:', job.progress.completed);
    console.log('Job images array:', job.images);

    // Add image gallery for successful images (always show, even for 1 image)
    if (job.progress.completed >= 1) {
        console.log('✓ Creating gallery (completed >= 1)...');
        const successfulImages = job.images.filter(img => img.status === 'completed');
        console.log('✓ Successful images filtered:', successfulImages);
        console.log('✓ Number of successful images:', successfulImages.length);

        if (successfulImages.length === 0) {
            console.error('❌ ERROR: No successful images found even though completed count is', job.progress.completed);
            console.error('All images:', job.images);
        }

        const gallerySection = document.createElement('div');
        gallerySection.className = 'image-gallery';
        console.log('✓ Gallery section created');
        gallerySection.innerHTML = `
      <h3 class="gallery-title">Processed Images</h3>
      <div class="gallery-grid">
        ${successfulImages.map((img, index) => {
            const filename = img.outputPath.split(/[\\/]/).pop();
            const originalName = img.path.split(/[\\/]/).pop();
            return `
          <div class="gallery-item">
            <div class="gallery-image-container" data-filename="${filename}">
              <img src="/outputs/${filename}" alt="Processed image ${index + 1}" class="gallery-image">
              <div class="gallery-overlay">
                <button class="gallery-btn" data-filename="${filename}" data-original="${originalName}">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  Download
                </button>
              </div>
            </div>
            <p class="gallery-filename">${originalName}</p>
          </div>
        `;
        }).join('')}
      </div>
    `;
        console.log('Gallery HTML created, appending after results summary...');

        // Append gallery to the results section (not inside resultsSummary)
        // This makes it appear below the stats panel
        const resultsCard = resultsSummary.parentElement;
        resultsCard.appendChild(gallerySection);

        console.log('Gallery appended! Adding event listeners...');

        // Add click event listeners to images for preview
        const galleryImages = gallerySection.querySelectorAll('.gallery-image-container');
        galleryImages.forEach(container => {
            container.addEventListener('click', () => {
                const filename = container.dataset.filename;
                console.log('Image clicked:', filename);
                window.openImagePreview(filename);
            });
        });

        // Add click event listeners to download buttons
        const downloadButtons = gallerySection.querySelectorAll('.gallery-btn');
        downloadButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent triggering image preview
                const filename = btn.dataset.filename;
                const original = btn.dataset.original;
                console.log('Download clicked:', filename);
                window.downloadSingleImage(filename, original);
            });
        });

        console.log('Event listeners added!');
    } else {
        console.log('Skipping gallery creation - no completed images');
    }

    // Add error details if there are failures
    if (job.progress.failed > 0) {
        const failedImages = job.images.filter(img => img.status === 'failed');
        const errorSection = document.createElement('div');
        errorSection.className = 'error-details';
        errorSection.innerHTML = `
            <h3 class="error-details-title">⚠️ Failed Images</h3>
            ${failedImages.map(img => `
                <div class="error-detail-item">
                    <strong>${img.path ? img.path.split(/[\\/]/).pop() : 'Unknown file'}</strong>
                    <p>${img.error || 'Unknown error'}</p>
                </div>
            `).join('')}
        `;
        resultsSummary.appendChild(errorSection);
    }

    // Show appropriate completion message
    if (job.progress.completed > 0 && job.progress.failed === 0) {
        showToast('All images processed successfully!', 'success');
    } else if (job.progress.completed > 0 && job.progress.failed > 0) {
        showToast(`Processing complete: ${job.progress.completed} succeeded, ${job.progress.failed} failed`, 'warning');
    } else {
        showToast('All images failed to process. Check errors below.', 'error');
    }
}

// Download Handler
async function handleDownload() {
    if (!currentJobId) return;

    try {
        downloadBtn.disabled = true;
        downloadBtn.innerHTML = '<span>Preparing download...</span>';

        // Trigger download
        window.location.href = `/api/download/${currentJobId}`;

        setTimeout(() => {
            downloadBtn.disabled = false;
            downloadBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        <span>Download All as ZIP</span>
      `;
            showToast('Download started!', 'success');
        }, 1000);

    } catch (error) {
        console.error('Download error:', error);
        showToast('Download failed', 'error');
        downloadBtn.disabled = false;
    }
}

// Reset App
function resetApp() {
    selectedFiles = [];
    currentJobId = null;
    stopPolling();

    uploadSection.classList.remove('hidden');
    processingSection.classList.add('hidden');
    resultsSection.classList.add('hidden');

    selectedFilesContainer.innerHTML = '';
    fileInput.value = '';
    promptInput.value = 'Enhance this image: improve quality, adjust colors and lighting, sharpen details, and make it look professional and polished.';

    toggleModeUI(); // Restore UI state based on current mode
    showToast('Ready for new batch', 'success');
}

// Toast Notifications
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideIn 300ms reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Image Preview and Download (make global for onclick handlers)
window.downloadSingleImage = function (filename, originalName) {
    const link = document.createElement('a');
    link.href = `/outputs/${filename}`;
    link.download = `enhanced_${originalName}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Image downloaded!', 'success');
}

window.openImagePreview = function (filename) {
    // Create lightbox overlay
    const lightbox = document.createElement('div');
    lightbox.className = 'lightbox';
    lightbox.innerHTML = `
    <div class="lightbox-content">
      <button class="lightbox-close" onclick="closeLightbox()">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      <img src="/outputs/${filename}" alt="Preview" class="lightbox-image">
      <div class="lightbox-actions">
        <button class="btn btn-secondary" onclick="downloadSingleImage('${filename}', '${filename}')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          Download
        </button>
      </div>
    </div>
  `;

    document.body.appendChild(lightbox);

    // Close on background click
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) {
            closeLightbox();
        }
    });
}

window.closeLightbox = function () {
    const lightbox = document.querySelector('.lightbox');
    if (lightbox) {
        lightbox.remove();
    }
}
