# Bulk Image AI - Image Enhancement Tool

A desktop-style web application for bulk image editing and enhancement using AI-powered image generation APIs.

## Features

- 🖼️ **Bulk Processing**: Upload and process 1-20 images at once
- 🎨 **Multiple AI Providers**: Choose between Google Gemini and ImageRouter
- ✍️ **Custom Instructions**: Specify exactly what you want the AI to do with your images
- 📊 **Real-time Progress**: Track processing status for each image
- 📦 **Zip Download**: Download all processed images in a single zip file
- 🎯 **Drag & Drop**: Intuitive file upload interface
- ⚡ **Queue Management**: Smart concurrency control for optimal performance
- 🔄 **Model Selection**: Choose from multiple AI models per provider

## Supported Providers

### Google Gemini
- **Gemini 2.5 Flash**: Fast & efficient, good for quick edits
- **Gemini 3 Pro Image**: Premium quality with 2K/4K output and advanced reasoning
- Advanced settings: Aspect ratio control, resolution selection

### ImageRouter
- **Flux 1.1 Pro**: High quality, fast generation
- **Flux Pro**: Maximum quality, detailed output
- Multi-model routing with quality presets

## Prerequisites

- Node.js (v18 or higher)
- At least one API key:
  - **Gemini**: Get from [Google AI Studio](https://aistudio.google.com/app/apikey)
  - **ImageRouter**: Get from [ImageRouter.io](https://imagerouter.io)

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure API Keys

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your API key(s):
   ```
   # For Gemini provider
   GEMINI_API_KEY=your_gemini_api_key_here
   
   # For ImageRouter provider (optional)
   IMAGEROUTER_API_KEY=your_imagerouter_api_key_here
   ```

3. (Optional) Customize the enhancement prompt and other settings in `.env`

> **Note**: You can also enter API keys directly in the web interface. They will be stored in your browser's session storage.

### 3. Start the Application

```bash
npm start
```

The application will start on `http://localhost:3000`

## Usage

1. **Open the app** in your browser at `http://localhost:3000`
2. **Select a provider** (Gemini or ImageRouter)
3. **Enter your API key** for the selected provider
4. **Choose a model** from the available options
5. **Upload images** by dragging and dropping or clicking the upload area
6. **Customize AI instructions** in the prompt field (optional)
7. **Adjust settings** (for Gemini: aspect ratio, resolution)
8. **Click "Start Processing"** to begin
9. **Monitor progress** as images are processed
10. **Download results** as a zip file when processing is complete

## Supported Image Formats

- JPEG/JPG
- PNG
- WebP
- GIF

## Configuration

Edit `.env` to customize:

- `GEMINI_API_KEY`: Your Gemini API key (optional if using ImageRouter)
- `IMAGEROUTER_API_KEY`: Your ImageRouter API key (optional if using Gemini)
- `PORT`: Server port (default: 3000)
- `ENHANCEMENT_PROMPT`: Default prompt for image enhancement
- `MAX_CONCURRENT_REQUESTS`: Number of simultaneous API calls (default: 3)

## Troubleshooting

### "API key not configured" error
- Make sure you've entered an API key for your selected provider
- For Gemini: Key should start with "AIza"
- For ImageRouter: Verify your key is valid

### Images not processing
- Check your API key is valid for the selected provider
- Verify you have API quota remaining
- Check the browser console for errors
- Try switching to a different provider

### Port already in use
- Change the `PORT` in `.env` to a different number (e.g., 3001)

## Provider Comparison

| Feature | Gemini | ImageRouter |
|---------|--------|-------------|
| Models | 2 (Flash, Pro) | 2+ (Flux variants) |
| Resolution Control | ✅ (1K, 2K, 4K) | ✅ (Auto) |
| Aspect Ratio | ✅ | ❌ |
| Quality Presets | ❌ | ✅ |
| Output Formats | PNG | PNG, JPEG, WebP |
| Cost Estimation | ✅ | ❌ |

## Technical Details

- **Backend**: Node.js + Express
- **AI Providers**: 
  - Google Gemini Pro 3 Vision API
  - ImageRouter Multi-Model API
- **File Handling**: Multer for uploads, Archiver for zip creation
- **Queue**: Custom implementation with concurrency control
- **HTTP Client**: Axios for ImageRouter API requests

## License

ISC
