/**
 * Timeline Module - Renders and manages the memory timeline
 */

import { getTimeline, getMediaUrl, onEvent, connectSSE } from './api.js';

// State
let memories = [];
let config = {};
let stats = {};
let currentOrder = 'newest-first';

// DOM elements
let timelineEl;
let heroTitleEl;
let heroSubtitleEl;
let daysTogether;
let daysTogetherStat;
let memoryCountEl;
let emptyStateEl;

// Intersection Observer for lazy loading
let lazyObserver;

/**
 * Initialize the timeline
 */
export async function initTimeline() {
  // Get DOM elements
  timelineEl = document.getElementById('timeline');
  heroTitleEl = document.getElementById('hero-title');
  heroSubtitleEl = document.getElementById('hero-subtitle');
  daysTogether = document.getElementById('days-together');
  daysTogetherStat = document.getElementById('days-together-stat');
  memoryCountEl = document.getElementById('memory-count');
  emptyStateEl = document.getElementById('empty-state');

  // Setup lazy loading
  setupLazyLoading();

  // Setup scroll-linked background
  setupScrollBackground();

  // Setup SSE for real-time updates
  setupRealTimeUpdates();

  // Load initial data
  await refreshTimeline();
}

/**
 * Refresh timeline data from API
 */
export async function refreshTimeline() {
  try {
    const data = await getTimeline({ order: currentOrder });
    memories = data.memories;
    config = data.config;
    stats = data.stats;

    updateHero();
    renderMemories();
    updateEmptyState();
  } catch (error) {
    console.error('Failed to load timeline:', error);
  }
}

/**
 * Update hero section with config and stats
 */
function updateHero() {
  if (heroTitleEl) {
    heroTitleEl.textContent = config.title || 'Our Story';
  }

  if (heroSubtitleEl) {
    if (config.subtitle) {
      heroSubtitleEl.textContent = config.subtitle;
      heroSubtitleEl.classList.remove('hidden');
    } else {
      heroSubtitleEl.classList.add('hidden');
    }
  }

  if (daysTogether && daysTogetherStat) {
    if (stats.daysTogether !== null) {
      daysTogether.textContent = stats.daysTogether.toLocaleString();
      daysTogetherStat.classList.remove('hidden');
    } else {
      daysTogetherStat.classList.add('hidden');
    }
  }

  if (memoryCountEl) {
    memoryCountEl.textContent = stats.totalMemories.toLocaleString();
  }
}

/**
 * Render memories to the timeline
 */
function renderMemories() {
  if (!timelineEl) return;

  timelineEl.innerHTML = '';

  memories.forEach((memory, index) => {
    const card = createMemoryCard(memory, index);
    timelineEl.appendChild(card);
  });

  // Observe all lazy elements
  document.querySelectorAll('[data-lazy]').forEach(el => {
    lazyObserver.observe(el);
  });
}

/**
 * Create a memory card element
 */
function createMemoryCard(memory, index) {
  const card = document.createElement('article');
  card.className = 'memory-card';
  card.dataset.id = memory.id;
  card.dataset.index = index;

  const isVideo = memory.mediaType === 'video';
  const mediaUrl = getMediaUrl(memory.mediaPath);

  // Format date
  const dateObj = new Date(memory.date);
  const formattedDate = dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  card.innerHTML = `
    <div class="memory-media" data-lazy data-src="${mediaUrl}" data-type="${memory.mediaType}">
      ${isVideo ? `
        <div class="video-placeholder">
          <span class="play-icon">▶</span>
        </div>
      ` : `
        <div class="image-placeholder skeleton skeleton-image"></div>
      `}
    </div>
    <div class="memory-content">
      <time class="memory-date" datetime="${memory.date}">${formattedDate}</time>
      ${memory.caption ? `<p class="memory-caption">${escapeHtml(memory.caption)}</p>` : ''}
    </div>
    <div class="memory-actions">
      <button class="btn-icon memory-edit" title="Edit" data-action="edit">✎</button>
      <button class="btn-icon memory-delete" title="Delete" data-action="delete">×</button>
    </div>
  `;

  // Click handler for viewing media
  const mediaEl = card.querySelector('.memory-media');
  mediaEl.addEventListener('click', () => openViewer(index));

  // Edit/Delete handlers
  card.querySelector('[data-action="edit"]').addEventListener('click', (e) => {
    e.stopPropagation();
    startEdit(memory.id);
  });

  card.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
    e.stopPropagation();
    confirmDelete(memory.id);
  });

  return card;
}

/**
 * Setup Intersection Observer for lazy loading
 */
function setupLazyLoading() {
  lazyObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        loadMedia(entry.target);
        lazyObserver.unobserve(entry.target);
      }
    });
  }, {
    rootMargin: '200px 0px', // Load 200px before entering viewport
    threshold: 0.01
  });
}

/**
 * Load media into a lazy element
 */
function loadMedia(element) {
  const src = element.dataset.src;
  const type = element.dataset.type;

  if (type === 'video') {
    const video = document.createElement('video');
    video.src = src;
    video.preload = 'metadata';
    video.poster = ''; // Could add thumbnail generation
    video.className = 'memory-video';

    // Replace placeholder
    element.innerHTML = '';
    element.appendChild(video);

    // Add play icon overlay
    const overlay = document.createElement('div');
    overlay.className = 'video-overlay';
    overlay.innerHTML = '<span class="play-icon">▶</span>';
    element.appendChild(overlay);
  } else {
    const img = document.createElement('img');
    img.src = src;
    img.alt = 'Memory';
    img.className = 'memory-image';
    img.loading = 'lazy';

    img.onload = () => {
      element.innerHTML = '';
      element.appendChild(img);
    };

    img.onerror = () => {
      element.innerHTML = '<div class="media-error">Could not load image</div>';
    };
  }

  delete element.dataset.lazy;
}

/**
 * Update empty state visibility
 */
function updateEmptyState() {
  if (!emptyStateEl || !timelineEl) return;

  if (memories.length === 0) {
    emptyStateEl.classList.remove('hidden');
    timelineEl.classList.add('hidden');
  } else {
    emptyStateEl.classList.add('hidden');
    timelineEl.classList.remove('hidden');
  }
}

/**
 * Setup scroll-linked background transitions
 */
function setupScrollBackground() {
  const background = document.getElementById('background');
  if (!background) return;

  // Check for reduced motion preference
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  let ticking = false;

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        updateBackground(background);
        ticking = false;
      });
      ticking = true;
    }
  });

  // Initial update
  updateBackground(background);
}

/**
 * Update background based on scroll position
 */
function updateBackground(background) {
  const scrollY = window.scrollY;
  const windowHeight = window.innerHeight;
  const docHeight = document.documentElement.scrollHeight;

  // Calculate scroll progress (0 to 1)
  const progress = Math.min(scrollY / (docHeight - windowHeight), 1);

  // Update CSS variables for animations
  document.documentElement.style.setProperty('--scroll-progress', progress);

  // Update background gradient based on progress
  const hue1 = 240 + (progress * 60); // Blue to purple
  const hue2 = 280 + (progress * 40); // Purple to pink

  background.style.background = `
    linear-gradient(
      ${135 + progress * 45}deg,
      hsl(${hue1}, 50%, 10%) 0%,
      hsl(${hue2}, 40%, 15%) 50%,
      hsl(${hue1 + 20}, 45%, 12%) 100%
    )
  `;
}

/**
 * Setup SSE for real-time updates
 */
function setupRealTimeUpdates() {
  connectSSE();

  onEvent('memory:created', (memory) => {
    console.log('Memory created:', memory);
    refreshTimeline();
  });

  onEvent('memory:updated', (memory) => {
    console.log('Memory updated:', memory);
    refreshTimeline();
  });

  onEvent('memory:deleted', ({ id }) => {
    console.log('Memory deleted:', id);
    refreshTimeline();
  });
}

/**
 * Open the viewer modal at a specific index
 */
function openViewer(index) {
  // Dispatch custom event for viewer module to handle
  window.dispatchEvent(new CustomEvent('open-viewer', {
    detail: { memories, index }
  }));
}

/**
 * Start editing a memory
 */
function startEdit(id) {
  window.dispatchEvent(new CustomEvent('edit-memory', { detail: { id } }));
}

/**
 * Confirm deletion of a memory
 */
function confirmDelete(id) {
  window.dispatchEvent(new CustomEvent('delete-memory', { detail: { id } }));
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Get current memories
 */
export function getMemories() {
  return memories;
}

/**
 * Get a memory by ID
 */
export function getMemoryById(id) {
  return memories.find(m => m.id === id);
}
