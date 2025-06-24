/**
 * @file types.ts
 * @description HTTP 請求相關類型定義
 */

/**
 * 響應代碼常量
 * 對應後端的 ResponseCodes 類
 */
export enum ResponseCodes {
  /**
   * 成功
   */
  Success = 0,

  /**
   * 一般性錯誤
   */
  GeneralError = -1,

  /**
   * 驗證錯誤
   */
  ValidationError = 400,

  /**
   * 未授權
   */
  Unauthorized = 401,

  /**
   * 禁止訪問
   */
  Forbidden = 403,

  /**
   * 資源不存在
   */
  NotFound = 404,

  /**
   * 伺服器內部錯誤
   */
  InternalServerError = 500,

  /**
   * 服務不可用
   */
  ServiceUnavailable = 503,
}

/**
 * HTTP 請求方法類型
 */
export type RequestMethod = "POST" | "GET" | "DELETE" | "PATCH" | "PUT";

/**
 * Next.js 特定的獲取選項
 */
export type NextFetchOptions = {
  /**
   * 重新驗證時間（秒）
   */
  revalidate?: false | 0 | number;

  /**
   * 緩存標籤
   */
  tags?: string[];
};

/**
 * HTTP 請求選項
 */
export type RequestOptions = {
  /**
   * 基礎 URL
   */
  baseUrl?: string;

  /**
   * 請求方法
   */
  method: RequestMethod;

  /**
   * 請求內容類型
   */
  requestType?: string;

  /**
   * 請求頭
   */
  headers?: Record<string, string>;

  /**
   * 緩存策略
   */
  cache?: RequestCache;

  /**
   * URL 參數
   */
  params?: Record<string, any>;

  /**
   * 請求體（字符串格式）
   */
  body?: string;

  /**
   * 請求數據（對象格式）
   */
  data?: any;

  /**
   * Next.js 特定選項
   */
  next?: NextFetchOptions;

  /**
   * 請求超時時間（毫秒）
   */
  timeout?: number;
};

/**
 * 通用響應結果類型
 * 用於 ResponseInterceptor 處理
 */
export interface GenericResponseResult {
  /**
   * 回應狀態碼
   */
  code: ResponseCodes;

  /**
   * 回應訊息
   */
  message: string;

  /**
   * 回應數據
   */
  data: any;
}

/**
 * 網絡請求錯誤類
 */
export class RequestError extends Error {
  /**
   * HTTP 狀態碼
   */
  status: number;

  /**
   * 錯誤數據
   */
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = "網絡請求失敗";
    this.status = status;
    this.data = data;
  }
}
