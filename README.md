# Qwen-Angle - 多角度相机控制

Qwen-Angle 是一个专业的 3D 可视化和 AI 驱动的图像/视频生成工具，具有相机控制界面。用户可以在 3D 空间中可视化相机位置，调整角度和缩放，并使用多种 AI 模型从不同视角生成新的图像/视频。

## 功能特性

- 🎥 **3D 相机可视化** - 使用 Three.js 实现交互式 3D 相机视角控制
- 🤖 **多模型支持** - 支持阿里云 Qwen 和火山引擎豆包系列模型
- 📷 **历史记录** - 自动保存生成历史，支持查看和管理
- ⚙️ **可配置 API** - 支持自定义 API 密钥和端点
- 🎨 **视角预设** - 6 种预设视角快速切换

## 技术栈

- **前端**: React 19, TypeScript 5, Three.js 0.183, Tailwind CSS 4, Framer Motion
- **后端**: Express.js 4, Axios
- **构建**: Vite 6, TSX

## 支持的 AI 模型

| 模型 ID | 提供商 | 类型 |
|---------|--------|------|
| qwen-image-edit-plus | 阿里云 Qwen | 图像编辑 |
| qwen-image-2.0 | 阿里云 Qwen | 图像生成 |
| doubao-seedance-1-0-pro-250528 | 火山引擎豆包 | 视频生成 |
| doubao-seedream-4-5-251128 | 火山引擎豆包 | 图像生成 |
| Doubao-Seedream-5.0-lite | 火山引擎豆包 | 图像生成 |

## 快速开始

**前置要求:** Node.js

1. 安装依赖:
   ```bash
   npm install
   ```

2. 配置环境变量 (复制 `.env.example` 到 `.env` 并填写):
   - `QWEN_API_KEY` - 阿里云 Qwen API 密钥
   - `VOLCENGINE_API_KEY` - 火山引擎豆包 API 密钥

3. 启动开发服务器:
   ```bash
   npm run dev
   ```

4. 访问 http://localhost:3000

## 主要命令

```bash
npm run dev          # 启动开发服务器
npm run build        # 构建生产版本
npm run preview      # 预览生产构建
npm run clean        # 清理 dist 目录
npm run lint         # TypeScript 类型检查
```

## 项目结构

```
src/
├── components/
│   ├── CameraVisualizer.tsx    # 3D 相机可视化 (Three.js)
│   └── SettingsModal.tsx        # API 设置弹窗
├── App.tsx                       # 主应用组件
├── main.tsx                      # React 入口点
└── index.css                     # 全局样式
server.ts                         # Express 后端 API
```

## API 端点

- `POST /api/test-connection` - 测试 AI API 连接
- `POST /api/edit-image` - 图像/视频生成 (接受 3D 相机参数)
- `GET /api/task-status` - 轮询视频生成任务状态

## 配置

API 密钥可以通过以下方式配置：
1. 环境变量 (`.env` 文件)
2. 应用内设置面板 (保存到浏览器 localStorage)

## 许可证

MIT
