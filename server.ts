import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import dotenv from "dotenv";
import fs from 'fs';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for base64 images
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // API Route for Testing Connection
  app.post("/api/test-connection", async (req, res) => {
    const { api_url, model, api_key, volcengine_api_key } = req.body;
    const apiKey = api_key || process.env.QWEN_API_KEY;
    const volcengineApiKey = volcengine_api_key || process.env.VOLCENGINE_API_KEY;

    if (model === 'doubao-seedance-1-0-pro-250528' || model === 'Doubao-Seedream-5.0-lite' || model === 'doubao-seedream-4-5-251128') {
      if (!volcengineApiKey) {
        return res.status(401).json({ error: "火山引擎 API 密钥未配置" });
      }
      // Volcengine doesn't have a simple ping endpoint, but we can verify the key format or just return success if key exists for now
      // Or we can try to hit the tasks endpoint with an invalid request to see if auth passes
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
        // 404 or other errors mean auth passed but task not found, which is expected
      }
      return res.json({ success: true });
    }

    if (!apiKey) {
      return res.status(401).json({ error: "API 密钥未配置" });
    }

    try {
      // Try a minimal request to verify connectivity
      await axios.post(
        api_url || "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
        {
          model: model || "qwen-vl-max", // Assuming a default model for this endpoint
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
    const { rotate, flip, auto_correct, image_url, image_base64, model, vertical_angle, zoom, camera_x, camera_y, camera_z, api_key, volcengine_api_key } = req.body;
    const apiKey = api_key || process.env.QWEN_API_KEY;
    const volcengineApiKey = volcengine_api_key || process.env.VOLCENGINE_API_KEY;

    // 1. Parameter Validation
    const isVolcengine = model === 'doubao-seedance-1-0-pro-250528' || model === 'Doubao-Seedream-5.0-lite';
    
    if (!apiKey && !isVolcengine) {
      return res.status(401).json({ error: "Qwen API 密钥错误，请核对环境变量" });
    }
    if (!volcengineApiKey && isVolcengine) {
      return res.status(401).json({ error: "火山引擎 API 密钥错误，请核对环境变量" });
    }

    if (rotate === undefined || rotate < 0 || rotate > 360) {
      return res.status(400).json({ error: "旋转角度必须在 0-360 之间" });
    }

    if (!["horizontal", "vertical", "none"].includes(flip)) {
      return res.status(400).json({ error: "翻转类型无效" });
    }

    if (!image_url && !image_base64) {
      return res.status(400).json({ error: "必须提供图片 URL 或 Base64 数据" });
    }

    // Map 3D parameters to prompt format
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
      // 0-180
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

    // For Qwen models: more explicit prompt
    const qwenPrompt = `Regenerate this image from a completely different perspective.
New camera view: ${getAzimuthPrompt(rotate)}, ${getElevationPrompt(vertical_angle)}, ${getDistancePrompt(zoom)}.
Camera position coordinates: x=${camera_x?.toFixed(2) || 0}, y=${camera_y?.toFixed(2) || 0}, z=${camera_z?.toFixed(2) || 0}.
Make sure the image looks like it's photographed from this new angle.`;

    // For Doubao models: Chinese prompt
    const doubaoPrompt = `请从不同的视角重新生成这张图片。
新的相机视角：${getAzimuthPrompt(rotate)}，${getElevationPrompt(vertical_angle)}，${getDistancePrompt(zoom)}。
相机位置坐标：x=${camera_x?.toFixed(2) || 0}，y=${camera_y?.toFixed(2) || 0}，z=${camera_z?.toFixed(2) || 0}。
确保图片看起来是从这个新角度拍摄的。`;

    // Original LoRA prompt (keep for compatibility)
    const loraPrompt = `${getAzimuthPrompt(rotate)} ${getElevationPrompt(vertical_angle)} ${getDistancePrompt(zoom)}, camera position: x=${camera_x?.toFixed(2) || 0}, y=${camera_y?.toFixed(2) || 0}, z=${camera_z?.toFixed(2) || 0}`;

    try {
      if (model === 'doubao-seedance-1-0-pro-250528') {
        const volcengineUrl = req.body.api_url || "https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks";

        // 1. Create task
        const createResponse = await axios.post(
          volcengineUrl,
          {
            model: model,
            content: [
              {
                type: "text",
                text: doubaoPrompt
              },
              {
                type: "image_url",
                image_url: {
                  url: image_url || image_base64
                }
              }
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
            timeout: 30000
          }
        );

        const taskId = createResponse.data?.id;
        if (!taskId) {
          throw new Error("未能获取到任务 ID");
        }

        return res.json({ task_id: taskId });
      }

      if (model === 'Doubao-Seedream-5.0-lite') {
        const volcengineUrl = req.body.api_url || "https://ark.cn-beijing.volces.com/api/v3/images/generations";

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
          console.log("[Seedream 5.0] Using image URL:", image_url.substring(0, 100) + "...");
        } else if (image_base64) {
          const normalizedBase64 = image_base64.replace(/^data:image\/([A-Za-z]+);base64,/, (match, format) => {
            return `data:image/${format.toLowerCase()};base64,`;
          });
          requestBody.image = normalizedBase64;
          requestBody.response_format = "b64_json";
          console.log("[Seedream 5.0] Using base64 with prefix, length:", normalizedBase64.length);
        }

        console.log("[Seedream 5.0] Request body:", JSON.stringify({
          ...requestBody,
          image: requestBody.image ? (requestBody.image.startsWith('http') ? requestBody.image : '[BASE64_DATA]') : undefined
        }));

        const createResponse = await axios.post(
          volcengineUrl,
          requestBody,
          {
            headers: {
              "Authorization": `Bearer ${volcengineApiKey}`,
              "Content-Type": "application/json"
            },
            timeout: 60000
          }
        );

        const resultItem = createResponse.data?.data?.[0];
        const imageUrl = resultItem?.url || resultItem?.b64_json;
        if (!imageUrl) {
          console.error("[Seedream 5.0] Full API response:", JSON.stringify(createResponse.data));
          throw new Error("未能获取到生成的图片");
        }

        if (imageUrl.startsWith('http')) {
          return res.json({ image_url: imageUrl });
        } else {
          return res.json({ image_base64: imageUrl });
        }
      }

      if (model === 'doubao-seedream-4-5-251128') {
        const volcengineUrl = req.body.api_url || "https://ark.cn-beijing.volces.com/api/v3/images/generations";

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
          console.log("[Seedream 4.5] Using image URL:", image_url.substring(0, 100) + "...");
        } else if (image_base64) {
          const normalizedBase64 = image_base64.replace(/^data:image\/([A-Za-z]+);base64,/, (match, format) => {
            return `data:image/${format.toLowerCase()};base64,`;
          });
          requestBody.image = normalizedBase64;
          requestBody.response_format = "b64_json";
          console.log("[Seedream 4.5] Using base64 with prefix, length:", normalizedBase64.length);
        }

        console.log("[Seedream 4.5] Request body:", JSON.stringify({
          ...requestBody,
          image: requestBody.image ? (requestBody.image.startsWith('http') ? requestBody.image : '[BASE64_DATA]') : undefined
        }));

        const createResponse = await axios.post(
          volcengineUrl,
          requestBody,
          {
            headers: {
              "Authorization": `Bearer ${volcengineApiKey}`,
              "Content-Type": "application/json"
            },
            timeout: 60000
          }
        );

        const resultItem = createResponse.data?.data?.[0];
        const imageUrl = resultItem?.url || resultItem?.b64_json;
        if (!imageUrl) {
          console.error("[Seedream 4.5] Full API response:", JSON.stringify(createResponse.data));
          throw new Error("未能获取到生成的图片");
        }

        if (imageUrl.startsWith('http')) {
          return res.json({ image_url: imageUrl });
        } else {
          return res.json({ image_base64: imageUrl });
        }
      }

      // Qwen API Logic
      const requestBody: any = {
        model: model,
        input: {
          messages: [
            {
              role: "user",
              content: [
                {
                  image: image_url || image_base64
                },
                {
                  text: qwenPrompt
                }
              ]
            }
          ]
        }
      };

      // Add parameters for qwen-image-2.0
      if (model === "qwen-image-2.0") {
        requestBody.parameters = {
          "n": 1,
          "negative_prompt": "",
          "prompt_extend": true,
          "watermark": false,
          "size": "2048*2048"
        };
      }

      // Log request body for debugging
      const imageData = requestBody.input?.messages?.[0]?.content?.find((c: any) => c.image);
      const imageForLog = imageData?.image
        ? (imageData.image.startsWith('http') ? imageData.image : '[BASE64_DATA]')
        : undefined;

      console.log(`[Qwen ${model}] Request body:`, JSON.stringify({
        ...requestBody,
        input: requestBody.input ? {
          ...requestBody.input,
          messages: requestBody.input.messages?.map((msg: any) => ({
            ...msg,
            content: msg.content?.map((c: any) =>
              c.image ? { image: imageForLog } : c
            )
          }))
        } : undefined
      }));

      const response = await axios.post(
        req.body.api_url || "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
        requestBody,
        {
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          timeout: 60000
        }
      );

      // Handle DashScope specific response structure
      fs.writeFileSync('api_response.log', JSON.stringify(response.data, null, 2));

      if (response.data?.output?.choices?.[0]?.message?.content?.[0]?.image) {
        res.json({ image_url: response.data.output.choices[0].message.content[0].image });
      } else if (response.data && response.data.output) {
        res.json(response.data.output);
      } else {
        res.status(500).json({ error: "API 返回结果异常", detail: response.data });
      }
    } catch (error: any) {
      console.error("API Call Error:", error.response?.data || error.message);
      
      const status = error.response?.status || 500;
      const errorData = error.response?.data || {};
      
      // Specific error handling as requested
      if (status === 401) {
        return res.status(401).json({ error: "API 密钥错误或无效，请核对环境变量" });
      }
      if (errorData.code === "QuotaExhausted" || status === 429) {
        return res.status(403).json({ error: "API 调用额度用尽或并发超限" });
      }
      if (errorData.code === "InvalidParameter" && errorData.message?.includes("format")) {
        return res.status(400).json({ error: "仅支持 JPG/PNG/WebP" });
      }

      const defaultErrorMsg = (model === 'doubao-seedance-1-0-pro-250528' || model === 'Doubao-Seedream-5.0-lite' || model === 'doubao-seedream-4-5-251128')
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
          // Check common paths for video_url
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

    return res.status(400).json({ error: "不支持的模型类型" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
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

startServer();
