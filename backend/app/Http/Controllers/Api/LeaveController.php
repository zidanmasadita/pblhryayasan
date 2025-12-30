<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PengajuanCuti;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Carbon\Carbon;

class LeaveController extends Controller
{
    /**
     * Display a listing of leave requests
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        // Check if user is HRD or admin
        if ($user->hasAnyRole(['kepala hrd', 'staff hrd', 'superadmin'])) {
            $leaves = PengajuanCuti::with(['user.profilePribadi'])
                ->orderBy('created_at', 'desc')
                ->get();
        } elseif ($user->hasRole('kepala sekolah')) {
            // Kepala sekolah hanya melihat pengajuan cuti dari tempat kerja yang sama
            $departemenId = $user->profilePekerjaan?->id_tempat_kerja;

            if ($departemenId) {
                $leaves = PengajuanCuti::whereHas('user.profilePekerjaan', function ($query) use ($departemenId) {
                    $query->where('id_tempat_kerja', $departemenId);
                })
                    ->with(['user.profilePribadi', 'user.profilePekerjaan'])
                    ->orderBy('created_at', 'desc')
                    ->get();
            } else {
                $leaves = collect([]);
            }
        } elseif ($user->hasRole('kepala departemen')) {
        // Kepala departemen hanya melihat pengajuan cuti dari departemen yang sama
        $departemenId = $user->profilePekerjaan?->id_departemen;

        if ($departemenId) {
            $leaves = PengajuanCuti::whereHas('user.profilePekerjaan', function ($query) use ($departemenId) {
                $query->where('id_departemen', $departemenId);
            })
                ->with(['user.profilePribadi'])
                ->orderBy('created_at', 'desc')
                ->get();
        } else {
            $leaves = collect([]);
        }
    } elseif ($user->hasRole('direktur pendidikan')) {
            // Direktur pendidikan melihat semua pengajuan cuti (untuk rekap)
            $leaves = PengajuanCuti::with(['user.profilePribadi'])
                ->orderBy('created_at', 'desc')
                ->get();
        } else {
            $leaves = PengajuanCuti::where('id_user', $user->id)
                ->with(['user.profilePribadi'])
                ->orderBy('created_at', 'desc')
                ->get();
        }

        return response()->json([
            'success' => true,
            'message' => 'Leave requests retrieved successfully',
            'data' => $leaves,
        ]);
    }

    /**
     * Store a newly created leave request
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        $request->validate([
            'tanggal_mulai' => 'required|date|after_or_equal:today',
            'tanggal_selesai' => 'required|date|after_or_equal:tanggal_mulai',
            'jenis_cuti' => 'required|string|max:255',
            'alasan' => 'required|string',
            'file_pendukung' => 'nullable|file|mimes:pdf,jpg,jpeg,png|max:2048',
        ]);

        // Determine initial status based on user role
        // 1. Kepala sekolah & Kepala departemen → ditinjau hrd
        // 2. Staff HRD → ditinjau kepala hrd
        // 3. Kepala HRD → ditinjau dirpen
        // 4. Others (tenaga pendidik) → ditinjau kepala sekolah
        $initialStatus = 'ditinjau kepala sekolah'; // default for tenaga pendidik

        if ($user->hasRole('kepala sekolah') || $user->hasRole('kepala departemen')) {
            $initialStatus = 'ditinjau hrd';
        } elseif ($user->hasRole('staff hrd')) {
            $initialStatus = 'ditinjau kepala hrd';
        } elseif ($user->hasRole('kepala hrd')) {
            $initialStatus = 'ditinjau dirpen';
        }

        $filePath = null;
        if ($request->hasFile('file_pendukung')) {
            $filePath = $request->file('file_pendukung')->store('leave-files', 'public');
        }

        $leave = PengajuanCuti::create([
            'id_user' => $user->id,
            'tanggal_mulai' => $request->tanggal_mulai,
            'tanggal_selesai' => $request->tanggal_selesai,
            'tipe_cuti' => strtolower($request->jenis_cuti),
            'alasan_pendukung' => $request->alasan,
            'file_pendukung' => $filePath,
            'status_pengajuan' => $initialStatus,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Leave request submitted successfully',
            'data' => $leave,
        ], 201);
    }

    /**
     * Display the specified leave request
     */
    public function show(PengajuanCuti $leave): JsonResponse
    {
        $leave->load(['user.profilePribadi']);

        return response()->json([
            'success' => true,
            'message' => 'Leave request retrieved successfully',
            'data' => $leave,
        ]);
    }

    /**
     * Update the specified leave request
     */
    public function update(Request $request, PengajuanCuti $leave): JsonResponse
    {
        $user = $request->user();

        // Only allow user to update their own pending requests
        if ($leave->id_user !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to update this leave request',
            ], 403);
        }

        // Check if leave request can still be updated
        $allowedStatuses = [
            'ditinjau kepala sekolah',
            'ditinjau hrd',
            'ditinjau kepala hrd',
            'ditinjau dirpen'
        ];
        if (!in_array($leave->status_pengajuan, $allowedStatuses)) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot update approved or rejected leave request',
            ], 400);
        }

        $request->validate([
            'tanggal_mulai' => 'sometimes|date|after_or_equal:today',
            'tanggal_selesai' => 'sometimes|date|after_or_equal:tanggal_mulai',
            'jenis_cuti' => 'sometimes|string|max:255',
            'alasan' => 'sometimes|string',
            'file_pendukung' => 'sometimes|file|mimes:pdf,jpg,jpeg,png|max:2048',
        ]);

        $updateData = [];
        if ($request->has('tanggal_mulai')) $updateData['tanggal_mulai'] = $request->tanggal_mulai;
        if ($request->has('tanggal_selesai')) $updateData['tanggal_selesai'] = $request->tanggal_selesai;
        if ($request->has('jenis_cuti')) $updateData['tipe_cuti'] = strtolower($request->jenis_cuti);
        if ($request->has('alasan')) $updateData['alasan_pendukung'] = $request->alasan;

        // Handle file replacement
        if ($request->hasFile('file_pendukung')) {
            if ($leave->file_pendukung && Storage::disk('public')->exists($leave->file_pendukung)) {
                Storage::disk('public')->delete($leave->file_pendukung);
            }
            $updateData['file_pendukung'] = $request->file('file_pendukung')->store('leave-files', 'public');
        }

        $leave->update($updateData);

        return response()->json([
            'success' => true,
            'message' => 'Leave request updated successfully',
            'data' => $leave,
        ]);
    }

    /**
     * Remove the specified leave request
     */
    public function destroy(Request $request, PengajuanCuti $leave): JsonResponse
    {
        $user = $request->user();

        // Only allow user to delete their own pending requests
        if ($leave->id_user !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to delete this leave request',
            ], 403);
        }

        // Check if leave request can still be deleted
        $allowedStatuses = [
            'ditinjau kepala sekolah',
            'ditinjau hrd',
            'ditinjau kepala hrd',
            'ditinjau dirpen'
        ];
        if (!in_array($leave->status_pengajuan, $allowedStatuses)) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot delete approved or rejected leave request',
            ], 400);
        }

        $leave->delete();

        return response()->json([
            'success' => true,
            'message' => 'Leave request deleted successfully',
        ]);
    }

    /**
     * Approve leave request
     */
    public function approve(Request $request, $id): JsonResponse
    {
        $user = $request->user();

        // Find the leave request by ID
        $leave = PengajuanCuti::find($id);

        if (!$leave) {
            return response()->json([
                'success' => false,
                'message' => 'Leave request not found',
            ], 404);
        }

        // Check if user has permission to approve
        if (!$user->hasAnyRole(['kepala hrd', 'staff hrd', 'superadmin'])) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to approve leave requests',
            ], 403);
        }

        // Check if leave request is in correct status for the user role
        if ($user->hasRole('staff hrd')) {
            // Staff HRD can only approve requests with status "ditinjau hrd"
            if ($leave->status_pengajuan !== 'ditinjau hrd') {
                return response()->json([
                    'success' => false,
                    'message' => 'Leave request is not in correct status for staff HRD approval',
                ], 400);
            }
            // Staff HRD approves → always goes to direktur pendidikan
            $newStatus = 'disetujui hrd menunggu tinjauan dirpen';
        } elseif ($user->hasRole('kepala hrd')) {
            // Kepala HRD can only approve requests with status "ditinjau kepala hrd"
            if ($leave->status_pengajuan !== 'ditinjau kepala hrd') {
                return response()->json([
                    'success' => false,
                    'message' => 'Leave request is not in correct status for kepala HRD approval',
                ], 400);
            }
            // Kepala HRD approves → always goes to direktur pendidikan
            $newStatus = 'disetujui kepala hrd menunggu tinjauan dirpen';
        } else {
            // Superadmin can approve any status
            // Determine status based on current status
            if ($leave->status_pengajuan === 'ditinjau hrd') {
                $newStatus = 'disetujui hrd menunggu tinjauan dirpen';
            } elseif ($leave->status_pengajuan === 'ditinjau kepala hrd') {
                $newStatus = 'disetujui kepala hrd menunggu tinjauan dirpen';
            } else {
                return response()->json([
                    'success' => false,
                    'message' => 'Leave request is not in correct status for approval',
                ], 400);
            }
        }

        // Get komentar from request if provided
        $komentar = $request->input('komentar', null);

        // Prepare update data
        $updateData = [
            'status_pengajuan' => $newStatus,
        ];

        if ($komentar !== null && $komentar !== '') {
            $updateData['komentar'] = $komentar;
        }

        // Update in database using update method to ensure it's an UPDATE query, not INSERT
        $updated = $leave->update($updateData);

        if (!$updated) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to update leave request status',
            ], 500);
        }

        // Refresh model and reload relationships to get latest data from database
        $leave->refresh();
        $leave->load(['user.profilePribadi']);

        return response()->json([
            'success' => true,
            'message' => 'Leave request approved successfully',
            'data' => $leave,
        ]);
    }

    /**
     * Reject leave request
     */
    public function reject(Request $request, $id): JsonResponse
    {
        $user = $request->user();

        // Find the leave request by ID
        $leave = PengajuanCuti::find($id);

        if (!$leave) {
            return response()->json([
                'success' => false,
                'message' => 'Leave request not found',
            ], 404);
        }

        // Check if user has permission to reject
        if (!$user->hasAnyRole(['kepala hrd', 'staff hrd', 'superadmin'])) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to reject leave requests',
            ], 403);
        }

        $request->validate([
            'reason' => 'sometimes|string',
        ]);

        // Check if leave request is in correct status for the user role
        if ($user->hasRole('staff hrd')) {
            // Staff HRD can only reject requests with status "ditinjau hrd"
            if ($leave->status_pengajuan !== 'ditinjau hrd') {
                return response()->json([
                    'success' => false,
                    'message' => 'Leave request is not in correct status for staff HRD rejection',
                ], 400);
            }
            $newStatus = 'ditolak hrd';
        } elseif ($user->hasRole('kepala hrd')) {
            // Kepala HRD can only reject requests with status "ditinjau kepala hrd"
            if ($leave->status_pengajuan !== 'ditinjau kepala hrd') {
                return response()->json([
                    'success' => false,
                    'message' => 'Leave request is not in correct status for kepala HRD rejection',
                ], 400);
            }
            $newStatus = 'ditolak kepala hrd';
        } else {
            // Superadmin can reject any status
            if ($leave->status_pengajuan === 'ditinjau hrd') {
                $newStatus = 'ditolak hrd';
            } elseif ($leave->status_pengajuan === 'ditinjau kepala hrd') {
                $newStatus = 'ditolak kepala hrd';
            } else {
                return response()->json([
                    'success' => false,
                    'message' => 'Leave request is not in correct status for rejection',
                ], 400);
            }
        }

        // Prepare update data
        $updateData = [
            'status_pengajuan' => $newStatus,
            'komentar' => $request->reason ?? 'Ditolak',
        ];

        // Update in database using update method to ensure it's an UPDATE query, not INSERT
        $updated = $leave->update($updateData);

        if (!$updated) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to update leave request status',
            ], 500);
        }

        // Refresh model and reload relationships to get latest data from database
        $leave->refresh();
        $leave->load(['user.profilePribadi']);

        return response()->json([
            'success' => true,
            'message' => 'Leave request rejected successfully',
            'data' => $leave,
        ]);
    }

    /**
     * Approve leave request by kepala sekolah
     */
    public function approveKepsek(Request $request, $id): JsonResponse
    {
        $user = $request->user();

        // Find the leave request by ID
        $leave = PengajuanCuti::find($id);

        if (!$leave) {
            return response()->json([
                'success' => false,
                'message' => 'Leave request not found',
            ], 404);
        }

        // Check if user has permission to approve (kepala sekolah)
        if (!$user->hasAnyRole(['kepala sekolah', 'superadmin'])) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to approve leave requests',
            ], 403);
        }

        // Check if leave request is in correct status
        if ($leave->status_pengajuan !== 'ditinjau kepala sekolah') {
            return response()->json([
                'success' => false,
                'message' => 'Leave request is not in correct status for kepala sekolah approval',
            ], 400);
        }

        // Get komentar from request if provided
        $komentar = $request->input('komentar', null);

        // Determine approval status based on leave type
        // For cuti tahunan, status should be "disetujui kepala sekolah menunggu tinjauan dirpen"
        // For other types, status should be "disetujui kepala sekolah"
        if (strtolower($leave->tipe_cuti) === 'cuti tahunan') {
            $newStatus = 'disetujui kepala sekolah menunggu tinjauan dirpen';
        } else {
            $newStatus = 'disetujui kepala sekolah';
        }

        // Prepare update data
        $updateData = [
            'status_pengajuan' => $newStatus,
        ];

        if ($komentar !== null && $komentar !== '') {
            $updateData['komentar'] = $komentar;
        }

        // Update in database
        $updated = $leave->update($updateData);

        if (!$updated) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to update leave request status',
            ], 500);
        }

        // Refresh model and reload relationships
        $leave->refresh();
        $leave->load(['user.profilePribadi']);

        return response()->json([
            'success' => true,
            'message' => 'Leave request approved successfully',
            'data' => $leave,
        ]);
    }

    /**
     * Reject leave request by kepala sekolah
     */
    public function rejectKepsek(Request $request, $id): JsonResponse
    {
        $user = $request->user();

        // Find the leave request by ID
        $leave = PengajuanCuti::find($id);

        if (!$leave) {
            return response()->json([
                'success' => false,
                'message' => 'Leave request not found',
            ], 404);
        }

        // Check if user has permission to reject (kepala sekolah)
        if (!$user->hasAnyRole(['kepala sekolah', 'superadmin'])) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to reject leave requests',
            ], 403);
        }

        // Check if leave request is in correct status
        if ($leave->status_pengajuan !== 'ditinjau kepala sekolah') {
            return response()->json([
                'success' => false,
                'message' => 'Leave request is not in correct status for kepala sekolah rejection',
            ], 400);
        }

        $request->validate([
            'reason' => 'required|string',
        ], [
            'reason.required' => 'Alasan penolakan wajib diisi',
        ]);

        // Prepare update data
        $updateData = [
            'status_pengajuan' => 'ditolak kepala sekolah',
            'komentar' => $request->reason,
        ];

        // Update in database
        $updated = $leave->update($updateData);

        if (!$updated) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to update leave request status',
            ], 500);
        }

        // Refresh model and reload relationships
        $leave->refresh();
        $leave->load(['user.profilePribadi']);

        return response()->json([
            'success' => true,
            'message' => 'Leave request rejected successfully',
            'data' => $leave,
        ]);
    }

    /**
     * Approve leave request by direktur pendidikan
     */
    public function approveDirpen(Request $request, $id): JsonResponse
    {
        $user = $request->user();

        // Find the leave request by ID
        $leave = PengajuanCuti::find($id);

        if (!$leave) {
            return response()->json([
                'success' => false,
                'message' => 'Leave request not found',
            ], 404);
        }

        // Check if user has permission to approve (direktur pendidikan)
        if (!$user->hasAnyRole(['direktur pendidikan', 'superadmin'])) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to approve leave requests',
            ], 403);
        }

        // Check if leave request is in correct status for direktur pendidikan approval
        $allowedStatuses = [
            'disetujui hrd menunggu tinjauan dirpen',
            'disetujui kepala hrd menunggu tinjauan dirpen',
            'disetujui kepala sekolah menunggu tinjauan dirpen',
            'ditinjau dirpen'
        ];

        if (!in_array($leave->status_pengajuan, $allowedStatuses)) {
            return response()->json([
                'success' => false,
                'message' => 'Leave request is not in correct status for direktur pendidikan approval',
            ], 400);
        }

        // Get komentar from request if provided
        $komentar = $request->input('komentar', null);

        // Prepare update data
        $updateData = [
            'status_pengajuan' => 'disetujui dirpen',
        ];

        if ($komentar !== null && $komentar !== '') {
            $updateData['komentar'] = $komentar;
        }

        // Update in database
        $updated = $leave->update($updateData);

        if (!$updated) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to update leave request status',
            ], 500);
        }

        // Refresh model and reload relationships
        $leave->refresh();
        $leave->load(['user.profilePribadi']);

        return response()->json([
            'success' => true,
            'message' => 'Leave request approved successfully',
            'data' => $leave,
        ]);
    }

    /**
     * Reject leave request by direktur pendidikan
     */
    public function rejectDirpen(Request $request, $id): JsonResponse
    {
        $user = $request->user();

        // Find the leave request by ID
        $leave = PengajuanCuti::find($id);

        if (!$leave) {
            return response()->json([
                'success' => false,
                'message' => 'Leave request not found',
            ], 404);
        }

        // Check if user has permission to reject (direktur pendidikan)
        if (!$user->hasAnyRole(['direktur pendidikan', 'superadmin'])) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to reject leave requests',
            ], 403);
        }

        // Check if leave request is in correct status for direktur pendidikan rejection
        $allowedStatuses = [
            'disetujui hrd menunggu tinjauan dirpen',
            'disetujui kepala hrd menunggu tinjauan dirpen',
            'disetujui kepala sekolah menunggu tinjauan dirpen',
            'ditinjau dirpen'
        ];

        if (!in_array($leave->status_pengajuan, $allowedStatuses)) {
            return response()->json([
                'success' => false,
                'message' => 'Leave request is not in correct status for direktur pendidikan rejection',
            ], 400);
        }

        $request->validate([
            'reason' => 'required|string',
        ], [
            'reason.required' => 'Alasan penolakan wajib diisi',
        ]);

        // Prepare update data
        $updateData = [
            'status_pengajuan' => 'ditolak dirpen',
            'komentar' => $request->reason,
        ];

        // Update in database
        $updated = $leave->update($updateData);

        if (!$updated) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to update leave request status',
            ], 500);
        }

        // Refresh model and reload relationships
        $leave->refresh();
        $leave->load(['user.profilePribadi']);

        return response()->json([
            'success' => true,
            'message' => 'Leave request rejected successfully',
            'data' => $leave,
        ]);
    }
}
