/**
 * Viewer Module - Full-screen media viewer
 */

import { getMediaUrl, updateMemory, deleteMemory } from './api.js';
import { refreshTimeline, getMemoryById } from './timeline.js';

// DOM Elements
let modal;
let closeBtn;
let prevBtn;
let nextBtn;
let imageEl;
let videoEl;
let dateEl;
let captionEl;

// State
let memories = [];
let currentIndex = 0;
let isOpen = false;

/**
 * Initialize viewer module
 */
export function initViewer() {
  modal = document.getElementById('viewer-modal');
  closeBtn = document.getElementById('viewer-close');
  prevBtn = document.getElementById('viewer-prev');
  nextBtn = document.getElementById('viewer-next');
  imageEl = document.getElementById('viewer-image');
  videoEl = document.getElementById('viewer-video');
  dateEl = document.getElementById('viewer-date');
  captionEl = document.getElementById('viewer-caption');

  // Setup event handlers
  if (closeBtn) closeBtn.addEventListener('click', closeViewer);
  if (prevBtn) prevBtn.addEventListener('click', showPrevious);
  if (nextBtn) nextBtn.addEventListener('click', showNext);

  // Close on backdrop click
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeViewer();
      }
    });
  }

  // Keyboard navigation
  document.addEventListener('keydown', handleKeydown);

  // Listen for open-viewer event from timeline
  window.addEventListener('open-viewer', (e) => {
    const { memories: m, index } = e.detail;
    openViewer(m, index);
  });

  // Listen for edit-memory event
  window.addEventListener('edit-memory', (e) => {
    const { id } = e.detail;
    handleEdit(id);
  });

  // Listen for delete-memory event
  window.addEventListener('delete-memory', (e) => {
    const { id } = e.detail;
    handleDelete(id);
  });
}

/**
 * Open the viewer
 */
export function openViewer(memoriesList, index = 0) {
  memories = memoriesList;
  currentIndex = index;
  isOpen = true;

  showMemory(currentIndex);

  if (modal) {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  updateNavigation();
}

/**
 * Close the viewer
 */
export function closeViewer() {
  isOpen = false;

  if (modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  // Stop any playing video
  if (videoEl) {
    videoEl.pause();
    videoEl.src = '';
  }
}

/**
 * Show a specific memory
 */
function showMemory(index) {
  if (index < 0 || index >= memories.length) return;

  const memory = memories[index];
  currentIndex = index;

  const isVideo = memory.mediaType === 'video';
  const mediaUrl = getMediaUrl(memory.mediaPath);

  // Show appropriate media element
  if (isVideo) {
    if (imageEl) imageEl.classList.add('hidden');
    if (videoEl) {
      videoEl.src = mediaUrl;
      videoEl.classList.remove('hidden');
    }
  } else {
    if (videoEl) {
      videoEl.pause();
      videoEl.classList.add('hidden');
    }
    if (imageEl) {
      imageEl.src = mediaUrl;
      imageEl.alt = memory.caption || 'Memory';
      imageEl.classList.remove('hidden');
    }
  }

  // Update info
  if (dateEl) {
    const dateObj = new Date(memory.date);
    dateEl.textContent = dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  if (captionEl) {
    captionEl.textContent = memory.caption || '';
  }

  updateNavigation();
}

/**
 * Show previous memory
 */
function showPrevious() {
  if (currentIndex > 0) {
    showMemory(currentIndex - 1);
  }
}

/**
 * Show next memory
 */
function showNext() {
  if (currentIndex < memories.length - 1) {
    showMemory(currentIndex + 1);
  }
}

/**
 * Update navigation buttons
 */
function updateNavigation() {
  if (prevBtn) {
    prevBtn.classList.toggle('hidden', currentIndex === 0);
  }
  if (nextBtn) {
    nextBtn.classList.toggle('hidden', currentIndex >= memories.length - 1);
  }
}

/**
 * Handle keyboard navigation
 */
function handleKeydown(event) {
  if (!isOpen) return;

  switch (event.key) {
    case 'Escape':
      closeViewer();
      break;
    case 'ArrowLeft':
      showPrevious();
      break;
    case 'ArrowRight':
      showNext();
      break;
  }
}

/**
 * Handle edit memory
 */
async function handleEdit(id) {
  const memory = getMemoryById(id);
  if (!memory) return;

  // Create edit form
  const caption = prompt('Edit caption:', memory.caption || '');
  if (caption === null) return; // Cancelled

  const date = prompt('Edit date (YYYY-MM-DD):', memory.date);
  if (date === null) return; // Cancelled

  // Validate date format
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    alert('Invalid date format. Please use YYYY-MM-DD.');
    return;
  }

  try {
    await updateMemory(id, {
      caption: caption || '',
      date: date || memory.date
    });

    // Timeline will refresh via SSE
  } catch (error) {
    console.error('Failed to update memory:', error);
    alert('Failed to update memory. Please try again.');
  }
}

/**
 * Handle delete memory
 */
async function handleDelete(id) {
  const confirmed = confirm('Are you sure you want to delete this memory? This cannot be undone.');
  if (!confirmed) return;

  try {
    await deleteMemory(id);

    // Close viewer if currently viewing deleted memory
    if (isOpen && memories[currentIndex]?.id === id) {
      closeViewer();
    }

    // Timeline will refresh via SSE
  } catch (error) {
    console.error('Failed to delete memory:', error);
    alert('Failed to delete memory. Please try again.');
  }
}
