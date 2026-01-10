// Application State
let selectedFiles = [];
let currentJobId = null;
let pollingInterval = null;

// DOM Elements
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const selectedFilesContainer = document.getElementById('selectedFiles');
const promptInput = document.getElementById('promptInput');
const apiKeyInput = document.getElementById('apiKeyInput');
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
});

// API Key Management
function loadApiKey() {
    const savedKey = sessionStorage.getItem('gemini_api_key');
    if (savedKey) {
        apiKeyInput.value = savedKey;
    }
}

function saveApiKey() {
    const apiKey = apiKeyInput.value.trim();
    if (apiKey) {
        sessionStorage.setItem('gemini_api_key', apiKey);
    }
}

function validateApiKey() {
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
    return true;
}
