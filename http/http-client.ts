import { RequestError, RequestOptions } from "./types";

/**
 * HTTP 客戶端類，提供類似 axios 的功能
 */
export class HttpClient {
  private readonly baseUrl: string;
  private readonly defaultTimeout: number;
  private readonly requestInterceptors: Array<
    (
      endpoint: string,
      config: RequestOptions,
    ) => Promise<RequestOptions> | RequestOptions
  >;
  private readonly responseInterceptors: Array<{
    onFulfilled: (response: any) => any;
    onRejected: (error: any) => any;
  }>;

  /**
   * 創建 HTTP 客戶端實例
   * @param baseUrl 基礎 URL
   * @param defaultTimeout 默認超時時間（毫秒）
   */
  constructor(baseUrl: string = "", defaultTimeout: number = 10000) {
    this.baseUrl = baseUrl;
    this.defaultTimeout = defaultTimeout;
    this.requestInterceptors = [];
    this.responseInterceptors = [];
  }

  /**
   * 添加請求攔截器
   * @param interceptor 請求攔截器函數
   * @returns 攔截器 ID，用於移除攔截器
   */
  addRequestInterceptor(
    interceptor: (
      endpoint: string,
      config: RequestOptions,
    ) => Promise<RequestOptions> | RequestOptions,
  ): number {
    this.requestInterceptors.push(interceptor);
    return this.requestInterceptors.length - 1;
  }

  /**
   * 添加響應攔截器
   * @param onFulfilled 成功響應處理函數
   * @param onRejected 錯誤響應處理函數
   * @returns 攔截器 ID，用於移除攔截器
   */
  addResponseInterceptor(
    onFulfilled: (response: any) => any,
    onRejected: (error: any) => any,
  ): number {
    this.responseInterceptors.push({ onFulfilled, onRejected });
    return this.responseInterceptors.length - 1;
  }
  /**
   * 應用請求攔截器
   * @param config 請求配置
   * @returns 處理後的請求配置
   */
  private async applyRequestInterceptors(
    endpoint: string,
    config: RequestOptions,
  ): Promise<RequestOptions> {
    let currentConfig = { ...config };

    for (const interceptor of this.requestInterceptors) {
      currentConfig = await interceptor(endpoint, currentConfig);
    }

    return currentConfig;
  }

  /**
   * 應用響應攔截器
   * @param promise 響應 Promise
   * @returns 處理後的響應 Promise
   */
  private applyResponseInterceptors<T>(promise: Promise<T>): Promise<T> {
    return this.responseInterceptors.reduce(
      (acc, { onFulfilled, onRejected }) => acc.then(onFulfilled, onRejected),
      promise,
    );
  }

  /**
   * 發送 HTTP 請求
   * @param uri 請求路徑
   * @param options 請求選項
   * @returns 請求結果
   */
  async request<T = any>(uri: string, options: RequestOptions): Promise<T> {
    // 合併默認選項
    const opts: RequestOptions = {
      ...{
        method: "GET",
        timeout: this.defaultTimeout,
      },
      ...options,
    };

    try {
      // 構建完整 URL
      let endpoint = this.baseUrl
        ? `${this.baseUrl}${uri}`
        : `${process.env.API_URL_BASE}${uri}`;

      // 應用請求攔截器
      const processedOpts = await this.applyRequestInterceptors(endpoint, opts);

      // 處理查詢參數
      if (processedOpts.params) {
        const processedParams: Record<string, string> = {};

        for (const [key, value] of Object.entries(processedOpts.params)) {
          if (value === undefined || value === null) {
            continue;
          }

          // 如果是對象或數組，將其序列化為 JSON 字符串
          if (typeof value === "object") {
            processedParams[key] = JSON.stringify(value);
          } else {
            processedParams[key] = String(value);
          }
        }

        const params = new URLSearchParams(processedParams);
        endpoint = `${endpoint}?${params.toString()}`;
        delete processedOpts.params;
      }

      // 處理請求體
      if (processedOpts.data) {
        if (processedOpts.requestType === "form") {
          processedOpts.body = processedOpts.data;
        } else {
          processedOpts.body = JSON.stringify(processedOpts.data);
          // 設置內容類型為JSON（如果未指定）
          if (!processedOpts.headers?.["Content-Type"]) {
            processedOpts.headers = {
              ...processedOpts.headers,
              "Content-Type": "application/json",
            };
          }
        }
        delete processedOpts.data;
      }

      // 獲取超時時間並刪除自定義屬性
      const timeout = processedOpts.timeout || this.defaultTimeout;
      delete processedOpts.timeout;
      delete processedOpts.requestType;
      delete processedOpts.baseUrl;

      // 創建一個帶超時的Promise
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const fetchPromise = fetch(endpoint, {
        ...processedOpts,
        signal: controller.signal,
      });

      // 執行請求
      const response = await fetchPromise;
      clearTimeout(timeoutId); // 清除超時計時器

      let result: any;

      if (response.ok) {
        result = await response.json();
        return this.applyResponseInterceptors(Promise.resolve(result));
      } else {
        let errorData = null;
        let errorMessage = `請求失敗：HTTP ${response.status} ${response.statusText}`;

        try {
          errorData = await response.json();
          if (errorData?.message) {
            errorMessage = errorData.message;
          }
        } catch (_) {
          // JSON解析失敗，使用默認錯誤信息
        }

        // 創建錯誤對象並應用響應攔截器
        const error = new RequestError(
          errorMessage,
          response.status,
          errorData,
        );
        return this.applyResponseInterceptors(Promise.reject(error));
      }
    } catch (error) {
      // 處理AbortError（超時）
      if (error instanceof DOMException && error.name === "AbortError") {
        const timeoutError = new RequestError(
          "請求超時，請稍後再試",
          408,
          null,
        );
        return this.applyResponseInterceptors(Promise.reject(timeoutError));
      }

      // 處理網絡錯誤（API不可達）
      if (error instanceof TypeError && error.message.includes("fetch")) {
        const networkError = new RequestError(
          "無法連接到伺服器，請檢查網絡連接",
          0,
          null,
        );
        return this.applyResponseInterceptors(Promise.reject(networkError));
      }

      // 如果是已經處理過的RequestError，直接返回
      if (error instanceof RequestError) {
        return this.applyResponseInterceptors(Promise.reject(error));
      }

      // 其他未知錯誤
      console.error("請求錯誤:", error); // 添加日誌記錄
      const unknownError = new RequestError("發生未知錯誤", 500, error);
      return this.applyResponseInterceptors(Promise.reject(unknownError));
    }
  }
}
