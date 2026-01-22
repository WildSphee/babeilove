/**
 * Main Application Entry Point
 */

import { getAuthStatus, logout } from './api.js';
import { initTimeline, refreshTimeline } from './timeline.js';
import { initAuth, showLoginPage } from './auth.js';
import { initUpload, showUploadPage, hideUploadPage } from './upload.js';
import { initViewer } from './viewer.js';

// DOM Elements
const loginPage = document.getElementById('login-page');
const timelinePage = document.getElementById('timeline-page');
const uploadPage = document.getElementById('upload-page');

// Navigation buttons
const navUpload = document.getElementById('nav-upload');
const navLogout = document.getElementById('nav-logout');
const uploadBack = document.getElementById('upload-back');
const addFirstMemory = document.getElementById('add-first-memory');

/**
 * Initialize the application
 */
async function init() {
  // Initialize modules
  initAuth(onLoginSuccess);
  initUpload(onUploadSuccess);
  initViewer();

  // Setup navigation
  setupNavigation();

  // Check authentication status
  await checkAuth();
}

/**
 * Check if user is authenticated
 */
async function checkAuth() {
  try {
    const status = await getAuthStatus();

    if (status.authenticated) {
      await showTimelinePage();
    } else {
      showLoginPage();
    }
  } catch (error) {
    console.error('Auth check failed:', error);
    showLoginPage();
  }
}

/**
 * Setup navigation event handlers
 */
function setupNavigation() {
  // Upload button
  if (navUpload) {
    navUpload.addEventListener('click', () => {
      showUploadPage();
    });
  }

  // Logout button
  if (navLogout) {
    navLogout.addEventListener('click', handleLogout);
  }

  // Upload back button
  if (uploadBack) {
    uploadBack.addEventListener('click', () => {
      hideUploadPage();
    });
  }

  // Add first memory button (empty state)
  if (addFirstMemory) {
    addFirstMemory.addEventListener('click', () => {
      showUploadPage();
    });
  }
}

/**
 * Show the timeline page
 */
async function showTimelinePage() {
  hidePage(loginPage);
  hidePage(uploadPage);
  showPage(timelinePage);

  // Initialize timeline on first show
  await initTimeline();
}

/**
 * Handle successful login
 */
async function onLoginSuccess() {
  await showTimelinePage();
}

/**
 * Handle successful upload
 */
function onUploadSuccess() {
  hideUploadPage();
  // Timeline will auto-refresh via SSE
}

/**
 * Handle logout
 */
async function handleLogout() {
  try {
    await logout();
    hidePage(timelinePage);
    hidePage(uploadPage);
    showLoginPage();
  } catch (error) {
    console.error('Logout failed:', error);
  }
}

/**
 * Show a page element
 */
function showPage(page) {
  if (page) {
    page.classList.remove('hidden');
  }
}

/**
 * Hide a page element
 */
function hidePage(page) {
  if (page) {
    page.classList.add('hidden');
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
