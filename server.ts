import express from "express";
import path from "path";
import axios from "axios";
import dotenv from "dotenv";
import fs from 'fs';
import crypto from "crypto";

dotenv.config();

// 创建 Express app（同时供本地开发和 Vercel 使用）
export const app = express();
const PORT = 3000;

// Increase payload limit for base64 images
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

type TaskStatus = 'queued' | 'running' | 'succeeded' | 'failed';
type EditImagePayload = any;
type TaskRecord =
  | {
      kind: 'edit-image';
      status: TaskStatus;
      created_at: number;
      updated_at: number;
      payload: EditImagePayload;
      result?: any;
      error?: string;
    };

const taskStore = new Map<string, TaskRecord>();

function newTaskId() {
  // URL-safe enough for internal ids
  return crypto.randomBytes(16).toString("hex");
}

function isVercelRuntime() {
  return Boolean(process.env.VERCEL);
}

async function runEditImage(payload: EditImagePayload) {
  const {
    rotate,
    flip,
    auto_correct,
    image_url,
    image_base64,
    model,
    vertical_angle,
    zoom,
    camera_x,
    camera_y,
    camera_z,
    api_key,
    volcengine_api_key,
  } = payload;

  const apiKey = api_key || process.env.QWEN_API_KEY;
  const volcengineApiKey = volcengine_api_key || process.env.VOLCENGINE_API_KEY;

  const isVolcengine =
    model === 'doubao-seedance-1-0-pro-250528' || model === 'Doubao-Seedream-5.0-lite' || model === 'doubao-seedream-4-5-251128';

  if (!apiKey && !isVolcengine) {
    const err: any = new Error("Qwen API 密钥错误，请核对环境变量");
    err.httpStatus = 401;
    throw err;
  }
  if (!volcengineApiKey && isVolcengine) {
    const err: any = new Error("火山引擎 API 密钥错误，请核对环境变量");
    err.httpStatus = 401;
    throw err;
  }

  if (rotate === undefined || rotate < 0 || rotate > 360) {
    const err: any = new Error("旋转角度必须在 0-360 之间");
    err.httpStatus = 400;
    throw err;
  }

  if (!["horizontal", "vertical", "none"].includes(flip)) {
    const err: any = new Error("翻转类型无效");
    err.httpStatus = 400;
    throw err;
  }

  if (!image_url && !image_base64) {
    const err: any = new Error("必须提供图片 URL 或 Base64 数据");
    err.httpStatus = 400;
    throw err;
  }

  const getAzimuthPrompt = (r: number) => {
    r = ((-r + 180) % 360 + 360) % 360;
    if (r < 22.5 || r >= 337.5) return "front view";
    if (r < 67.5) return "front-left quarter view";
    if (r < 112.5) return "left side view";
    if (r < 157.5) return "back-left quarter view";
    if (r < 202.5) return "back view";
    if (r < 247.5) return "back-right quarter view";
    if (r < 292.5) return "right side view";
    return "front-right quarter view";
  };

  const getElevationPrompt = (v: number) => {
    if (v < 36) return "low-angle shot";
    if (v < 72) return "upward shot";
    if (v < 108) return "eye-level shot";
    if (v < 144) return "high-angle shot";
    return "extreme high-angle shot";
  };

  const getDistancePrompt = (z: number) => {
    if (z < 3.5) return "close-up";
    if (z < 6.5) return "medium shot";
    return "wide shot";
  };

  const qwenPrompt = `Regenerate this image from a completely different perspective.
New camera view: ${getAzimuthPrompt(rotate)}, ${getElevationPrompt(vertical_angle)}, ${getDistancePrompt(zoom)}.
Camera position coordinates: x=${camera_x?.toFixed(2) || 0}, y=${camera_y?.toFixed(2) || 0}, z=${camera_z?.toFixed(2) || 0}.
Make sure the image looks like it's photographed from this new angle.`;

  const doubaoPrompt = `请从不同的视角重新生成这张图片。
新的相机视角：${getAzimuthPrompt(rotate)}，${getElevationPrompt(vertical_angle)}，${getDistancePrompt(zoom)}。
相机位置坐标：x=${camera_x?.toFixed(2) || 0}，y=${camera_y?.toFixed(2) || 0}，z=${camera_z?.toFixed(2) || 0}。
确保图片看起来是从这个新角度拍摄的。`;

  const requestTimeoutMs = Number(process.env.API_REQUEST_TIMEOUT_MS || 180000);

  if (model === 'doubao-seedance-1-0-pro-250528') {
    const volcengineUrl = payload.api_url || "https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks";

    const createResponse = await axios.post(
      volcengineUrl,
      {
        model: model,
        content: [
          { type: "text", text: doubaoPrompt },
          { type: "image_url", image_url: { url: image_url || image_base64 } }
        ],
        resolution: "720p",
        ratio: "16:9",
        duration: 5,
        seed: -1,
        camera_fixed: false,
        watermark: false
      },
      {
        headers: {
          "Authorization": `Bearer ${volcengineApiKey}`,
          "Content-Type": "application/json"
        },
        timeout: requestTimeoutMs
      }
    );

    const taskId = createResponse.data?.id;
    if (!taskId) {
      throw new Error("未能获取到任务 ID");
    }
    return { task_id: taskId };
  }

  if (model === 'Doubao-Seedream-5.0-lite') {
    const volcengineUrl = payload.api_url || "https://ark.cn-beijing.volces.com/api/v3/images/generations";

    let requestBody: any = {
      model: "doubao-seedream-5-0-260128",
      prompt: doubaoPrompt,
      size: "2K",
      response_format: "url",
      stream: false,
      watermark: true,
      sequential_image_generation: "disabled"
    };

    if (image_url) {
      requestBody.image = image_url;
    } else if (image_base64) {
      const normalizedBase64 = image_base64.replace(/^data:image\/([A-Za-z]+);base64,/, (match: string, format: string) => {
        return `data:image/${format.toLowerCase()};base64,`;
      });
      requestBody.image = normalizedBase64;
      requestBody.response_format = "b64_json";
    }

    const createResponse = await axios.post(
      volcengineUrl,
      requestBody,
      {
        headers: {
          "Authorization": `Bearer ${volcengineApiKey}`,
          "Content-Type": "application/json"
        },
        timeout: requestTimeoutMs
      }
    );

    const resultItem = createResponse.data?.data?.[0];
    const imageUrlResult = resultItem?.url || resultItem?.b64_json;
    if (!imageUrlResult) {
      console.error("[Seedream 5.0] Full API response:", JSON.stringify(createResponse.data));
      throw new Error("未能获取到生成的图片");
    }

    if (imageUrlResult.startsWith('http')) {
      return { image_url: imageUrlResult };
    }
    return { image_base64: imageUrlResult };
  }

  if (model === 'doubao-seedream-4-5-251128') {
    const volcengineUrl = payload.api_url || "https://ark.cn-beijing.volces.com/api/v3/images/generations";

    let requestBody: any = {
      model: "doubao-seedream-4-5-251128",
      prompt: doubaoPrompt,
      size: "2K",
      response_format: "url",
      stream: false,
      watermark: true,
      sequential_image_generation: "disabled"
    };

    if (image_url) {
      requestBody.image = image_url;
    } else if (image_base64) {
      const normalizedBase64 = image_base64.replace(/^data:image\/([A-Za-z]+);base64,/, (match: string, format: string) => {
        return `data:image/${format.toLowerCase()};base64,`;
      });
      requestBody.image = normalizedBase64;
      requestBody.response_format = "b64_json";
    }

    const createResponse = await axios.post(
      volcengineUrl,
      requestBody,
      {
        headers: {
          "Authorization": `Bearer ${volcengineApiKey}`,
          "Content-Type": "application/json"
        },
        timeout: requestTimeoutMs
      }
    );

    const resultItem = createResponse.data?.data?.[0];
    const imageUrlResult = resultItem?.url || resultItem?.b64_json;
    if (!imageUrlResult) {
      console.error("[Seedream 4.5] Full API response:", JSON.stringify(createResponse.data));
      throw new Error("未能获取到生成的图片");
    }

    if (imageUrlResult.startsWith('http')) {
      return { image_url: imageUrlResult };
    }
    return { image_base64: imageUrlResult };
  }

  const requestBody: any = {
    model: model,
    input: {
      messages: [
        {
          role: "user",
          content: [
            { image: image_url || image_base64 },
            { text: qwenPrompt }
          ]
        }
      ]
    }
  };

  if (model === "qwen-image-2.0") {
    requestBody.parameters = {
      "n": 1,
      "negative_prompt": "",
      "prompt_extend": true,
      "watermark": false,
      "size": "2048*2048"
    };
  }

  const response = await axios.post(
    payload.api_url || "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
    requestBody,
    {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      timeout: requestTimeoutMs
    }
  );

  if (response.data?.output?.choices?.[0]?.message?.content?.[0]?.image) {
    return { image_url: response.data.output.choices[0].message.content[0].image };
  }
  if (response.data && response.data.output) {
    return response.data.output;
  }
  const err: any = new Error("API 返回结果异常");
  err.httpStatus = 500;
  err.detail = response.data;
  throw err;
}

// API Route for Testing Connection
app.post("/api/test-connection", async (req, res) => {
  const { api_url, model, api_key, volcengine_api_key } = req.body;
  const apiKey = api_key || process.env.QWEN_API_KEY;
  const volcengineApiKey = volcengine_api_key || process.env.VOLCENGINE_API_KEY;

  if (model === 'doubao-seedance-1-0-pro-250528' || model === 'Doubao-Seedream-5.0-lite' || model === 'doubao-seedream-4-5-251128') {
    if (!volcengineApiKey) {
      return res.status(401).json({ error: "火山引擎 API 密钥未配置" });
    }
    try {
      await axios.get(
        "https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks/test",
        {
          headers: {
            "Authorization": `Bearer ${volcengineApiKey}`,
          },
          timeout: 10000
        }
      );
    } catch (error: any) {
      if (error.response?.status === 401) {
        return res.status(401).json({ error: "火山引擎 API 密钥无效" });
      }
    }
    return res.json({ success: true });
  }

  if (!apiKey) {
    return res.status(401).json({ error: "API 密钥未配置" });
  }

  try {
    await axios.post(
      api_url || "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
      {
        model: model || "qwen-vl-max",
        input: { prompt: "test" },
      },
      {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        timeout: 10000
      }
    );
    res.json({ success: true });
  } catch (error: any) {
    console.error("Connection Test Error:", error.response?.data || error.message);
    res.status(500).json({
      error: error.response?.data?.message || "连接测试失败，请检查 URL 或 API 密钥"
    });
  }
});

// API Route for Image Editing
app.post("/api/edit-image", async (req, res) => {
  try {
    // 在 Vercel 上优先走“提交任务→轮询”，避免 /api/edit-image 同步等待超时。
    // doubao-seedance 本身已经是 task_id，同步返回足够快，不需要再包一层任务。
    const model = req.body?.model;
    const shouldAsync =
      isVercelRuntime() &&
      model !== 'doubao-seedance-1-0-pro-250528' &&
      req.body?.async_task !== false;

    if (shouldAsync) {
      const id = newTaskId();
      const now = Date.now();
      taskStore.set(id, {
        kind: 'edit-image',
        status: 'queued',
        created_at: now,
        updated_at: now,
        payload: req.body,
      });
      return res.status(202).json({ task_id: id });
    }

    const data = await runEditImage(req.body);
    return res.json(data);
  } catch (error: any) {
    console.error("API Call Error:", error.response?.data || error.message);

    if (error?.code === 'ECONNABORTED' || /timeout/i.test(String(error?.message))) {
      return res.status(504).json({
        error: "上游 API 调用超时（Vercel/网络环境可能较慢）",
        detail: { message: error?.message, code: error?.code }
      });
    }

    const status = error.httpStatus || error.response?.status || 500;
    const errorData = error.response?.data || error.detail || {};
    const modelName = req.body?.model;

    if (status === 401) {
      return res.status(401).json({ error: "API 密钥错误或无效，请核对环境变量" });
    }
    if (errorData.code === "QuotaExhausted" || status === 429) {
      return res.status(403).json({ error: "API 调用额度用尽或并发超限" });
    }
    if (errorData.code === "InvalidParameter" && errorData.message?.includes("format")) {
      return res.status(400).json({ error: "仅支持 JPG/PNG/WebP" });
    }

    const defaultErrorMsg = (modelName === 'doubao-seedance-1-0-pro-250528' || modelName === 'Doubao-Seedream-5.0-lite' || modelName === 'doubao-seedream-4-5-251128')
      ? "调用火山引擎 API 失败"
      : "调用 Qwen API 失败";

    res.status(status).json({
      error: errorData.message || errorData.error?.message || defaultErrorMsg,
      detail: errorData
    });
  }
});

// API Route for Task Status Polling
app.get("/api/task-status", async (req, res) => {
  const { task_id, model, volcengine_api_key } = req.query;
  const volcengineApiKey = (volcengine_api_key as string) || process.env.VOLCENGINE_API_KEY;

  if (!task_id) {
    return res.status(400).json({ error: "缺少 task_id 参数" });
  }

  if (model === 'doubao-seedance-1-0-pro-250528') {
    if (!volcengineApiKey) {
      return res.status(401).json({ error: "火山引擎 API 密钥未配置" });
    }

    try {
      const queryResponse = await axios.get(
        `https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks/${task_id}`,
        {
          headers: {
            "Authorization": `Bearer ${volcengineApiKey}`,
          },
          timeout: 10000
        }
      );

      const status = queryResponse.data?.status;
      let videoUrl = null;

      if (status === 'succeeded') {
        videoUrl = queryResponse.data?.video_url ||
          queryResponse.data?.content?.video_url ||
          queryResponse.data?.output?.video_url ||
          queryResponse.data?.content?.video?.url;

        if (!videoUrl) {
          console.error("Task succeeded but no video URL found:", JSON.stringify(queryResponse.data));
        }
      }

      return res.json({
        status: status,
        video_url: videoUrl,
        raw_data: queryResponse.data
      });
    } catch (error: any) {
      console.error("Task Status Query Error:", error.response?.data || error.message);
      return res.status(500).json({
        error: error.response?.data?.message || "查询任务状态失败"
      });
    }
  }

  // 支持 Vercel 侧“提交任务→轮询”的图片任务
  if (typeof task_id === 'string') {
    const rec = taskStore.get(task_id);
    if (!rec) {
      return res.status(404).json({ error: "任务不存在或已过期" });
    }
    if (rec.kind !== 'edit-image') {
      return res.status(400).json({ error: "不支持的任务类型" });
    }

    if (rec.status === 'succeeded') {
      return res.json({ status: 'succeeded', ...rec.result });
    }
    if (rec.status === 'failed') {
      return res.json({ status: 'failed', error: rec.error || "任务失败" });
    }

    // queued / running: 在首次轮询时执行一次生成
    if (rec.status === 'queued') {
      rec.status = 'running';
      rec.updated_at = Date.now();
      taskStore.set(task_id, rec);
      try {
        const result = await runEditImage(rec.payload);
        rec.status = 'succeeded';
        rec.result = result;
        rec.updated_at = Date.now();
        taskStore.set(task_id, rec);
        return res.json({ status: 'succeeded', ...result });
      } catch (e: any) {
        rec.status = 'failed';
        rec.error = e?.message || "任务失败";
        rec.updated_at = Date.now();
        taskStore.set(task_id, rec);
        return res.status(500).json({ status: 'failed', error: rec.error });
      }
    }

    return res.json({ status: rec.status });
  }

  return res.status(400).json({ error: "不支持的模型类型" });
});

// API 404 handler - 对于 /api/* 的未匹配路由，返回 JSON 错误而不是 HTML
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: `API 路由不存在: ${req.method} ${req.originalUrl}` });
});

// 启动服务器的函数（仅本地开发使用）
async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// 只有直接运行此文件时才启动服务器
const isDirectRunCjs =
  typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module;
const isDirectRunEsm = import.meta.url === `file://${process.argv[1]}`;

if (isDirectRunCjs || isDirectRunEsm) {
  startServer();
}

// 导出 app 供 Vercel 使用
export default app;
