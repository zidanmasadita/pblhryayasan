import axios, {
  AxiosInstance,
  InternalAxiosRequestConfig,
  AxiosResponse,
  AxiosError,
} from "axios";

import { ApiResponse } from "@/types/auth";
import { API_CONFIG } from "@/config/api";

/**
 * ===============================
 * AXIOS INSTANCE
 * ===============================
 */
const api: AxiosInstance = axios.create({
  baseURL: `${API_CONFIG.BASE_URL}/api`,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },

  /**
   * PENTING:
   * - WAJIB true (Sanctum)
   */
  withCredentials: true,

  xsrfCookieName: "XSRF-TOKEN",
  xsrfHeaderName: "X-XSRF-TOKEN",
});

/**
 * ===============================
 * REQUEST INTERCEPTOR
 * ===============================
 */
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem("auth_token");

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * ===============================
 * RESPONSE INTERCEPTOR
 * ===============================
 */
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    const status = error.response?.status;
    const url = error.config?.url ?? "";

    if (status === 401) {
      const whitelist = [
        "/auth/login",
        "/auth/me",
        "/auth/logout",
      ];

      const isWhitelisted = whitelist.some((p) => url.includes(p));

      if (!isWhitelisted) {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("user_data");

        if (typeof window !== "undefined") {
          window.location.href = "/";
        }
      }
    }

    return Promise.reject(error);
  }
);

/**
 * ===============================
 * API CLIENT
 * ===============================
 */
export const apiClient = {
  auth: {
    /**
     * ===============================
     * CSRF (HANYA UNTUK LOGIN)
     * ===============================
     */
    csrf: async (): Promise<void> => {
      await axios.get(
        `${API_CONFIG.BASE_URL}/sanctum/csrf-cookie`,
        { withCredentials: true }
      );
    },

    /**
     * ===============================
     * LOGIN
     * ===============================
     */
    login: async (
      email: string,
      password: string
    ): Promise<ApiResponse> => {
      await apiClient.auth.csrf();

      const response = await api.post(
        "/auth/login",
        { email, password },
        { withCredentials: true }
      );

      return response.data;
    },

    /**
     * ===============================
     * LOGOUT
     * ===============================
     */
    logout: async (): Promise<ApiResponse> => {
      try {
        const response = await api.post(
          "/auth/logout",
          {},
          { withCredentials: true }
        );

        localStorage.removeItem("auth_token");
        localStorage.removeItem("user_data");

        return response.data;
      } catch (error: any) {
        if (error.response?.status === 401) {
          localStorage.removeItem("auth_token");
          localStorage.removeItem("user_data");

          return {
            success: true,
            message: "Logout berhasil",
          } as ApiResponse;
        }

        throw error;
      }
    },

    /**
     * ===============================
     * CURRENT USER
     * ===============================
     */
    me: async (): Promise<ApiResponse> => {
      try {
        const response = await api.get(
          "/auth/me",
          { withCredentials: true }
        );

        return response.data;
      } catch (error: any) {
        if (error.response?.status === 401) {
          return {
            success: false,
            message: "Unauthenticated",
          } as ApiResponse;
        }

        throw error;
      }
    },
  },

  /**
   * ===============================
   * USERS (CONTOH)
   * ===============================
   */
  users: {
    getAll: async (): Promise<ApiResponse> => {
      const response = await api.get(
        "/users",
        { withCredentials: true }
      );

      return response.data;
    },
  },
};

export default api;
