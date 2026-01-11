require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('crypto');

const GeminiProcessor = require('./lib/gemini-processor');
const ImageRouterProcessor = require('./lib/imagerouter-processor');
const QueueManager = require('./lib/queue-manager');
const ZipGenerator = require('./lib/zip-generator');
const os = require('os');

// Storage configuration for Vercel compatibility
const isVercel = process.env.VERCEL === '1';
const storageBaseDir = isVercel ? os.tmpdir() : __dirname;
const uploadDir = path.join(storageBaseDir, 'uploads');
const outputDir = path.join(storageBaseDir, 'outputs');
const tempDir = path.join(storageBaseDir, 'temp');

// Ensure directories exist (synchronous for initial setup, but safe in serverless start)
const mkdirSync = (dir) => {
    if (!require('fs').existsSync(dir)) {
        require('fs').mkdirSync(dir, { recursive: true });
    }
};

mkdirSync(uploadDir);
mkdirSync(outputDir);
mkdirSync(tempDir);

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Initialize services
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey && !isVercel) {
    console.warn('WARNING: GEMINI_API_KEY not found in .env file');
}

// Store API key for creating processors per job
const geminiApiKey = apiKey;

const maxConcurrent = parseInt(process.env.MAX_CONCURRENT_REQUESTS) || 3;
const queueManager = new QueueManager(maxConcurrent);

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${file.originalname}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
        files: 20 // Max 20 files
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.'));
        }
    }
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/outputs', express.static(outputDir)); // Serve processed images from centralized output dir

// Explicit route for index.html (helpful for Vercel)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Generate unique job ID
function generateJobId() {
    return `job_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

// Process images for a job
async function processJob(jobId, apiKey, customPrompt, selectedModel, aspectRatio, imageSize, provider = 'gemini', imageRouterApiKey = null, irQuality = 'auto', irSize = 'auto') {
    console.log(`\n=== Starting processJob ===`);
    console.log(`Job ID: ${jobId}`);
    console.log(`Provider: ${provider}`);
    console.log(`API Key: ${apiKey ? apiKey.substring(0, 10) + '...' : 'MISSING'}`);
    console.log(`ImageRouter API Key: ${imageRouterApiKey ? imageRouterApiKey.substring(0, 10) + '...' : 'N/A'}`);
    console.log(`Model: ${selectedModel}`);
    console.log(`Prompt: ${customPrompt}`);
    console.log(`Quality: ${irQuality}, Size: ${irSize}`);

    const job = queueManager.getJob(jobId);
    if (!job) {
        console.error(`Job ${jobId} not found!`);
        return;
    }

    queueManager.startJob(jobId);
    console.log(`Job started, processing ${job.images.length} images`);

    try {
        let processor;

        // Create processor based on selected provider
        if (provider === 'imagerouter') {
            console.log('Creating ImageRouterProcessor...');
            processor = new ImageRouterProcessor(
                imageRouterApiKey,
                customPrompt || process.env.ENHANCEMENT_PROMPT,
                selectedModel,
                irQuality,
                'png',
                irSize
            );
        } else {
            // Default to Gemini
            console.log('Creating GeminiProcessor...');
            processor = new GeminiProcessor(
                apiKey,
                customPrompt || process.env.ENHANCEMENT_PROMPT,
                selectedModel,
                aspectRatio,
                imageSize
            );
        }
        console.log('Processor created successfully');

        // Process each image
        for (let i = 0; i < job.images.length; i++) {
            const image = job.images[i];
            console.log(`\nProcessing image ${i + 1}/${job.images.length}: ${image.path}`);

            try {
                queueManager.updateImageStatus(jobId, i, 'processing');

                const result = await processor.processImageWithRetry(image.path);
                console.log(`Processing result for image ${i}:`, result);

                if (result.success) {
                    console.log(`Image processed successfully: ${image.path}`);
                    console.log(`Output path: ${result.outputPath}`);
                    queueManager.updateImageStatus(jobId, i, 'completed', {
                        outputPath: result.outputPath,
                        analysis: result.analysis
                    });
                    console.log(`Updated image ${i} with outputPath:`, result.outputPath);
                } else {
                    console.error(`Image processing failed: ${image.path}`, result.error);
                    queueManager.updateImageStatus(jobId, i, 'failed', {
                        error: result.error
                    });
                }
            } catch (error) {
                console.error(`Exception processing image ${i}:`, error);
                queueManager.updateImageStatus(jobId, i, 'failed', {
                    error: error.message
                });
            }
        }
        console.log(`\n=== Job ${jobId} completed ===\n`);
    } catch (error) {
        console.error(`\n!!! FATAL ERROR in processJob !!!`);
        console.error(`Error:`, error);
        console.error(`Stack:`, error.stack);

        // Mark all images as failed
        for (let i = 0; i < job.images.length; i++) {
            queueManager.updateImageStatus(jobId, i, 'failed', {
                error: `Server error: ${error.message}`
            });
        }
    }
}

// Queue event listeners
queueManager.on('jobComplete', async (jobId) => {
    console.log(`Job ${jobId} completed`);

    // Clean up uploaded files after a delay
    setTimeout(async () => {
        const job = queueManager.getJob(jobId);
        if (job) {
            for (const image of job.images) {
                try {
                    await fs.unlink(image.path);
                } catch (error) {
                    console.error('Error deleting upload:', error);
                }
            }
        }
    }, 60000); // Clean up after 1 minute
});

// API Routes

/**
 * Upload images and create a processing job
 */
app.post('/api/upload', upload.array('images', 20), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        // Get provider selection (default to gemini for backward compatibility)
        const provider = req.body.provider || 'gemini';

        // Get API keys from request
        const apiKey = req.body.apiKey;
        const imageRouterApiKey = req.body.imageRouterApiKey;

        // Validate API key based on provider
        if (provider === 'imagerouter') {
            if (!imageRouterApiKey) {
                return res.status(400).json({ error: 'ImageRouter API key is required' });
            }
        } else {
            // Gemini provider
            if (!apiKey) {
                return res.status(400).json({ error: 'Gemini API key is required' });
            }
            if (!apiKey.startsWith('AIza')) {
                return res.status(400).json({ error: 'Invalid Gemini API key format' });
            }
        }

        const jobId = generateJobId();
        const imagePaths = req.files.map(file => file.path);
        const customPrompt = req.body.prompt; // Get custom prompt from request
        const selectedModel = req.body.model || (provider === 'imagerouter' ? 'flux-1.1-pro' : 'gemini-3-pro-image-preview');
        const aspectRatio = req.body.aspectRatio || '1:1';
        const imageSize = req.body.imageSize || '2K';

        // ImageRouter specific parameters
        const irQuality = req.body.quality || 'auto';
        const irSize = req.body.size || 'auto';

        // Create job in queue
        const job = queueManager.createJob(jobId, imagePaths);

        // Start processing with appropriate parameters based on provider
        processJob(jobId, apiKey, customPrompt, selectedModel, aspectRatio, imageSize, provider, imageRouterApiKey, irQuality, irSize);

        res.json({
            success: true,
            jobId: jobId,
            imageCount: imagePaths.length,
            prompt: customPrompt || 'default',
            model: selectedModel,
            provider: provider,
            settings: { aspectRatio, imageSize }
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

/** */// Get job status
app.get('/api/status/:jobId', (req, res) => {
    const job = queueManager.getJob(req.params.jobId);
    if (!job) {
        return res.status(404).json({ error: 'Job not found' });
    }

    console.log(`Status request for job ${req.params.jobId}:`, {
        completed: job.progress.completed,
        total: job.progress.total,
        images: job.images.map(img => ({
            status: img.status,
            path: img.path,
            outputPath: img.outputPath
        }))
    });

    res.json(job);
});

/**
 * Download processed images as zip
 */
app.get('/api/download/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        const job = queueManager.getJob(jobId);

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        if (job.status !== 'completed') {
            return res.status(400).json({ error: 'Job not yet completed' });
        }

        // Create zip file
        const zipPath = await ZipGenerator.createJobZip(job, jobId);

        // Send the zip file
        res.download(zipPath, `enhanced-images-${jobId}.zip`, async (err) => {
            if (err) {
                console.error('Download error:', err);
            }

            // Clean up zip file after download
            setTimeout(async () => {
                await ZipGenerator.cleanup(zipPath);
            }, 5000);
        });

    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Clean up job data
 */
app.delete('/api/cleanup/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        const job = queueManager.getJob(jobId);

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        // Delete output files
        for (const image of job.images) {
            if (image.outputPath) {
                try {
                    await fs.unlink(image.outputPath);
                } catch (error) {
                    console.error('Error deleting output:', error);
                }
            }
        }

        // Remove job from queue
        queueManager.removeJob(jobId);

        res.json({ success: true });
    } catch (error) {
        console.error('Cleanup error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * ImageRouter models cache
 */
let imageRouterModelsCache = {
    data: null,
    timestamp: null,
    ttl: 3600000 // 1 hour
};

/**
 * Get ImageRouter models with caching
 */
app.get('/api/imagerouter/models', async (req, res) => {
    try {
        // Check cache
        if (imageRouterModelsCache.data &&
            Date.now() - imageRouterModelsCache.timestamp < imageRouterModelsCache.ttl) {
            return res.json(imageRouterModelsCache.data);
        }

        // Fetch from ImageRouter API
        const axios = require('axios');
        const response = await axios.get('https://api.imagerouter.io/v1/models', {
            timeout: 10000
        });

        const rawModels = response.data;

        // Transform and filter models
        const models = Object.entries(rawModels)
            .map(([id, data]) => {
                // Extract provider from model ID
                const provider = id.split('/')[0];

                // Format model name
                let name = id.split('/')[1] || id;
                name = name.replace(':free', '');

                // Determine if free
                const isFree = id.endsWith(':free') ||
                    data.providers.every(p => p.pricing.type === 'fixed' && p.pricing.value === 0);

                // Get pricing info
                let pricing = { min: 0, max: 0, average: 0 };
                if (!isFree && data.providers.length > 0) {
                    const firstProvider = data.providers[0];
                    if (firstProvider.pricing.type === 'fixed') {
                        pricing.min = pricing.max = pricing.average = firstProvider.pricing.value;
                    } else if (firstProvider.pricing.range) {
                        pricing.min = firstProvider.pricing.range.min || 0;
                        pricing.max = firstProvider.pricing.range.max || firstProvider.pricing.range.average || 0;
                        pricing.average = firstProvider.pricing.range.average || pricing.min;
                    } else if (firstProvider.pricing.value !== undefined) {
                        pricing.min = pricing.max = pricing.average = firstProvider.pricing.value;
                    }
                }

                return {
                    id,
                    name,
                    provider,
                    output: data.output || ['image'],
                    isFree,
                    pricing,
                    release_date: data.release_date,
                    supported_params: data.supported_params || {},
                    sizes: data.sizes || [],
                    seconds: data.seconds
                };
            });
        // Note: No filtering here - frontend handles type filtering

        const result = { models };

        // Update cache
        imageRouterModelsCache.data = result;
        imageRouterModelsCache.timestamp = Date.now();

        res.json(result);
    } catch (error) {
        console.error('Error fetching ImageRouter models:', error);

        // Return fallback models
        res.json({
            models: [
                {
                    id: 'black-forest-labs/FLUX-1.1-pro',
                    name: 'FLUX 1.1 Pro',
                    provider: 'black-forest-labs',
                    output: ['image'],
                    isFree: false,
                    pricing: { min: 0.04, max: 0.04, average: 0.04 },
                    supported_params: {}
                },
                {
                    id: 'black-forest-labs/FLUX-pro',
                    name: 'FLUX Pro',
                    provider: 'black-forest-labs',
                    output: ['image'],
                    isFree: false,
                    pricing: { min: 0.05, max: 0.05, average: 0.05 },
                    supported_params: {}
                }
            ]
        });
    }
});

/**
 * Get queue statistics
 */
app.get('/api/stats', (req, res) => {
    res.json(queueManager.getStats());
});

// Start server
if (!isVercel) {
    app.listen(PORT, () => {
        console.log(`\n🚀 Bulk Image AI Server running on http://localhost:${PORT}`);
        console.log(`📊 Max concurrent requests: ${maxConcurrent}`);
        console.log(`\n✨ Ready to process images!\n`);
    });
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n\nShutting down gracefully...');
    process.exit(0);
});

module.exports = app;
