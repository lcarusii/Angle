import { useState } from 'react';
import { Settings, X, Cpu, CheckCircle2, AlertCircle, Link as LinkIcon, Key } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
  apiUrl: string;
  onUrlChange: (url: string) => void;
  qwenApiKey: string;
  onQwenApiKeyChange: (key: string) => void;
  volcengineApiKey: string;
  onVolcengineApiKeyChange: (key: string) => void;
}

const MODELS = [
  { id: 'qwen-image-edit-plus', name: 'Qwen Image Edit Plus', provider: 'qwen' },
  { id: 'qwen-image-2.0', name: 'Qwen Image 2.0', provider: 'qwen' },
  { id: 'doubao-seedance-1-0-pro-250528', name: 'Doubao Seedance 1.0 Pro', provider: 'volcengine' },
  { id: 'doubao-seedream-4-5-251128', name: 'Doubao Seedream 4.5', provider: 'volcengine' },
  { id: 'Doubao-Seedream-5.0-lite', name: 'Doubao Seedream 5.0 Lite', provider: 'volcengine' },
];

const isVolcengineModel = (modelId: string) => {
  return modelId.includes('doubao') || modelId.includes('Doubao');
};

export function SettingsModal({ isOpen, onClose, selectedModel, onModelChange, apiUrl, onUrlChange, qwenApiKey, onQwenApiKeyChange, volcengineApiKey, onVolcengineApiKeyChange }: SettingsModalProps) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{success: boolean, message: string} | null>(null);

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const response = await fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_url: apiUrl,
          model: selectedModel,
          api_key: qwenApiKey,
          volcengine_api_key: volcengineApiKey
        })
      });
      const data = await response.json();
      if (response.ok) {
        setTestResult({ success: true, message: '连接成功！' });
      } else {
        setTestResult({ success: false, message: data.error || '连接失败' });
      }
    } catch (err) {
      setTestResult({ success: false, message: '网络错误' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-[#242424] rounded-2xl border border-[#333] shadow-2xl z-50 p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-400" />
                <h2 className="text-lg font-bold text-white">API 设置中心</h2>
              </div>
              <button onClick={onClose} className="text-[#86868B] hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[#86868B] uppercase tracking-widest flex items-center gap-2">
                  <Cpu className="w-3 h-3" /> 模型选择
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => {
                    const newModel = e.target.value;
                    onModelChange(newModel);
                    if (newModel === 'doubao-seedance-1-0-pro-250528') {
                      onUrlChange('https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks');
                    } else if (newModel === 'Doubao-Seedream-5.0-lite' || newModel === 'doubao-seedream-4-5-251128') {
                      onUrlChange('https://ark.cn-beijing.volces.com/api/v3/images/generations');
                    } else if (newModel === 'qwen-image-edit-plus' || newModel === 'qwen-image-2.0') {
                      onUrlChange('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation');
                    } else {
                      onUrlChange('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions');
                    }
                  }}
                  className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 transition-colors"
                >
                  {MODELS.map((model) => (
                    <option key={model.id} value={model.id}>{model.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[#86868B] uppercase tracking-widest flex items-center gap-2">
                  <LinkIcon className="w-3 h-3" /> API Base URL
                </label>
                <input
                  type="text"
                  value={apiUrl}
                  onChange={(e) => onUrlChange(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 transition-colors"
                  placeholder="https://dashscope.aliyuncs.com/..."
                />
              </div>

              {!isVolcengineModel(selectedModel) ? (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-[#86868B] uppercase tracking-widest flex items-center gap-2">
                    <Key className="w-3 h-3" /> Qwen 模型 API Key
                  </label>
                  <input
                    type="password"
                    value={qwenApiKey}
                    onChange={(e) => onQwenApiKeyChange(e.target.value)}
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 transition-colors"
                    placeholder="sk-..."
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-[#86868B] uppercase tracking-widest flex items-center gap-2">
                    <Key className="w-3 h-3" /> 豆包模型 API Key
                  </label>
                  <input
                    type="password"
                    value={volcengineApiKey}
                    onChange={(e) => onVolcengineApiKeyChange(e.target.value)}
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 transition-colors"
                    placeholder="volc-..."
                  />
                </div>
              )}

              <button
                onClick={testConnection}
                disabled={testing}
                className="w-full py-2 bg-[#333] hover:bg-[#444] text-white rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2"
              >
                {testing ? '测试中...' : '测试连接'}
              </button>

              {testResult && (
                <div className={`p-3 rounded-lg text-sm ${testResult.success ? 'bg-emerald-900/20 text-emerald-400' : 'bg-red-900/20 text-red-400'}`}>
                  {testResult.message}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[#86868B] uppercase tracking-widest">API 连接状态</label>
                <div className="flex items-center gap-2 p-3 bg-[#1a1a1a] rounded-lg border border-[#333]">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm text-white">
                    {!isVolcengineModel(selectedModel)
                      ? (qwenApiKey ? '已配置 Qwen 密钥' : '使用环境变量 (未设置 Qwen 密钥)')
                      : (volcengineApiKey ? '已配置豆包密钥' : '使用环境变量 (未设置豆包密钥)')
                    }
                  </span>
                </div>
              </div>

              <div className="p-4 bg-indigo-900/20 rounded-lg border border-indigo-500/20">
                <div className="flex gap-2 text-indigo-300">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <p className="text-xs">API 密钥保存在您的浏览器本地 (localStorage) 中，不会上传到服务器。</p>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
