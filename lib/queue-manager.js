const EventEmitter = require('events');

class QueueManager extends EventEmitter {
    constructor(maxConcurrent = 3) {
        super();
        this.maxConcurrent = maxConcurrent;
        this.jobs = new Map(); // jobId -> job data
        this.activeJobs = new Set(); // Currently processing job IDs
        this.queue = []; // Pending job IDs
    }

    /**
     * Create a new job
     * @param {string} jobId - Unique job identifier
     * @param {Array} imagePaths - Array of image file paths
     * @returns {Object} Job data
     */
    createJob(jobId, imagePaths) {
        const job = {
            jobId,
            status: 'pending',
            images: imagePaths.map(path => ({
                path,
                status: 'pending',
                outputPath: null,
                error: null
            })),
            createdAt: new Date(),
            completedAt: null,
            progress: {
                total: imagePaths.length,
                completed: 0,
                failed: 0,
                pending: imagePaths.length
            }
        };

        this.jobs.set(jobId, job);
        this.queue.push(jobId);

        return job;
    }

    /**
     * Get job status
     * @param {string} jobId - Job identifier
     * @returns {Object|null} Job data or null if not found
     */
    getJob(jobId) {
        return this.jobs.get(jobId) || null;
    }

    /**
     * Update image status within a job
     * @param {string} jobId - Job identifier
     * @param {number} imageIndex - Index of the image in the job
     * @param {string} status - New status (processing, completed, failed)
     * @param {Object} data - Additional data (outputPath, error, etc.)
     */
    updateImageStatus(jobId, imageIndex, status, data = {}) {
        const job = this.jobs.get(jobId);
        if (!job) return;

        const image = job.images[imageIndex];
        if (!image) return;

        const oldStatus = image.status;
        image.status = status;

        // Update additional data
        if (data.outputPath) image.outputPath = data.outputPath;
        if (data.error) image.error = data.error;
        if (data.analysis) image.analysis = data.analysis;

        // Update progress counters
        if (oldStatus === 'pending') job.progress.pending--;

        if (status === 'completed') {
            job.progress.completed++;
        } else if (status === 'failed') {
            job.progress.failed++;
        }

        // Check if job is complete
        const allDone = job.images.every(img =>
            img.status === 'completed' || img.status === 'failed'
        );

        if (allDone) {
            job.status = 'completed';
            job.completedAt = new Date();
            this.activeJobs.delete(jobId);
            this.emit('jobComplete', jobId);
        }

        this.emit('jobUpdate', jobId, job);
    }

    /**
     * Mark a job as processing
     * @param {string} jobId - Job identifier
     */
    startJob(jobId) {
        const job = this.jobs.get(jobId);
        if (!job) return;

        job.status = 'processing';
        this.activeJobs.add(jobId);

        // Remove from queue
        const queueIndex = this.queue.indexOf(jobId);
        if (queueIndex > -1) {
            this.queue.splice(queueIndex, 1);
        }

        this.emit('jobStart', jobId);
    }

    /**
     * Check if we can start more jobs
     * @returns {boolean}
     */
    canStartNewJob() {
        return this.activeJobs.size < this.maxConcurrent && this.queue.length > 0;
    }

    /**
     * Get the next job to process
     * @returns {string|null} Job ID or null
     */
    getNextJob() {
        if (this.queue.length === 0) return null;
        return this.queue[0];
    }

    /**
     * Remove a job from the system
     * @param {string} jobId - Job identifier
     */
    removeJob(jobId) {
        this.jobs.delete(jobId);
        this.activeJobs.delete(jobId);

        const queueIndex = this.queue.indexOf(jobId);
        if (queueIndex > -1) {
            this.queue.splice(queueIndex, 1);
        }
    }

    /**
     * Get all jobs
     * @returns {Array} Array of all jobs
     */
    getAllJobs() {
        return Array.from(this.jobs.values());
    }

    /**
     * Get queue statistics
     * @returns {Object} Queue stats
     */
    getStats() {
        return {
            totalJobs: this.jobs.size,
            activeJobs: this.activeJobs.size,
            queuedJobs: this.queue.length,
            maxConcurrent: this.maxConcurrent
        };
    }
}

module.exports = QueueManager;
