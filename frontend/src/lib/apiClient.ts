/**
 * Enhanced API client with retry logic, exponential backoff, and request deduplication
 */

interface ApiClientOptions {
  baseUrl?: string;
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  skipAuth?: boolean;
  skipRetry?: boolean;
  timeout?: number;
}

interface PendingRequest {
  promise: Promise<any>;
  timestamp: number;
}

class ApiClient {
  private baseUrl: string;
  private maxRetries: number;
  private retryDelay: number;
  private timeout: number;
  private pendingRequests = new Map<string, PendingRequest>();
  private readonly DEDUP_WINDOW = 1000; // 1 second deduplication window

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:3001';
    this.maxRetries = options.maxRetries || 1; // Reduced to 1 for faster response
    this.retryDelay = options.retryDelay || 300; // Reduced to 300ms
    this.timeout = options.timeout || 10000; // Reduced to 10 seconds
  }

  /**
   * Generate a cache key for request deduplication
   */
  private getCacheKey(url: string, options: RequestOptions = {}): string {
    const method = options.method || 'GET';
    const body = options.body ? JSON.stringify(options.body) : '';
    return `${method}:${url}:${body}`;
  }

  /**
   * Clean up expired pending requests
   */
  private cleanupPendingRequests(): void {
    const now = Date.now();
    for (const [key, request] of this.pendingRequests.entries()) {
      if (now - request.timestamp > this.DEDUP_WINDOW) {
        this.pendingRequests.delete(key);
      }
    }
  }

  /**
   * Get auth token from localStorage
   */
  private getAuthToken(): string | null {
    return localStorage.getItem('token');
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Calculate exponential backoff delay
   */
  private getBackoffDelay(attempt: number, baseDelay: number = this.retryDelay): number {
    return Math.min(baseDelay * Math.pow(2, attempt), 30000); // Cap at 30 seconds
  }

  /**
   * Parse retry-after header
   */
  private getRetryAfter(response: Response): number {
    const retryAfter = response.headers.get('retry-after');
    if (!retryAfter) return 0;
    
    const seconds = parseInt(retryAfter, 10);
    return isNaN(seconds) ? 0 : seconds * 1000; // Convert to milliseconds
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(status: number, error?: Error): boolean {
    // Retry on rate limiting, server errors, and network errors
    return (
      status === 429 || // Too Many Requests
      (status >= 500 && status <= 599) || // Server errors
      !status || // Network errors
      error?.name === 'TypeError' || // Fetch network errors
      error?.name === 'AbortError' // Timeout errors
    );
  }

  /**
   * Make HTTP request with retry logic and deduplication
   */
  async request<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const cacheKey = this.getCacheKey(url, options);
    
    // Clean up old pending requests
    this.cleanupPendingRequests();
    
    // Check for pending identical request (deduplication)
    const pendingRequest = this.pendingRequests.get(cacheKey);
    if (pendingRequest && options.method === 'GET') {
      return pendingRequest.promise;
    }

    // Create the request promise
    const requestPromise = this.executeRequest<T>(url, options);
    
    // Store for deduplication (only for GET requests)
    if (options.method === 'GET' || !options.method) {
      this.pendingRequests.set(cacheKey, {
        promise: requestPromise,
        timestamp: Date.now()
      });
    }

    try {
      const result = await requestPromise;
      this.pendingRequests.delete(cacheKey);
      return result;
    } catch (error) {
      this.pendingRequests.delete(cacheKey);
      throw error;
    }
  }

  /**
   * Execute the actual HTTP request with retries
   */
  private async executeRequest<T>(url: string, options: RequestOptions): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        // Setup request headers
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...options.headers
        };

        // Add auth token if not skipped
        if (!options.skipAuth) {
          const token = this.getAuthToken();
          if (token) {
            headers.Authorization = `Bearer ${token}`;
          }
        }

        // Setup fetch options
        const fetchOptions: RequestInit = {
          method: options.method || 'GET',
          headers,
          signal: AbortSignal.timeout(options.timeout || this.timeout)
        };

        // Add body for non-GET requests
        if (options.body && options.method !== 'GET') {
          fetchOptions.body = typeof options.body === 'string' 
            ? options.body 
            : JSON.stringify(options.body);
        }

        // Make the request
        const response = await fetch(url, fetchOptions);
        
        // Handle successful responses
        if (response.ok) {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            return await response.json();
          }
          return await response.text() as T;
        }

        // Handle rate limiting (429)
        if (response.status === 429) {
          if (options.skipRetry || attempt === this.maxRetries) {
            throw new Error(`Rate limited: ${response.status} ${response.statusText}`);
          }

          const retryAfter = this.getRetryAfter(response);
          const delay = retryAfter || this.getBackoffDelay(attempt);
          
          await this.sleep(delay);
          continue;
        }

        // Handle other client errors (don't retry)
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          const errorText = await response.text().catch(() => 'Unknown error');
          throw new Error(`Client error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        // Handle server errors (retry)
        if (response.status >= 500) {
          const errorText = await response.text().catch(() => 'Server error');
          lastError = new Error(`Server error: ${response.status} ${response.statusText} - ${errorText}`);
          
          if (options.skipRetry || attempt === this.maxRetries) {
            throw lastError;
          }

          const delay = this.getBackoffDelay(attempt);
          await this.sleep(delay);
          continue;
        }

      } catch (error) {
        lastError = error as Error;
        
        // Don't retry if explicitly disabled or client errors
        if (options.skipRetry || attempt === this.maxRetries) {
          break;
        }

        // Check if error is retryable
        if (!this.isRetryableError(0, lastError)) {
          break;
        }

        const delay = this.getBackoffDelay(attempt);
        await this.sleep(delay);
      }
    }

    // If we've exhausted retries, throw the last error
    throw lastError || new Error('Request failed after maximum retries');
  }

  /**
   * Convenience methods for different HTTP verbs
   */
  async get<T = any>(endpoint: string, options: Omit<RequestOptions, 'method'> = {}): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T = any>(endpoint: string, body?: any, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'POST', body });
  }

  async put<T = any>(endpoint: string, body?: any, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'PUT', body });
  }

  async delete<T = any>(endpoint: string, options: Omit<RequestOptions, 'method'> = {}): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  /**
   * Clear all pending requests (useful for cleanup)
   */
  clearPendingRequests(): void {
    this.pendingRequests.clear();
  }
}

// Export a default instance
export const apiClient = new ApiClient();

// Export the class for custom instances
export { ApiClient };

// Export types
export type { ApiClientOptions, RequestOptions };
