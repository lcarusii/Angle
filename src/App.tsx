import { useState, useRef, ChangeEvent, useEffect } from 'react';
import {
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  CheckCircle2,
  Upload,
  Link as LinkIcon,
  Image as ImageIcon,
  Loader2,
  AlertCircle,
  RefreshCw,
  Camera,
  Maximize2,
  Minimize2,
  Settings,
  History,
  X,
  Trash2,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CameraVisualizer } from './components/CameraVisualizer';
import { SettingsModal } from './components/SettingsModal';
import { safeFetchJson } from './utils/fetch';

interface EditResponse {
  image_url?: string;
  image_base64?: string;
}

interface HistoryItem {
  id: string;
  timestamp: number;
  resultUrl: string;
  model: string;
  parameters: {
    rotate: number;
    verticalAngle: number;
    zoom: number;
    camera_x: number;
    camera_y: number;
    camera_z: number;
  };
}

const VIEW_PRESETS = [
  { label: '正前方视角', h: 180, v: 90, z: 5 },
  { label: '右前方视角', h: 225, v: 120, z: 5 },
  { label: '侧方视角', h: 270, v: 90, z: 5 },
  { label: '顶视图', h: 180, v: 180, z: 5 },
  { label: '低角度视角', h: 225, v: 75, z: 6 },
  { label: '高角度视角', h: 204, v: 120, z: 4.4 },
];

export default function App() {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [base64, setBase64] = useState<string | null>(null);
  const [rotate, setRotate] = useState<number>(180);
  const [verticalAngle, setVerticalAngle] = useState<number>(90);
  const [zoom, setZoom] = useState<number>(5);
  const [flip, setFlip] = useState<'horizontal' | 'vertical' | 'none'>('none');
  const [autoCorrect, setAutoCorrect] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'upload' | 'url'>('upload');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState('qwen-image-edit-plus');
  const [apiUrl, setApiUrl] = useState('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation');
  const [qwenApiKey, setQwenApiKey] = useState<string>(() => localStorage.getItem('qwenApiKey') || '');
  const [volcengineApiKey, setVolcengineApiKey] = useState<string>(() => localStorage.getItem('volcengineApiKey') || '');
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    const saved = localStorage.getItem('generationHistory');
    return saved ? JSON.parse(saved) : [];
  });
  const [showHistory, setShowHistory] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Save API keys to localStorage when they change
  useEffect(() => {
    localStorage.setItem('qwenApiKey', qwenApiKey);
  }, [qwenApiKey]);

  useEffect(() => {
    localStorage.setItem('volcengineApiKey', volcengineApiKey);
  }, [volcengineApiKey]);

  // Save history to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('generationHistory', JSON.stringify(history));
  }, [history]);

  // Add result to history
  const addToHistory = (resultUrl: string, params: {
    rotate: number;
    verticalAngle: number;
    zoom: number;
    camera_x: number;
    camera_y: number;
    camera_z: number;
  }) => {
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      resultUrl,
      model: selectedModel,
      parameters: params
    };

    setHistory(prev => {
      const maxItems = 50;
      const newHistory = [newItem, ...prev];
      if (newHistory.length > maxItems) {
        return newHistory.slice(0, maxItems);
      }
      return newHistory;
    });
  };

  // Delete item from history
  const deleteFromHistory = (id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  // Clear all history
  const clearHistory = () => {
    if (confirm('确定要清空所有历史记录吗？')) {
      setHistory([]);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        setError('仅支持 JPG/PNG/WebP 格式图片');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setBase64(reader.result as string);
        setImageUrl('');
        setError(null);
        setSuccessMessage('图片上传成功！');
        setTimeout(() => setSuccessMessage(null), 3000);
      };
      reader.readAsDataURL(file);
    }
  };

  const applyPreset = (preset: typeof VIEW_PRESETS[0]) => {
    setRotate(preset.h);
    setVerticalAngle(preset.v);
    setZoom(preset.z);
  };

  const handleEdit = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    // Calculate camera position (same logic as in CameraVisualizer)
    const hRad = ((-rotate + 180) * Math.PI) / 180;
    const vRad = ((verticalAngle - 90) * Math.PI) / 180;
    const dist = zoom;
    const x = dist * Math.cos(vRad) * Math.cos(hRad);
    const y = dist * Math.sin(vRad) + 2;
    const z = dist * Math.cos(vRad) * Math.sin(hRad);

    try {
      const data = await safeFetchJson('/api/edit-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rotate,
          vertical_angle: verticalAngle,
          zoom,
          camera_x: x,
          camera_y: y,
          camera_z: z,
          flip,
          auto_correct: autoCorrect,
          image_url: activeTab === 'url' ? imageUrl : undefined,
          image_base64: activeTab === 'upload' ? base64 : undefined,
          model: selectedModel,
          api_url: apiUrl,
          api_key: qwenApiKey,
          volcengine_api_key: volcengineApiKey,
        }),
      });

      let finalResultUrl: string | null = null;

      if (data.task_id) {
        // Poll for task status
        let isDone = false;
        let attempts = 0;
        const maxAttempts = 120; // 10 minutes max

        while (!isDone && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 5000));
          attempts++;

          const statusData = await safeFetchJson(`/api/task-status?task_id=${data.task_id}&model=${selectedModel}&volcengine_api_key=${encodeURIComponent(volcengineApiKey)}`);

          if (statusData.status === 'succeeded') {
            isDone = true;
            if (statusData.video_url) {
              finalResultUrl = statusData.video_url;
              setResult(finalResultUrl);
            } else if (statusData.image_url) {
              finalResultUrl = statusData.image_url;
              setResult(finalResultUrl);
            } else if (statusData.image_base64) {
              finalResultUrl = `data:image/png;base64,${statusData.image_base64}`;
              setResult(finalResultUrl);
            } else {
              throw new Error('未返回结果');
            }
          } else if (statusData.status === 'failed' || statusData.status === 'expired') {
            throw new Error(`视频生成失败: ${statusData.status}`);
          }
          // If status is 'queued' or 'running', continue polling
        }

        if (!isDone) {
          throw new Error('视频生成超时');
        }
      } else if (data.video_url) {
        finalResultUrl = data.video_url;
        setResult(finalResultUrl);
      } else if (data.image_url) {
        finalResultUrl = data.image_url;
        setResult(finalResultUrl);
      } else if (data.image_base64) {
        finalResultUrl = `data:image/png;base64,${data.image_base64}`;
        setResult(finalResultUrl);
      } else {
        throw new Error('未返回结果');
      }

      // Add to history if we got a result
      if (finalResultUrl) {
        addToHistory(finalResultUrl, {
          rotate,
          verticalAngle,
          zoom,
          camera_x: x,
          camera_y: y,
          camera_z: z
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setRotate(180);
    setVerticalAngle(90);
    setZoom(5);
    setFlip('none');
    setAutoCorrect(false);
    setResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-[#e0e0e0] font-sans p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Camera className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Qwen 多角度相机控制</h1>
              <p className="text-[#86868B] text-sm">3D 可视化镜头控制系统</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHistory(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#2a2a2a] hover:bg-[#333] text-[#86868B] hover:text-white rounded-lg border border-[#333] transition-colors text-xs font-bold uppercase tracking-widest"
            >
              <History className="w-4 h-4" />
              历史记录
              {history.length > 0 && (
                <span className="bg-indigo-600 text-white px-1.5 py-0.5 rounded-full text-[10px]">
                  {history.length}
                </span>
              )}
            </button>
            <div className="flex items-center gap-2 text-xs font-mono text-[#86868B] bg-[#2a2a2a] px-3 py-1.5 rounded-lg border border-[#333]">
              <button onClick={() => setIsSettingsOpen(true)} className="hover:text-white transition-colors">
                <Settings className="w-4 h-4" />
              </button>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              节点 ID: {(() => {
                switch (selectedModel) {
                  case 'qwen-image-edit-plus':
                    return 'QWEN_EDIT_PLUS';
                  case 'qwen-image-2.0':
                    return 'QWEN_IMAGE_2_0';
                  case 'doubao-seedance-1-0-pro-250528':
                    return 'DOUBAO_SEEDANCE';
                  case 'doubao-seedream-4-5-251128':
                    return 'DOUBAO_SEEDREAM_4_5';
                  case 'Doubao-Seedream-5.0-lite':
                    return 'DOUBAO_SEEDREAM_5_0';
                  default:
                    return 'QWEN_CAM_01';
                }
              })()}
            </div>
          </div>
        </header>

        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          apiUrl={apiUrl}
          onUrlChange={setApiUrl}
          qwenApiKey={qwenApiKey}
          onQwenApiKeyChange={setQwenApiKey}
          volcengineApiKey={volcengineApiKey}
          onVolcengineApiKeyChange={setVolcengineApiKey}
        />

        {/* History Panel */}
        <AnimatePresence>
          {showHistory && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowHistory(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              />
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed right-0 top-0 h-full w-full max-w-md bg-[#242424] border-l border-[#333] shadow-2xl z-50 flex flex-col"
              >
                <div className="flex items-center justify-between p-6 border-b border-[#333]">
                  <div className="flex items-center gap-2">
                    <History className="w-5 h-5 text-indigo-400" />
                    <h2 className="text-lg font-bold text-white">历史生成记录</h2>
                    {history.length > 0 && (
                      <span className="bg-indigo-600 text-white text-xs px-2 py-0.5 rounded-full">
                        {history.length}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {history.length > 0 && (
                      <button
                        onClick={clearHistory}
                        className="p-2 text-[#86868B] hover:text-red-400 transition-colors"
                        title="清空历史"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => setShowHistory(false)}
                      className="p-2 text-[#86868B] hover:text-white transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  {history.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                      <div className="w-16 h-16 rounded-full bg-[#2a2a2a] flex items-center justify-center">
                        <Clock className="w-8 h-8 text-[#555]" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#555] uppercase tracking-widest">暂无历史记录</p>
                        <p className="text-xs text-[#444] mt-1">生成的图片将显示在这里</p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {history.map((item) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="group relative bg-[#1a1a1a] rounded-xl border border-[#333] overflow-hidden cursor-pointer hover:border-indigo-500/50 transition-colors"
                          onClick={() => {
                            setResult(item.resultUrl);
                            setShowHistory(false);
                          }}
                        >
                          <div className="aspect-square relative">
                            {item.resultUrl.includes('.mp4') || item.model.includes('seedance') ? (
                              <video
                                src={item.resultUrl}
                                className="w-full h-full object-cover"
                                muted
                              />
                            ) : (
                              <img
                                src={item.resultUrl}
                                alt="History item"
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            )}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <Maximize2 className="w-8 h-8 text-white" />
                              </div>
                            </div>
                          </div>
                          <div className="p-2">
                            <p className="text-[10px] text-[#86868B] font-mono truncate">
                              {new Date(item.timestamp).toLocaleString('zh-CN')}
                            </p>
                            <p className="text-[9px] text-[#555] truncate">
                              {item.model}
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteFromHistory(item.id);
                            }}
                            className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-red-600/80 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 className="w-3 h-3 text-white" />
                          </button>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Column 1: 3D Visualization */}
          <div className="lg:col-span-5 flex flex-col">
            <section className="bg-[#242424] rounded-2xl overflow-hidden border border-[#333] shadow-2xl relative h-full flex flex-col">
              <div className="absolute top-4 left-4 z-10 space-y-2">
                <div className="bg-black/60 backdrop-blur-md px-3 py-2 rounded-lg border border-white/10">
                  <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">视角预设</p>
                  <select 
                    className="bg-transparent text-xs font-medium outline-none cursor-pointer w-full"
                    onChange={(e) => {
                      const preset = VIEW_PRESETS.find(p => p.label === e.target.value);
                      if (preset) applyPreset(preset);
                    }}
                  >
                    {VIEW_PRESETS.map(p => (
                      <option key={p.label} value={p.label} className="bg-[#242424]">{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex-1 min-h-[400px]">
                <CameraVisualizer 
                  horizontalAngle={rotate}
                  verticalAngle={verticalAngle}
                  zoom={zoom}
                  imageUrl={base64 || imageUrl}
                  onUpdate={(h, v, z) => {
                    setRotate(h);
                    setVerticalAngle(v);
                    setZoom(z);
                  }}
                />
              </div>

              <div className="absolute bottom-4 left-4 right-4 grid grid-cols-3 gap-3">
                <div className="bg-black/60 backdrop-blur-md p-2 rounded-lg border border-white/10 text-center">
                  <p className="text-[9px] text-[#86868B] uppercase font-bold">水平角度</p>
                  <p className="text-sm font-mono text-pink-500">{rotate.toFixed(1)}°</p>
                </div>
                <div className="bg-black/60 backdrop-blur-md p-2 rounded-lg border border-white/10 text-center">
                  <p className="text-[9px] text-[#86868B] uppercase font-bold">垂直角度</p>
                  <p className="text-sm font-mono text-emerald-400">{verticalAngle.toFixed(1)}°</p>
                </div>
                <div className="bg-black/60 backdrop-blur-md p-2 rounded-lg border border-white/10 text-center relative">
                  <p className="text-[9px] text-[#86868B] uppercase font-bold">镜头距离</p>
                  <p className="text-sm font-mono text-amber-400">{zoom.toFixed(1)}</p>
                  <button 
                    onClick={reset}
                    className="absolute -top-2 -right-2 p-1 bg-indigo-600 rounded-full hover:bg-indigo-500 transition-colors"
                  >
                    <RefreshCw className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
            </section>
          </div>

          {/* Column 2: Sliders Panel */}
          <div className="lg:col-span-3 flex flex-col">
            <section className="bg-[#242424] rounded-2xl p-6 border border-[#333] h-full flex flex-col">
              <div className="flex items-center gap-2 mb-6">
                <Settings className="w-4 h-4 text-indigo-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider">坐标控制</h2>
              </div>
              
              <div className="space-y-8 flex-1">
                <div className="space-y-3">
                  <div className="flex justify-between text-xs font-bold text-[#86868B] uppercase tracking-widest">
                    <span>水平旋转</span>
                    <span className="text-pink-500 bg-pink-500/10 px-2 py-0.5 rounded border border-pink-500/20">
                      {(() => {
                        let r = ((-rotate + 180) % 360 + 360) % 360;
                        if (r < 22.5 || r >= 337.5) return "正前 (Front)";
                        if (r < 67.5) return "左前 (Front-Left)";
                        if (r < 112.5) return "左侧 (Left)";
                        if (r < 157.5) return "左后 (Back-Left)";
                        if (r < 202.5) return "正后 (Back)";
                        if (r < 247.5) return "右后 (Back-Right)";
                        if (r < 292.5) return "右侧 (Right)";
                        return "右前 (Front-Right)";
                      })()}
                    </span>
                  </div>
                  <div className="relative pt-1">
                    <input 
                      type="range" min="0" max="360" step="1" value={rotate} 
                      onChange={(e) => setRotate(Number(e.target.value))}
                      className="w-full h-1.5 bg-[#333] rounded-lg appearance-none cursor-pointer accent-pink-500 relative z-10"
                    />
                    {/* Segment Markers */}
                    <div className="absolute top-1 left-0 w-full h-1.5 flex pointer-events-none opacity-30">
                      {[...Array(8)].map((_, i) => (
                        <div key={i} className="flex-1 border-r border-white/20 last:border-0" />
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-between text-[8px] text-[#555] font-mono uppercase tracking-tighter">
                    <span className={rotate <= 22.5 || rotate >= 337.5 ? "text-pink-500 font-bold" : ""}>后</span>
                    <span className={rotate > 22.5 && rotate <= 67.5 ? "text-pink-500 font-bold" : ""}>左后</span>
                    <span className={rotate > 67.5 && rotate <= 112.5 ? "text-pink-500 font-bold" : ""}>左</span>
                    <span className={rotate > 112.5 && rotate <= 157.5 ? "text-pink-500 font-bold" : ""}>左前</span>
                    <span className={rotate > 157.5 && rotate <= 202.5 ? "text-pink-500 font-bold" : ""}>前</span>
                    <span className={rotate > 202.5 && rotate <= 247.5 ? "text-pink-500 font-bold" : ""}>右前</span>
                    <span className={rotate > 247.5 && rotate <= 292.5 ? "text-pink-500 font-bold" : ""}>右</span>
                    <span className={rotate > 292.5 && rotate <= 337.5 ? "text-pink-500 font-bold" : ""}>右后</span>
                    <span className={rotate >= 337.5 ? "text-pink-500 font-bold" : ""}>后</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-xs font-bold text-[#86868B] uppercase tracking-widest">
                    <span>垂直俯仰</span>
                    <span className="text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-400/20">
                      {(() => {
                        if (verticalAngle < 36) return "低角度 (Low Angle)";
                        if (verticalAngle < 72) return "仰拍 (Upward Shot)";
                        if (verticalAngle < 108) return "平视 (Eye Level)";
                        if (verticalAngle < 144) return "俯拍 (High Angle Shot)";
                        return "高角度 (Extreme High Angle)";
                      })()}
                    </span>
                  </div>
                  <div className="relative pt-1">
                    <input 
                      type="range" min="0" max="180" step="1" value={verticalAngle} 
                      onChange={(e) => setVerticalAngle(Number(e.target.value))}
                      className="w-full h-1.5 bg-[#333] rounded-lg appearance-none cursor-pointer accent-emerald-400 relative z-10"
                    />
                    {/* Segment Markers */}
                    <div className="absolute top-1 left-0 w-full h-1.5 flex pointer-events-none opacity-30">
                      <div style={{ width: '20%' }} className="border-r border-white/20" />
                      <div style={{ width: '20%' }} className="border-r border-white/20" />
                      <div style={{ width: '20%' }} className="border-r border-white/20" />
                      <div style={{ width: '20%' }} className="border-r border-white/20" />
                    </div>
                  </div>
                  <div className="flex justify-between text-[8px] text-[#555] font-mono uppercase tracking-tighter">
                    <span className={verticalAngle < 36 ? "text-emerald-400 font-bold" : ""}>低角度</span>
                    <span className={verticalAngle >= 36 && verticalAngle < 72 ? "text-emerald-400 font-bold" : ""}>仰拍</span>
                    <span className={verticalAngle >= 72 && verticalAngle < 108 ? "text-emerald-400 font-bold" : ""}>平视</span>
                    <span className={verticalAngle >= 108 && verticalAngle < 144 ? "text-emerald-400 font-bold" : ""}>俯拍</span>
                    <span className={verticalAngle >= 144 ? "text-emerald-400 font-bold" : ""}>高角度</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-xs font-bold text-[#86868B] uppercase tracking-widest">
                    <span>镜头距离</span>
                    <span className="text-amber-400">{zoom}</span>
                  </div>
                  <input 
                    type="range" min="1" max="10" step="0.1" value={zoom} 
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="w-full h-1.5 bg-[#333] rounded-lg appearance-none cursor-pointer accent-amber-400"
                  />
                </div>
                
                {/* Generated Prompt Display */}
                <div className="mt-auto p-3 bg-black/30 rounded-xl border border-white/5">
                  <p className="text-[10px] text-[#86868B] uppercase font-bold mb-2">LoRA Prompt</p>
                  <p className="text-xs font-mono text-white/80 leading-relaxed break-words">
                    {`<sks> ${
                      (() => {
                        let r = ((-rotate + 180) % 360 + 360) % 360;
                        if (r < 22.5 || r >= 337.5) return "front view";
                        if (r < 67.5) return "front-right quarter view";
                        if (r < 112.5) return "right side view";
                        if (r < 157.5) return "back-right quarter view";
                        if (r < 202.5) return "back view";
                        if (r < 247.5) return "back-left quarter view";
                        if (r < 292.5) return "left side view";
                        return "front-left quarter view";
                      })()
                    } ${
                      (() => {
                        if (verticalAngle < 75) return "low-angle shot";
                        if (verticalAngle < 105) return "eye-level shot";
                        if (verticalAngle < 135) return "elevated shot";
                        return "high-angle shot";
                      })()
                    } ${
                      (() => {
                        if (zoom < 3.5) return "close-up";
                        if (zoom < 6.5) return "medium shot";
                        return "wide shot";
                      })()
                    }, camera position: x=${(zoom * Math.cos((verticalAngle - 90) * Math.PI / 180) * Math.cos((-rotate + 180) * Math.PI / 180)).toFixed(2)}, y=${(zoom * Math.sin((verticalAngle - 90) * Math.PI / 180) + 2).toFixed(2)}, z=${(zoom * Math.cos((verticalAngle - 90) * Math.PI / 180) * Math.sin((-rotate + 180) * Math.PI / 180)).toFixed(2)}`}
                  </p>
                </div>
              </div>

              <button 
                onClick={handleEdit}
                disabled={loading || (!base64 && !imageUrl)}
                className="mt-6 w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {loading ? '正在执行渲染...' : '执行渲染'}
              </button>
            </section>
          </div>

          {/* Column 3: Output Buffer */}
          <div className="lg:col-span-4 flex flex-col">
            <section className="bg-[#242424] rounded-2xl p-6 border border-[#333] flex flex-col h-full">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Maximize2 className="w-4 h-4 text-indigo-400" />
                  <h2 className="text-sm font-bold uppercase tracking-wider">输出缓冲区</h2>
                </div>
                <div className="flex items-center gap-2">
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                  <button
                    onClick={() => {
                      setActiveTab('upload');
                      fileInputRef.current?.click();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#333] hover:bg-[#444] text-white rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors border border-white/5"
                    title="上传源图片"
                  >
                    <Upload className="w-3 h-3" />
                    上传
                  </button>
                  {result && (
                    <a href={result} download="render.png" className="p-1.5 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 rounded-lg transition-colors">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>

              <div className="flex-1 bg-[#1a1a1a] rounded-xl border border-[#333] overflow-hidden flex items-center justify-center relative min-h-[300px]">
                <AnimatePresence mode="wait">
                  {loading ? (
                    <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-3">
                      <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
                      <p className="text-[10px] font-bold text-[#3a3a3a] uppercase tracking-widest">正在渲染帧...</p>
                    </motion.div>
                  ) : error ? (
                    <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 text-center space-y-3">
                      <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
                      <p className="text-xs text-red-400 font-medium leading-relaxed">{error}</p>
                      <button onClick={() => setError(null)} className="text-[10px] text-indigo-400 underline uppercase tracking-widest">重试</button>
                    </motion.div>
                  ) : result ? (
                    result.includes('.mp4') || selectedModel.includes('seedance') ? (
                      <motion.video key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} src={result} controls autoPlay loop className="w-full h-full object-contain" />
                    ) : (
                      <motion.img key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} src={result} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                    )
                  ) : (
                    <div className="text-center space-y-4">
                      <div className="w-16 h-16 rounded-full bg-[#242424] flex items-center justify-center mx-auto border border-white/5">
                        <Camera className="w-6 h-6 text-[#333]" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-[#333] uppercase tracking-widest">等待渲染信号</p>
                        <p className="text-[9px] text-[#2a2a2a] mt-1">请先上传源图片并调整视角</p>
                      </div>
                    </div>
                  )}
                </AnimatePresence>
              </div>

              {/* URL Input as a subtle fallback */}
              <div className="mt-4">
                {successMessage && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-2 p-2 bg-emerald-500/20 border border-emerald-500/20 rounded-lg text-emerald-400 text-[10px] text-center font-bold uppercase tracking-widest">
                    {successMessage}
                  </motion.div>
                )}
                <div className="relative">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-[#555]" />
                  <input
                    type="text"
                    placeholder="或输入图片 URL..."
                    value={imageUrl}
                    onChange={(e) => {
                      setImageUrl(e.target.value);
                      setActiveTab('url');
                      setBase64(null);
                    }}
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg pl-8 pr-3 py-2 text-[10px] outline-none focus:border-indigo-500/50 transition-colors text-[#888]"
                  />
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
