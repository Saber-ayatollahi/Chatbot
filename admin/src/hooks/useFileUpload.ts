/**
 * useFileUpload Hook - Full Implementation
 * Phase 2: Document Upload & Staging
 * Comprehensive file upload management with progress tracking
 */

import { useState, useEffect, useCallback } from 'react';
import { FileUpload, UseFileUploadReturn, FileStatus, ValidationStatus } from '../types/ingestion';

// Mock API service for file uploads
class FileUploadService {
  private static instance: FileUploadService;
  private uploads: Map<string, FileUpload> = new Map();
  private activeUploads: Map<string, AbortController> = new Map();

  static getInstance(): FileUploadService {
    if (!FileUploadService.instance) {
      FileUploadService.instance = new FileUploadService();
    }
    return FileUploadService.instance;
  }

  // Generate unique upload ID
  private generateUploadId(): string {
    return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Calculate file hash (simplified)
  private async calculateFileHash(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Extract file metadata
  private async extractMetadata(file: File): Promise<any> {
    // Simplified metadata extraction
    return {
      title: file.name.replace(/\.[^/.]+$/, ''),
      creationDate: new Date(file.lastModified),
      modificationDate: new Date(file.lastModified),
      documentType: file.type,
      language: 'en',
    };
  }

  // Validate file
  private async validateFile(file: File): Promise<{ status: ValidationStatus; errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let status: ValidationStatus = 'valid';

    // File size validation
    if (file.size === 0) {
      errors.push('File is empty');
      status = 'invalid';
    } else if (file.size > 50 * 1024 * 1024) { // 50MB
      errors.push('File size exceeds 50MB limit');
      status = 'invalid';
    }

    // File type validation
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/markdown'];
    if (!allowedTypes.includes(file.type)) {
      errors.push(`Unsupported file type: ${file.type}`);
      status = 'invalid';
    }

    // File name validation
    if (file.name.length > 255) {
      warnings.push('File name is very long');
      if (status === 'valid') status = 'warning';
    }

    // Check for special characters
    if (/[<>:"/\\|?*]/.test(file.name)) {
      warnings.push('File name contains special characters');
      if (status === 'valid') status = 'warning';
    }

    return { status, errors, warnings };
  }

  // Simulate file upload with progress
  async uploadFile(
    file: File,
    onProgress: (progress: number) => void
  ): Promise<FileUpload> {
    const uploadId = this.generateUploadId();
    const abortController = new AbortController();
    this.activeUploads.set(uploadId, abortController);

    try {
      // Create initial upload record
      const fileUpload: FileUpload = {
        uploadId,
        filename: `${Date.now()}_${file.name}`,
        originalName: file.name,
        filePath: `/staging/${uploadId}_${file.name}`,
        fileSize: file.size,
        fileHash: await this.calculateFileHash(file),
        mimeType: file.type,
        uploadStatus: 'processing',
        validationStatus: 'pending',
        metadata: await this.extractMetadata(file),
        uploadProgress: 0,
        uploadedAt: new Date(),
      };

      this.uploads.set(uploadId, fileUpload);

      // Simulate upload progress
      for (let progress = 0; progress <= 100; progress += 10) {
        if (abortController.signal.aborted) {
          throw new Error('Upload cancelled');
        }

        await new Promise(resolve => setTimeout(resolve, 200)); // Simulate network delay
        
        const updatedUpload = {
          ...fileUpload,
          uploadProgress: progress,
          uploadStatus: progress === 100 ? 'completed' as FileStatus : 'processing' as FileStatus,
        };
        
        this.uploads.set(uploadId, updatedUpload);
        onProgress(progress);
      }

      // Perform validation
      const validation = await this.validateFile(file);
      const finalUpload: FileUpload = {
        ...fileUpload,
        uploadStatus: 'completed',
        validationStatus: validation.status,
        validationErrors: validation.errors.length > 0 ? validation.errors : undefined,
        validationWarnings: validation.warnings.length > 0 ? validation.warnings : undefined,
        uploadProgress: 100,
        processedAt: new Date(),
      };

      this.uploads.set(uploadId, finalUpload);
      this.activeUploads.delete(uploadId);

      return finalUpload;
    } catch (error) {
      const failedUpload: FileUpload = {
        ...this.uploads.get(uploadId)!,
        uploadStatus: 'failed',
        validationStatus: 'invalid',
        validationErrors: [error instanceof Error ? error.message : 'Upload failed'],
      };

      this.uploads.set(uploadId, failedUpload);
      this.activeUploads.delete(uploadId);
      throw error;
    }
  }

  // Get all uploads
  getAllUploads(): FileUpload[] {
    return Array.from(this.uploads.values()).sort((a, b) => 
      b.uploadedAt.getTime() - a.uploadedAt.getTime()
    );
  }

  // Cancel upload
  cancelUpload(uploadId: string): void {
    const controller = this.activeUploads.get(uploadId);
    if (controller) {
      controller.abort();
      this.activeUploads.delete(uploadId);
    }

    const upload = this.uploads.get(uploadId);
    if (upload) {
      this.uploads.set(uploadId, {
        ...upload,
        uploadStatus: 'failed',
        validationErrors: ['Upload cancelled by user'],
      });
    }
  }

  // Delete upload
  deleteUpload(uploadId: string): void {
    this.uploads.delete(uploadId);
    const controller = this.activeUploads.get(uploadId);
    if (controller) {
      controller.abort();
      this.activeUploads.delete(uploadId);
    }
  }

  // Clear all uploads
  clearAllUploads(): void {
    // Cancel all active uploads
    this.activeUploads.forEach(controller => controller.abort());
    this.activeUploads.clear();
    this.uploads.clear();
  }

  // Retry upload
  async retryUpload(uploadId: string, onProgress: (progress: number) => void): Promise<FileUpload> {
    const upload = this.uploads.get(uploadId);
    if (!upload) {
      throw new Error('Upload not found');
    }

    // Reset upload status
    const resetUpload: FileUpload = {
      ...upload,
      uploadStatus: 'processing',
      validationStatus: 'pending',
      uploadProgress: 0,
      validationErrors: undefined,
      validationWarnings: undefined,
    };

    this.uploads.set(uploadId, resetUpload);

    // Create a mock file for retry (in real implementation, you'd store the original file)
    const mockFile = new File([''], upload.originalName, { type: upload.mimeType });
    
    return this.uploadFile(mockFile, onProgress);
  }
}

export const useFileUpload = (): UseFileUploadReturn => {
  const [uploads, setUploads] = useState<FileUpload[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const fileUploadService = FileUploadService.getInstance();

  // Refresh uploads from service
  const refreshUploads = useCallback(() => {
    setUploads(fileUploadService.getAllUploads());
  }, []);

  // Upload files
  const uploadFiles = useCallback(async (files: File[]): Promise<void> => {
    if (files.length === 0) return;

    setUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      const uploadPromises = files.map(async (file, index) => {
        const fileProgress = (index / files.length) * 100;
        
        return fileUploadService.uploadFile(file, (progress) => {
          const totalProgress = fileProgress + (progress / files.length);
          setUploadProgress(Math.round(totalProgress));
        });
      });

      await Promise.all(uploadPromises);
      setUploadProgress(100);
      refreshUploads();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      refreshUploads();
    } finally {
      setUploading(false);
      // Reset progress after a delay
      setTimeout(() => setUploadProgress(0), 2000);
    }
  }, [refreshUploads]);

  // Cancel upload
  const cancelUpload = useCallback(async (uploadId: string): Promise<void> => {
    try {
      fileUploadService.cancelUpload(uploadId);
      refreshUploads();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cancel failed');
    }
  }, [refreshUploads]);

  // Retry upload
  const retryUpload = useCallback(async (uploadId: string): Promise<void> => {
    setUploading(true);
    setError(null);

    try {
      await fileUploadService.retryUpload(uploadId, (progress) => {
        setUploadProgress(progress);
      });
      refreshUploads();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Retry failed');
      refreshUploads();
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 2000);
    }
  }, [refreshUploads]);

  // Delete upload
  const deleteUpload = useCallback(async (uploadId: string): Promise<void> => {
    try {
      fileUploadService.deleteUpload(uploadId);
      refreshUploads();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }, [refreshUploads]);

  // Clear all uploads
  const clearUploads = useCallback((): void => {
    fileUploadService.clearAllUploads();
    refreshUploads();
    setError(null);
    setUploadProgress(0);
  }, [refreshUploads]);

  // Initialize uploads on mount
  useEffect(() => {
    refreshUploads();
  }, [refreshUploads]);

  // Auto-refresh uploads every 5 seconds when uploading
  useEffect(() => {
    if (uploading) {
      const interval = setInterval(refreshUploads, 1000);
      return () => clearInterval(interval);
    }
  }, [uploading, refreshUploads]);

  return {
    uploads,
    uploading,
    uploadProgress,
    error,
    uploadFiles,
    cancelUpload,
    retryUpload,
    deleteUpload,
    clearUploads,
  };
};
