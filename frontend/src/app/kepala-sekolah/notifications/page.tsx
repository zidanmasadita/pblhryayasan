"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bell, Check, X, FileText, Calendar } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { apiClient } from "@/lib/api";
import AccessControl from "@/components/AccessControl";
import toast from "react-hot-toast";

interface Notification {
  id: string;
  type: string;
  category: string;
  title: string;
  message: string;
  timestamp: string;
  data: any;
}

export default function NotifikasiPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all"); // all, leave, slip_gaji
  const [readNotifications, setReadNotifications] = useState<string[]>([]);

  // Load read notifications from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("readNotifications");
    if (stored) {
      try {
        setReadNotifications(JSON.parse(stored));
      } catch (error) {
        console.error("Error parsing read notifications:", error);
      }
    }
  }, []);

  // Load notifications
  useEffect(() => {
    loadNotifications();
  }, []);

  // Filter notifications when filter changes
  useEffect(() => {
    if (filter === "all") {
      setFilteredNotifications(notifications);
    } else {
      setFilteredNotifications(
        notifications.filter((n) => n.category === filter)
      );
    }
  }, [filter, notifications]);

  const loadNotifications = async () => {
    try {
      setIsLoading(true);
      
      // Fetch both notification types concurrently
      const [userNotifs, verifierNotifs] = await Promise.all([
        apiClient.notifications.getAll(),
        apiClient.notifications.getVerifierNotifications()
      ]);
      
      const allNotifications: Notification[] = [];
      
      // Add user notifications (approval/rejection of their own leaves)
      if (userNotifs.success && userNotifs.data && Array.isArray(userNotifs.data)) {
        allNotifications.push(...userNotifs.data);
      }
      
      // Add verifier notifications (leaves that need verification)
      if (verifierNotifs.success && verifierNotifs.data && Array.isArray(verifierNotifs.data)) {
        allNotifications.push(...verifierNotifs.data);
      }
      
      // Sort by timestamp (most recent first)
      allNotifications.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      
      setNotifications(allNotifications);
    } catch (error: any) {
      console.error("Error loading notifications:", error);
      toast.error("Gagal memuat notifikasi");
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = (id: string) => {
    if (!readNotifications.includes(id)) {
      const updated = [...readNotifications, id];
      setReadNotifications(updated);
      localStorage.setItem("readNotifications", JSON.stringify(updated));
    }
  };

  const markAllAsRead = () => {
    const allIds = notifications.map((n) => n.id);
    setReadNotifications(allIds);
    localStorage.setItem("readNotifications", JSON.stringify(allIds));
    toast.success("Semua notifikasi ditandai sudah dibaca");
  };

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    markAsRead(notification.id);

    // Navigate based on category and type
    if (notification.category === "leave") {
      // Check if this is a verification notification
      if (notification.type === "leave_verification_needed") {
        router.push("/kepala-sekolah/verifikasi-cuti");
      } else {
        router.push("/kepala-sekolah/pengajuan-cuti");
      }
    } else if (notification.category === "slip_gaji") {
      router.push("/kepala-sekolah/slip-gaji");
    }
  };

  const getTimeAgo = (timestamp: string) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diff = Math.floor((now.getTime() - then.getTime()) / 1000);

    if (diff < 60) return "Baru saja";
    if (diff < 3600) return `${Math.floor(diff / 60)} menit yang lalu`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} jam yang lalu`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} hari yang lalu`;
    return then.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "leave_approved":
        return <Check className="w-5 h-5 text-green-600" />;
      case "leave_rejected":
        return <X className="w-5 h-5 text-red-600" />;
      case "leave_verification_needed":
        return <Calendar className="w-5 h-5 text-orange-600" />;
      case "slip_gaji":
        return <FileText className="w-5 h-5 text-blue-600" />;
      default:
        return <Bell className="w-5 h-5 text-gray-600" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case "leave_approved":
        return "border-r-4 border-r-green-500";
      case "leave_rejected":
        return "border-r-4 border-r-red-500";
      case "leave_verification_needed":
        return "border-r-4 border-r-orange-500";
      case "slip_gaji":
        return "border-r-4 border-r-blue-500";
      default:
        return "border-r-4 border-r-gray-400";
    }
  };

  const unreadCount = notifications.filter(
    (n) => !readNotifications.includes(n.id)
  ).length;

  return (
    <AccessControl allowedRoles={["kepala sekolah"]}>
      <div className="min-h-screen bg-gray-100 pb-20">
        <div className="px-3 sm:px-5 py-4 sm:py-6">
          {/* Header */}
          <div className="mb-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => router.back()}
                  className="p-2 hover:bg-gray-200 rounded-full transition-colors flex-shrink-0"
                  aria-label="Kembali"
                >
                  <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6 text-gray-700" />
                </button>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
                    Notifikasi
                  </h1>
                  {unreadCount > 0 && (
                    <p className="text-sm text-gray-600">
                      {unreadCount} belum dibaca
                    </p>
                  )}
                </div>
              </div>

              {notifications.length > 0 && unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap"
                >
                  Tandai Semua Dibaca
                </button>
              )}
            </div>

            {/* Filter Buttons */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              <button
                onClick={() => setFilter("all")}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  filter === "all"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                Semua ({notifications.length})
              </button>
              <button
                onClick={() => setFilter("leave")}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  filter === "leave"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                Cuti ({notifications.filter((n) => n.category === "leave").length})
              </button>
              <button
                onClick={() => setFilter("slip_gaji")}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  filter === "slip_gaji"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                Slip Gaji ({notifications.filter((n) => n.category === "slip_gaji").length})
              </button>
            </div>
          </div>

          {/* Notifications List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-gray-600">Memuat notifikasi...</p>
              </div>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center">
              <Bell className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-700 mb-1">
                Tidak Ada Notifikasi
              </h3>
              <p className="text-gray-600 text-sm">
                {filter === "all"
                  ? "Anda belum memiliki notifikasi"
                  : `Tidak ada notifikasi ${filter === "leave" ? "cuti" : "slip gaji"}`}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredNotifications.map((notification) => {
                const isRead = readNotifications.includes(notification.id);

                return (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`bg-white ${getNotificationColor(
                      notification.type
                    )} border border-gray-200 rounded-xl p-5 shadow-md cursor-pointer transition-all duration-300 hover:shadow-xl hover:scale-[1.01] ${
                      !isRead ? "ring-2 ring-blue-500 ring-offset-2" : ""
                    }`}
                  >
                    <div className="flex flex-col">
                      {/* Content */}
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3
                            className={`text-base sm:text-lg font-semibold text-gray-900 ${
                              !isRead ? "font-bold" : ""
                            }`}
                          >
                            {notification.title}
                            {!isRead && (
                              <span className="ml-2 inline-block px-2.5 py-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs font-bold rounded-full shadow-sm">
                                BARU
                              </span>
                            )}
                          </h3>
                        </div>

                        <p className="text-sm text-gray-600 mb-3 leading-relaxed">
                          {notification.message}
                        </p>

                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Calendar className="w-3.5 h-3.5" />
                          <span className="font-medium">{getTimeAgo(notification.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AccessControl>
  );
}
