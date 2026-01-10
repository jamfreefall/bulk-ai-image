const fs = require('fs').promises;
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

class GeminiProcessor {
  constructor(apiKey, enhancementPrompt, model, aspectRatio, imageSize) {
    if (!apiKey) {
      throw new Error('Gemini API key is required');
    }

    this.ai = new GoogleGenAI({ apiKey });
    // Allow model selection, default to Gemini 3 Pro Image
    this.model = model || 'gemini-3-pro-image-preview';
    this.enhancementPrompt = enhancementPrompt || 'Enhance this image: improve quality, adjust colors and lighting, sharpen details, and make it look professional and polished.';
    this.aspectRatio = aspectRatio || '1:1';
    this.imageSize = imageSize || '2K';
  }

  /**
   * Process an image using Gemini image generation API
   * @param {string} imagePath - Path to the image file
   * @returns {Promise<{success: boolean, outputPath?: string, error?: string}>}
   */
  async processImage(imagePath) {
    try {
      // Read the image file
      const imageBuffer = await fs.readFile(imagePath);
      const base64Image = imageBuffer.toString('base64');

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

      // Create prompt with reference image for editing
      const contents = [
        { text: this.enhancementPrompt },
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Image
          }
        }
      ];

      // Log configuration for debugging
      console.log(`Processing with model: ${this.model}`);
      console.log(`Aspect Ratio: ${this.aspectRatio}, Image Size: ${this.imageSize}`);

      // Generate edited image with advanced configuration
      const config = {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: {
          aspectRatio: this.aspectRatio
        }
      };

      // Only add imageSize for gemini-3-pro-image-preview
      if (this.model === 'gemini-3-pro-image-preview') {
        config.imageConfig.imageSize = this.imageSize;
      }

      console.log('API Config:', JSON.stringify(config, null, 2));

      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: contents,
        config: config
      });

      // Extract the generated image from response
      let generatedImageData = null;
      let analysisText = '';

      if (response.candidates && response.candidates.length > 0) {
        const parts = response.candidates[0].content.parts;

        for (const part of parts) {
          if (part.inlineData) {
            generatedImageData = part.inlineData.data;
          } else if (part.text) {
            analysisText = part.text;
          }
        }
      }

      if (!generatedImageData) {
        throw new Error('No image generated in response');
      }

      // Create output directory if it doesn't exist
      const outputDir = path.join(process.cwd(), 'outputs');
      await fs.mkdir(outputDir, { recursive: true });

      // Save the generated image
      const filename = path.basename(imagePath);
      const outputPath = path.join(outputDir, `enhanced_${filename}`);

      // Convert base64 to buffer and save
      const imageData = Buffer.from(generatedImageData, 'base64');
      await fs.writeFile(outputPath, imageData);

      return {
        success: true,
        outputPath: outputPath,
        analysis: analysisText || `Image edited successfully using ${this.model}`,
        originalPath: imagePath
      };

    } catch (error) {
      console.error('Error processing image:', error);
      return {
        success: false,
        error: error.message || 'Failed to process image'
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
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    return {
      success: false,
      error: lastError || 'Failed after multiple retries'
    };
  }
}

module.exports = GeminiProcessor;
