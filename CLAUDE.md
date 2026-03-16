# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Qwen-Angle** (Qwen Image Angle Editor) is a professional 3D visualization and AI-powered image/video generation tool with a camera control interface. Users can visualize camera positions in 3D space, adjust angles and zoom, and generate new images/videos from different perspectives using multiple AI models.

## Tech Stack

- **Frontend**: React 19, TypeScript 5, Three.js 0.183, Tailwind CSS 4, Framer Motion
- **Backend**: Express.js 4, Axios
- **Build**: Vite 6, TSX

## Key Commands

```bash
npm run dev          # Start dev server on http://localhost:3000
npm run build        # Build for production
npm run preview      # Preview production build
npm run clean        # Remove dist directory
npm run lint         # TypeScript type checking (tsc --noEmit)
```

## Architecture

### Directory Structure

```
src/
├── components/
│   ├── CameraVisualizer.tsx    # 3D camera visualization (Three.js)
│   └── SettingsModal.tsx        # API settings modal
├── App.tsx                       # Main application component
├── main.tsx                      # React entry point
└── index.css                     # Global styles
server.ts                         # Express backend API
```

### Core Components

**App.tsx** - Main application with:
- Three-column layout (image input, 3D visualizer, generation panel)
- Camera angle state (horizontal: 0-360°, vertical: 0-180°, zoom: 1-10)
- 6 predefined view presets
- Image upload (JPG/PNG/WebP) and URL input
- Task polling for video generation

**CameraVisualizer.tsx** - Three.js component:
- Interactive orbit controls
- Camera icon tracking in 3D space
- Horizontal/vertical track rings with handles
- Image texture mapping on subject plane

**server.ts** - Backend API with endpoints:
- `POST /api/test-connection` - Test AI API connectivity
- `POST /api/edit-image` - Image/video generation (accepts 3D camera parameters)
- `GET /api/task-status` - Poll video generation task status

### 3D Parameter Mapping

The system converts 3D camera parameters to LoRA prompts:
- Horizontal angle → 8 view directions (front, side, back, etc.)
- Vertical angle → 5 elevation types (eye-level, high-angle, low-angle, etc.)
- Zoom → shot types (close-up, medium, wide)
- Camera position calculated via spherical coordinates

### AI Models Supported

| Model ID | Provider | Type |
|----------|----------|------|
| qwen-image-edit-plus | Alibaba Qwen | Image editing |
| doubao-seedance-1-0-pro-250528 | Volcengine Doubao | Video generation |
| Doubao-Seedream-5.0-lite | Volcengine Doubao | Image generation |

### Configuration

**Environment Variables** (copy from `.env.example` to `.env`):
- `GEMINI_API_KEY` - Gemini AI API
- `QWEN_API_KEY` - Qwen Image Edit Plus
- `QWEN_API_ID` - Qwen API ID
- `VOLCENGINE_API_KEY` - Volcengine Doubao models
- `APP_URL` - Application hosting URL

## Key File Paths

- [src/App.tsx](src/App.tsx) - Main application component
- [src/components/CameraVisualizer.tsx](src/components/CameraVisualizer.tsx) - 3D visualization
- [server.ts](server.ts) - Backend API server
- [package.json](package.json) - Dependencies & scripts
- [vite.config.ts](vite.config.ts) - Vite configuration
