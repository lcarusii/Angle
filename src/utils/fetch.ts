/**
 * 安全的 fetch 工具函数，用于处理 API 响应
 * 防止将 HTML 错误页面解析为 JSON 时出现的 "Unexpected token '<'" 错误
 */

export interface FetchError {
  message: string;
  isHtmlResponse?: boolean;
  status?: number;
}

export class SafeFetchError extends Error implements FetchError {
  isHtmlResponse?: boolean;
  status?: number;

  constructor(message: string, options?: { isHtmlResponse?: boolean; status?: number }) {
    super(message);
    this.name = 'SafeFetchError';
    this.isHtmlResponse = options?.isHtmlResponse;
    this.status = options?.status;
  }
}

/**
 * 安全地获取 JSON 响应
 * @param input fetch 的第一个参数
 * @param init fetch 的第二个参数
 * @returns 解析后的 JSON 数据
 * @throws SafeFetchError 当响应不是有效的 JSON 或请求失败时
 */
export async function safeFetchJson<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(input, init);

  // 检查 Content-Type 是否为 JSON
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (!isJson) {
    // 尝试读取响应文本以提供更好的错误信息
    let text = '';
    try {
      text = await response.clone().text();
    } catch {
      // 忽略读取错误
    }

    let errorMessage = `服务器返回了非 JSON 响应 (Content-Type: ${contentType || 'unknown'})`;
    const textPreview = text
      ? text.trim().slice(0, 400).replace(/\s+/g, ' ')
      : '';

    // 检查是否是 HTML 响应
    if (text.trim().startsWith('<!') || text.trim().startsWith('<html') || text.includes('The page')) {
      errorMessage = '服务器返回了 HTML 页面而非 API 响应，请检查服务器是否正常运行';
    } else if (textPreview) {
      errorMessage = `${errorMessage}，响应内容摘要: ${textPreview}`;
    }

    throw new SafeFetchError(errorMessage, {
      isHtmlResponse: true,
      status: response.status
    });
  }

  // 尝试解析 JSON
  try {
    const data = await response.json();

    if (!response.ok) {
      // 如果响应状态不是 2xx，即使是 JSON 也抛出错误
      throw new SafeFetchError(data?.error || data?.message || `请求失败 (${response.status})`, {
        status: response.status
      });
    }

    return data as T;
  } catch (error) {
    if (error instanceof SafeFetchError) {
      throw error;
    }

    // JSON 解析失败
    throw new SafeFetchError('JSON 解析失败，服务器返回了无效的数据格式', {
      status: response.status
    });
  }
}

export default safeFetchJson;
