/**
 * Upload Module - Handles memory upload functionality
 */

import { createMemory } from './api.js';

// DOM Elements
let uploadPage;
let uploadForm;
let fileInput;
let dateInput;
let captionInput;
let previewEl;
let progressEl;
let progressFill;
let progressText;
let uploadError;

// State
let selectedFile = null;
let onSuccess;

/**
 * Initialize upload module
 */
export function initUpload(onUploadSuccess) {
  onSuccess = onUploadSuccess;

  uploadPage = document.getElementById('upload-page');
  uploadForm = document.getElementById('upload-form');
  fileInput = document.getElementById('upload-file');
  dateInput = document.getElementById('upload-date');
  captionInput = document.getElementById('upload-caption');
  previewEl = document.getElementById('upload-preview');
  progressEl = document.getElementById('upload-progress');
  progressFill = document.getElementById('progress-fill');
  progressText = document.getElementById('progress-text');
  uploadError = document.getElementById('upload-error');

  // Setup event handlers
  if (fileInput) {
    fileInput.addEventListener('change', handleFileSelect);
  }

  if (uploadForm) {
    uploadForm.addEventListener('submit', handleSubmit);
  }

  // Setup drag and drop
  if (previewEl) {
    setupDragDrop();
  }

  // Set default date to today
  if (dateInput) {
    dateInput.value = new Date().toISOString().split('T')[0];
    dateInput.max = new Date().toISOString().split('T')[0]; // No future dates
  }
}

/**
 * Show upload page
 */
export function showUploadPage() {
  if (uploadPage) {
    uploadPage.classList.remove('hidden');
    document.getElementById('timeline-page')?.classList.add('hidden');
  }
  resetForm();
}

/**
 * Hide upload page
 */
export function hideUploadPage() {
  if (uploadPage) {
    uploadPage.classList.add('hidden');
    document.getElementById('timeline-page')?.classList.remove('hidden');
  }
  resetForm();
}

/**
 * Handle file selection
 */
function handleFileSelect(event) {
  const file = event.target.files?.[0];
  if (file) {
    selectFile(file);
  }
}

/**
 * Select and preview a file
 */
function selectFile(file) {
  // Validate file type
  const validTypes = ['image/jpeg', 'image/png', 'video/mp4', 'video/quicktime'];
  if (!validTypes.includes(file.type)) {
    showError('Please select a JPEG, PNG, MP4, or MOV file');
    return;
  }

  // Validate file size (100MB)
  const maxSize = 100 * 1024 * 1024;
  if (file.size > maxSize) {
    showError('File size must be less than 100MB');
    return;
  }

  selectedFile = file;
  clearError();
  showPreview(file);
}

/**
 * Show file preview
 */
function showPreview(file) {
  if (!previewEl) return;

  const isVideo = file.type.startsWith('video/');

  if (isVideo) {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.controls = false;
    video.muted = true;
    video.loop = true;
    video.autoplay = true;

    previewEl.innerHTML = '';
    previewEl.appendChild(video);
  } else {
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.alt = 'Preview';

    previewEl.innerHTML = '';
    previewEl.appendChild(img);
  }
}

/**
 * Setup drag and drop
 */
function setupDragDrop() {
  previewEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    previewEl.classList.add('drag-over');
  });

  previewEl.addEventListener('dragleave', () => {
    previewEl.classList.remove('drag-over');
  });

  previewEl.addEventListener('drop', (e) => {
    e.preventDefault();
    previewEl.classList.remove('drag-over');

    const file = e.dataTransfer?.files?.[0];
    if (file) {
      selectFile(file);
      // Update file input
      const dt = new DataTransfer();
      dt.items.add(file);
      fileInput.files = dt.files;
    }
  });
}

/**
 * Handle form submission
 */
async function handleSubmit(event) {
  event.preventDefault();

  if (!selectedFile) {
    showError('Please select a photo or video');
    return;
  }

  const date = dateInput?.value;
  const caption = captionInput?.value?.trim() || '';

  if (!date) {
    showError('Please select a date');
    return;
  }

  // Disable form and show progress
  setFormDisabled(true);
  showProgress();
  clearError();

  try {
    await createMemory(selectedFile, date, caption);

    // Success - call callback
    if (onSuccess) {
      onSuccess();
    }
  } catch (error) {
    console.error('Upload failed:', error);

    if (error.status === 400) {
      showError(error.data?.message || 'Invalid file or data');
    } else if (error.status === 401) {
      showError('Session expired. Please log in again.');
    } else {
      showError('Upload failed. Please try again.');
    }
  } finally {
    setFormDisabled(false);
    hideProgress();
  }
}

/**
 * Reset form to initial state
 */
function resetForm() {
  selectedFile = null;

  if (fileInput) fileInput.value = '';
  if (captionInput) captionInput.value = '';
  if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

  if (previewEl) {
    previewEl.innerHTML = '<span>Click or drag to add photo/video</span>';
  }

  clearError();
  hideProgress();
  setFormDisabled(false);
}

/**
 * Show error message
 */
function showError(message) {
  if (uploadError) {
    uploadError.textContent = message;
    uploadError.classList.remove('hidden');
  }
}

/**
 * Clear error message
 */
function clearError() {
  if (uploadError) {
    uploadError.textContent = '';
    uploadError.classList.add('hidden');
  }
}

/**
 * Show upload progress
 */
function showProgress() {
  if (progressEl) {
    progressEl.classList.remove('hidden');
    if (progressFill) progressFill.style.width = '0%';
    if (progressText) progressText.textContent = 'Uploading...';
  }

  // Simulate progress (actual progress tracking would require XHR)
  let progress = 0;
  const interval = setInterval(() => {
    progress += Math.random() * 20;
    if (progress >= 90) {
      clearInterval(interval);
      progress = 90;
    }
    if (progressFill) progressFill.style.width = `${progress}%`;
  }, 200);

  // Store interval ID to clear later
  if (progressEl) progressEl.dataset.interval = interval;
}

/**
 * Hide upload progress
 */
function hideProgress() {
  if (progressEl) {
    progressEl.classList.add('hidden');

    const interval = progressEl.dataset.interval;
    if (interval) {
      clearInterval(parseInt(interval, 10));
      delete progressEl.dataset.interval;
    }

    if (progressFill) progressFill.style.width = '100%';
  }
}

/**
 * Enable/disable form
 */
function setFormDisabled(disabled) {
  if (fileInput) fileInput.disabled = disabled;
  if (dateInput) dateInput.disabled = disabled;
  if (captionInput) captionInput.disabled = disabled;

  const submitBtn = uploadForm?.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = disabled;
}
