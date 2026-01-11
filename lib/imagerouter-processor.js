const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

class ImageRouterProcessor {
  constructor(apiKey, enhancementPrompt, model, quality, outputFormat, size) {
    if (!apiKey) {
      throw new Error('ImageRouter API key is required');
    }

    this.apiKey = apiKey;
    this.baseUrl = 'https://api.imagerouter.io';
    this.model = model || 'flux-1.1-pro'; // Default model
    this.enhancementPrompt = enhancementPrompt || 'Enhance this image: improve quality, adjust colors and lighting, sharpen details, and make it look professional and polished.';
    this.quality = quality || 'auto';
    this.outputFormat = outputFormat || 'png';
    this.size = size || 'auto'; // Size parameter (e.g., "1024x1024" or "auto")
  }

  /**
   * Process an image using ImageRouter image generation API
   * @param {string} imagePath - Path to the image file
   * @returns {Promise<{success: boolean, outputPath?: string, error?: string}>}
   */
  async processImage(imagePath) {
    try {
      // Read the image file
      const imageBuffer = await fs.readFile(imagePath);

      // Determine MIME type
      const ext = path.extname(imagePath).toLowerCase();
      const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.gif': 'image/gif'
      };
      const mimeType = mimeTypes[ext] || 'image/jpeg';

      // Create form data for multipart upload
      const formData = new FormData();
      formData.append('prompt', this.enhancementPrompt);
      formData.append('model', this.model);
      formData.append('response_format', 'b64_json'); // Get base64 response
      formData.append('quality', this.quality);
      formData.append('size', this.size);
      formData.append('output_format', this.outputFormat);
      formData.append('image[]', imageBuffer, {
        filename: path.basename(imagePath),
        contentType: mimeType
      });

      console.log(`Processing with ImageRouter model: ${this.model}`);
      console.log(`Quality: ${this.quality}, Output Format: ${this.outputFormat}`);

      // Make API request - use /edits endpoint for image-to-image
      const response = await axios.post(
        `${this.baseUrl}/v1/openai/images/edits`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            ...formData.getHeaders()
          },
          timeout: 120000 // 2 minute timeout
        }
      );

      // Extract the generated image from response
      let generatedImageData = null;

      if (response.data && response.data.data && response.data.data.length > 0) {
        const imageResult = response.data.data[0];

        if (imageResult.b64_json) {
          generatedImageData = imageResult.b64_json;
        } else if (imageResult.url) {
          // If URL is returned instead, download it
          const imageResponse = await axios.get(imageResult.url, {
            responseType: 'arraybuffer'
          });
          generatedImageData = Buffer.from(imageResponse.data).toString('base64');
        }
      }

      if (!generatedImageData) {
        throw new Error('No image generated in response');
      }

      // Create output directory if it doesn't exist
      const isVercel = process.env.VERCEL === '1';
      const storageBaseDir = isVercel ? require('os').tmpdir() : process.cwd();
      const outputDir = path.join(storageBaseDir, 'outputs');
      await fs.mkdir(outputDir, { recursive: true });

      // Save the generated image
      const filename = path.basename(imagePath, path.extname(imagePath));
      const outputPath = path.join(outputDir, `enhanced_${filename}.${this.outputFormat}`);

      // Convert base64 to buffer and save
      const imageData = Buffer.from(generatedImageData, 'base64');
      await fs.writeFile(outputPath, imageData);

      return {
        success: true,
        outputPath: outputPath,
        analysis: `Image edited successfully using ImageRouter (${this.model})`,
        originalPath: imagePath
      };

    } catch (error) {
      console.error('Error processing image with ImageRouter:', error);

      // Extract meaningful error message
      let errorMessage = error.message || 'Failed to process image';

      if (error.response) {
        // API returned an error response
        errorMessage = `ImageRouter API Error: ${error.response.status} - ${error.response.data?.error?.message ||
          error.response.data?.message ||
          error.response.statusText
          }`;
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Request timeout - image processing took too long';
      } else if (error.code === 'ENOTFOUND') {
        errorMessage = 'Cannot connect to ImageRouter API';
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Process multiple images with retry logic
   * @param {string} imagePath - Path to the image file
   * @param {number} maxRetries - Maximum number of retry attempts
   * @returns {Promise<Object>}
   */
  async processImageWithRetry(imagePath, maxRetries = 2) {
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.processImage(imagePath);
        if (result.success) {
          return result;
        }
        lastError = result.error;
      } catch (error) {
        lastError = error.message;

        // Wait before retrying (exponential backoff)
        if (attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000;
          console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${waitTime}ms`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    return {
      success: false,
      error: lastError || 'Failed after multiple retries'
    };
  }
}

module.exports = ImageRouterProcessor;
