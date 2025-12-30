"use client";

import React, { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AccessControl from "@/components/AccessControl";
import { apiClient } from "@/lib/api";

interface KategoriEvaluasi {
  id: number;
  nama: string;
  created_at?: string | null;
  updated_at?: string | null;
}

type AlertState =
  | { type: "success" | "error"; message: string }
  | null;

function Modal({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{title}</h2>
          <div>{children}</div>
        </div>
      </div>
    </div>
  );
}

export default function HRDKategoriEvaluasiPage() {
  const router = useRouter();

  const [categories, setCategories] = useState<KategoriEvaluasi[]>([]);
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alert, setAlert] = useState<AlertState>(null);

  const [openModal, setOpenModal] = useState(false);
  const [editing, setEditing] = useState<KategoriEvaluasi | null>(null);
  const [formNama, setFormNama] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<KategoriEvaluasi | null>(null);

  const loadCategories = useCallback(async () => {
    setIsLoading(true);
    setAlert(null);
    try {
      const res = await apiClient.kategoriEvaluasi.getAll();
      if (res?.success) {
        setCategories((res.data as KategoriEvaluasi[]) || []);
      } else {
        setAlert({ type: "error", message: res?.message || "Gagal memuat data." });
      }
    } catch {
      setAlert({ type: "error", message: "Terjadi kesalahan." });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const filtered = categories.filter((c) =>
    c.nama.toLowerCase().includes(query.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  const openAdd = () => {
    setEditing(null);
    setFormNama("");
    setOpenModal(true);
  };

  const openEdit = (k: KategoriEvaluasi) => {
    setEditing(k);
    setFormNama(k.nama);
    setOpenModal(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formNama.trim()) {
      setAlert({ type: "error", message: "Nama kategori wajib diisi." });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = editing
        ? await apiClient.kategoriEvaluasi.update(editing.id, { nama: formNama })
        : await apiClient.kategoriEvaluasi.create({ nama: formNama });

      if (res?.success) {
        setAlert({
          type: "success",
          message: editing ? "Kategori diperbarui." : "Kategori ditambahkan.",
        });
        setOpenModal(false);
        await loadCategories();
      } else {
        setAlert({ type: "error", message: res?.message || "Operasi gagal." });
      }
    } catch {
      setAlert({ type: "error", message: "Terjadi kesalahan." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsSubmitting(true);
    try {
      const res = await apiClient.kategoriEvaluasi.delete(deleteTarget.id);
      if (res?.success) {
        setAlert({ type: "success", message: "Kategori dihapus." });
        await loadCategories();
      } else {
        setAlert({ type: "error", message: "Gagal menghapus." });
      }
    } finally {
      setDeleteTarget(null);
      setIsSubmitting(false);
    }
  };

  /* ===================== */
  /* Render */
  /* ===================== */
  return (
    <AccessControl allowedRoles={["kepala hrd", "staff hrd"]}>
      <div className="min-h-screen bg-gray-50 overflow-x-hidden">
        {/* Header */}
        <div className="bg-white px-4 py-4 border-b border-gray-200 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.back()}
              className="flex items-center text-blue-600"
            >
              <svg
                className="w-6 h-6 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Kembali
            </button>
            <h1 className="text-lg font-semibold text-gray-800">
              Kelola Kategori Evaluasi
            </h1>
            <div className="w-16"></div>
          </div>
        </div>

        {/* Notification */}
        {alert && (
          <div
            className={`mx-4 mt-4 p-4 rounded-lg ${
              alert.type === "success"
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {alert.message}
          </div>
        )}

        {/* Content */}
        <div className="p-2 sm:p-4">
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {/* Header Card */}
            <div className="p-3 sm:p-4 border-b border-gray-200">
              <button
                onClick={openAdd}
                className="bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 flex items-center justify-center w-full text-sm sm:text-base"
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Tambah Baru
              </button>
            </div>

            {/* Search Bar */}
            <div className="p-3 sm:p-4 border-b border-gray-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="text-xs sm:text-sm text-gray-700 whitespace-nowrap">Show</label>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    className="border border-gray-300 text-gray-700 rounded px-2 py-1 text-xs sm:text-sm"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                  <span className="text-xs sm:text-sm text-gray-700 whitespace-nowrap">entries</span>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-xs sm:text-sm text-gray-700 whitespace-nowrap">Search:</span>
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPage(1);
                    }}
                    className="border border-gray-300 text-gray-700 rounded px-2 py-1 text-xs sm:text-sm flex-1 sm:flex-initial sm:w-32 min-w-0"
                  />
                </div>
              </div>
            </div>

            {/* Card List */}
            <div className="p-3 sm:p-4">
              {isLoading ? (
                <div className="text-center py-12 text-gray-500">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading...</p>
                </div>
              ) : pageItems.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <svg
                    className="w-16 h-16 mx-auto mb-4 text-gray-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <p className="text-lg font-medium">Tidak ada data</p>
                  <p className="text-sm">Klik "Tambah Baru" untuk menambahkan kategori</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pageItems.map((k, index) => (
                    <div
                      key={k.id}
                      className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex flex-col gap-2 mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-1 rounded shrink-0">
                              {(page - 1) * pageSize + index + 1}
                            </span>
                            <h3 className="text-sm sm:text-base font-semibold text-gray-900 break-words flex-1 min-w-0">
                              {k.nama}
                            </h3>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col xs:flex-row gap-2 pt-3 border-t border-gray-100">
                        <button
                          onClick={() => openEdit(k)}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-yellow-50 text-yellow-600 px-3 py-2 rounded-lg hover:bg-yellow-100 transition-colors text-xs sm:text-sm"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                          <span className="font-medium">Edit</span>
                        </button>
                        <button
                          onClick={() => setDeleteTarget(k)}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-red-50 text-red-600 px-3 py-2 rounded-lg hover:bg-red-100 transition-colors text-xs sm:text-sm"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                          <span className="font-medium">Hapus</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

            {/* Pagination */}
            {pageItems.length > 0 && (
              <div className="p-3 sm:p-4 border-t border-gray-200">
                <div className="text-xs sm:text-sm text-gray-700 mb-3 text-center sm:text-left">
                  Showing {(page - 1) * pageSize + 1} to{" "}
                  {Math.min(page * pageSize, filtered.length)} of{" "}
                  {filtered.length} entries
                </div>
                <div className="flex justify-center gap-1 sm:gap-2 flex-wrap">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-2 sm:px-3 py-1.5 border border-gray-300 text-gray-700 rounded text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 whitespace-nowrap"
                  >
                    <span className="hidden xs:inline">Previous</span>
                    <span className="xs:hidden">Prev</span>
                  </button>
                  <div className="px-2 sm:px-3 py-1.5 bg-blue-600 text-white rounded text-xs sm:text-sm font-medium whitespace-nowrap">
                    {page} / {totalPages}
                  </div>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-2 sm:px-3 py-1.5 border border-gray-300 text-gray-700 rounded text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 whitespace-nowrap"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
            </div>
          </div>
        </div>

        {/* Add/Edit Modal */}
        <Modal
          title={editing ? "Edit Kategori" : "Tambah Data"}
          open={openModal}
          onClose={() => setOpenModal(false)}
        >
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nama Kategori <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formNama}
                  onChange={(e) => setFormNama(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-400"
                  placeholder="Masukkan nama kategori"
                  required
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                type="button"
                onClick={() => setOpenModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isSubmitting ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </form>
        </Modal>

        {/* Delete Modal */}
        {deleteTarget && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full">
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Hapus Data
                </h2>
                <p className="text-gray-700 mb-6">
                  Apakah anda yakin ingin{" "}
                  <span className="text-red-600 font-semibold">
                    menghapus data
                  </span>{" "}
                  <span className="font-semibold text-gray-900">
                    {deleteTarget.nama}
                  </span>
                  ?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(null)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {isSubmitting ? "Menghapus..." : "Hapus"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AccessControl>
  );
}
