const archiver = require('archiver');
const fs = require('fs');
const path = require('path');

class ZipGenerator {
    /**
     * Create a zip file from processed images
     * @param {Array} imagePaths - Array of image file paths to include
     * @param {string} outputPath - Path where the zip file should be saved
     * @returns {Promise<string>} Path to the created zip file
     */
    static async createZip(imagePaths, outputPath) {
        return new Promise((resolve, reject) => {
            // Create output stream
            const output = fs.createWriteStream(outputPath);
            const archive = archiver('zip', {
                zlib: { level: 9 } // Maximum compression
            });

            // Listen for events
            output.on('close', () => {
                console.log(`Zip created: ${archive.pointer()} total bytes`);
                resolve(outputPath);
            });

            output.on('error', (err) => {
                reject(err);
            });

            archive.on('error', (err) => {
                reject(err);
            });

            // Pipe archive data to the file
            archive.pipe(output);

            // Add files to the archive
            imagePaths.forEach((imagePath, index) => {
                if (fs.existsSync(imagePath)) {
                    const filename = path.basename(imagePath);
                    archive.file(imagePath, { name: filename });
                }
            });

            // Finalize the archive
            archive.finalize();
        });
    }

    /**
     * Create a zip file for a job's processed images
     * @param {Object} job - Job object with image data
     * @param {string} jobId - Job identifier
     * @returns {Promise<string>} Path to the created zip file
     */
    static async createJobZip(job, jobId) {
        // Get all successfully processed images
        const processedImages = job.images
            .filter(img => img.status === 'completed' && img.outputPath)
            .map(img => img.outputPath);

        if (processedImages.length === 0) {
            throw new Error('No processed images to zip');
        }

        // Create temp directory for zips if it doesn't exist
        const tempDir = path.join(process.cwd(), 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const zipPath = path.join(tempDir, `${jobId}.zip`);
        return await this.createZip(processedImages, zipPath);
    }

    /**
     * Clean up a zip file
     * @param {string} zipPath - Path to the zip file to delete
     */
    static async cleanup(zipPath) {
        try {
            if (fs.existsSync(zipPath)) {
                fs.unlinkSync(zipPath);
                console.log(`Cleaned up zip: ${zipPath}`);
            }
        } catch (error) {
            console.error('Error cleaning up zip:', error);
        }
    }
}

module.exports = ZipGenerator;
