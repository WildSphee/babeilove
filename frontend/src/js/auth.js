/**
 * Authentication Module
 */

import { login } from './api.js';

// DOM Elements
let loginPage;
let loginForm;
let usernameInput;
let passwordInput;
let loginError;

// Callbacks
let onSuccess;

/**
 * Initialize auth module
 */
export function initAuth(onLoginSuccess) {
  onSuccess = onLoginSuccess;

  loginPage = document.getElementById('login-page');
  loginForm = document.getElementById('login-form');
  usernameInput = document.getElementById('username');
  passwordInput = document.getElementById('password');
  loginError = document.getElementById('login-error');

  if (loginForm) {
    loginForm.addEventListener('submit', handleSubmit);
  }
}

/**
 * Show the login page
 */
export function showLoginPage() {
  if (loginPage) {
    loginPage.classList.remove('hidden');
  }
  clearError();
  clearForm();

  // Focus username input
  if (usernameInput) {
    usernameInput.focus();
  }
}

/**
 * Handle login form submission
 */
async function handleSubmit(event) {
  event.preventDefault();

  const username = usernameInput?.value.trim();
  const password = passwordInput?.value;

  if (!username || !password) {
    showError('Please enter username and password');
    return;
  }

  // Disable form during submission
  setFormDisabled(true);
  clearError();

  try {
    await login(username, password);

    // Clear form and call success callback
    clearForm();
    if (onSuccess) {
      onSuccess();
    }
  } catch (error) {
    console.error('Login failed:', error);

    if (error.status === 401) {
      showError('Invalid username or password');
    } else {
      showError('Login failed. Please try again.');
    }
  } finally {
    setFormDisabled(false);
  }
}

/**
 * Show error message
 */
function showError(message) {
  if (loginError) {
    loginError.textContent = message;
    loginError.classList.remove('hidden');
  }
}

/**
 * Clear error message
 */
function clearError() {
  if (loginError) {
    loginError.textContent = '';
    loginError.classList.add('hidden');
  }
}

/**
 * Clear form inputs
 */
function clearForm() {
  if (usernameInput) usernameInput.value = '';
  if (passwordInput) passwordInput.value = '';
}

/**
 * Enable/disable form inputs
 */
function setFormDisabled(disabled) {
  if (usernameInput) usernameInput.disabled = disabled;
  if (passwordInput) passwordInput.disabled = disabled;

  const submitBtn = loginForm?.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = disabled;
}
