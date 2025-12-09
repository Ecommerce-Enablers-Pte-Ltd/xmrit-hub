// Base API client configuration and utilities

import { getErrorMessage } from "@/lib/utils";

export interface ApiError {
  error: string;
  message?: string;
  details?: Array<{ field?: string; message: string }>;
}

export class BaseApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = "") {
    this.baseUrl = baseUrl;
  }

  protected async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${this.baseUrl}/api${endpoint}`;

    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      credentials: "include", // Include cookies for session authentication
      ...options,
    });

    if (!response.ok) {
      let errorData: ApiError;
      try {
        errorData = await response.json();
      } catch {
        // If response is not JSON, create a structured error
        errorData = {
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      // Handle authentication errors
      if (response.status === 401) {
        // Redirect to sign-in page on authentication error
        if (typeof window !== "undefined") {
          window.location.href = "/auth/signin";
        }
      }

      // Extract error message using utility function
      const errorMessage = getErrorMessage(
        errorData,
        `API request failed (${response.status})`,
      );

      throw new Error(errorMessage);
    }

    return response.json();
  }

  /**
   * GET request helper
   */
  protected async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: "GET",
    });
  }

  /**
   * POST request helper
   */
  protected async post<T, D = unknown>(endpoint: string, data: D): Promise<T> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /**
   * PUT request helper
   */
  protected async put<T, D = unknown>(endpoint: string, data: D): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  /**
   * PATCH request helper
   */
  protected async patch<T, D = unknown>(endpoint: string, data: D): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  /**
   * DELETE request helper
   */
  protected async delete<T = void>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: "DELETE",
    });
  }
}
