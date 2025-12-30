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
   * USERS
   * ===============================
   */
  users: {
    getAll: async (): Promise<ApiResponse> => {
      const response = await api.get("/users", { withCredentials: true });
      return response.data;
    },
  },

  /**
   * ===============================
   * ATTENDANCE
   * ===============================
   */
  attendance: {
    getToday: async (): Promise<ApiResponse> => {
      const response = await api.get("/attendance/today", { withCredentials: true });
      return response.data;
    },

    getHistory: async (params?: Record<string, unknown>): Promise<ApiResponse> => {
      const response = await api.get("/attendance/history", { params, withCredentials: true });
      return response.data;
    },

    checkIn: async (data?: {
      latitude_in?: number;
      longitude_in?: number;
      keterangan?: string;
      file_pendukung?: File;
    }): Promise<ApiResponse> => {
      if (!data?.file_pendukung) {
        const response = await api.post("/attendance/checkin", {
          latitude_in: data?.latitude_in,
          longitude_in: data?.longitude_in,
          keterangan: data?.keterangan,
        }, { withCredentials: true });
        return response.data;
      }

      const formData = new FormData();
      if (data?.latitude_in !== undefined) formData.append("latitude_in", data.latitude_in.toString());
      if (data?.longitude_in !== undefined) formData.append("longitude_in", data.longitude_in.toString());
      if (data?.keterangan) formData.append("keterangan", data.keterangan);
      if (data?.file_pendukung) formData.append("file_pendukung", data.file_pendukung);

      const response = await api.post("/attendance/checkin", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        withCredentials: true,
      });
      return response.data;
    },

    checkOut: async (data?: {
      latitude_out?: number;
      longitude_out?: number;
      keterangan?: string;
    }): Promise<ApiResponse> => {
      const response = await api.post("/attendance/checkout", data, { withCredentials: true });
      return response.data;
    },
  },

  /**
   * ===============================
   * DASHBOARD  
   * ===============================
   */
  dashboard: {
    getPersonal: async (): Promise<ApiResponse> => {
      const response = await api.get("/dashboard/personal", { withCredentials: true });
      return response.data;
    },

    getStats: async (): Promise<ApiResponse> => {
      const response = await api.get("/dashboard/stats", { withCredentials: true });
      return response.data;
    },
  },

  /**
   * ===============================
   * LEAVE (CUTI)
   * ===============================
   */
  leave: {
    getAll: async (): Promise<ApiResponse> => {
      const response = await api.get("/leave", { withCredentials: true });
      return response.data;
    },

    create: async (data: unknown): Promise<ApiResponse> => {
      const isFormData = typeof FormData !== "undefined" && data instanceof FormData;
      const response = await api.post("/leave", data, {
        headers: isFormData ? { "Content-Type": "multipart/form-data" } : undefined,
        withCredentials: true,
      });
      return response.data;
    },

    approve: async (id: number, komentar?: string): Promise<ApiResponse> => {
      const response = await api.post(`/leave/${id}/approve`, komentar ? { komentar } : {}, { withCredentials: true });
      return response.data;
    },

    reject: async (id: number, reason?: string): Promise<ApiResponse> => {
      const response = await api.post(`/leave/${id}/reject`, { reason }, { withCredentials: true });
      return response.data;
    },
  },

  /**
   * ===============================
   * EVALUATION
   * ===============================
   */
  evaluation: {
    getAll: async (): Promise<ApiResponse> => {
      const response = await api.get("/evaluation", { withCredentials: true });
      return response.data;
    },

    getPersonal: async (): Promise<ApiResponse> => {
      const response = await api.get("/evaluation/personal", { withCredentials: true });
      return response.data;
    },
  },

  /**
   * ===============================
   * KATEGORI EVALUASI
   * ===============================
   */
  kategoriEvaluasi: {
    getAll: async (): Promise<ApiResponse> => {
      const response = await api.get("/kategori-evaluasi", { withCredentials: true });
      return response.data;
    },

    create: async (data: { nama: string }): Promise<ApiResponse> => {
      const response = await api.post("/kategori-evaluasi", data, { withCredentials: true });
      return response.data;
    },

    update: async (id: number, data: { nama: string }): Promise<ApiResponse> => {
      const response = await api.put(`/kategori-evaluasi/${id}`, data, { withCredentials: true });
      return response.data;
    },

    delete: async (id: number): Promise<ApiResponse> => {
      const response = await api.delete(`/kategori-evaluasi/${id}`, { withCredentials: true });
      return response.data;
    },
  },

  /**
   * ===============================
   * NOTIFICATIONS
   * ===============================
   */
  notifications: {
    getAll: async (): Promise<ApiResponse> => {
      const response = await api.get("/notifications", { withCredentials: true });
      return response.data;
    },

    getVerifierNotifications: async (): Promise<ApiResponse> => {
      const response = await api.get("/verifier-notifications", { withCredentials: true });
      return response.data;
    },
  },
};

export default api;