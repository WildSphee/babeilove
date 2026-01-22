/**
 * API Client for Couple's Diary Backend
 */

const API_BASE = '/api';

/**
 * Make an API request
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;

  const config = {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  };

  // Don't set Content-Type for FormData (let browser set it with boundary)
  if (options.body instanceof FormData) {
    delete config.headers['Content-Type'];
  }

  const response = await fetch(url, config);

  // Handle non-JSON responses
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response;
  }

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.message || 'API request failed');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

// ============ Auth API ============

export async function login(username, password) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
}

export async function logout() {
  return request('/auth/logout', {
    method: 'POST'
  });
}

export async function getAuthStatus() {
  return request('/auth/status');
}

// ============ Timeline API ============

export async function getTimeline(options = {}) {
  const params = new URLSearchParams();
  if (options.order) params.set('order', options.order);
  if (options.limit) params.set('limit', options.limit);
  if (options.offset) params.set('offset', options.offset);

  const queryString = params.toString();
  const endpoint = `/timeline${queryString ? `?${queryString}` : ''}`;

  return request(endpoint);
}

// ============ Memories API ============

export async function createMemory(file, date, caption) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('date', date);
  if (caption) {
    formData.append('caption', caption);
  }

  return request('/memories', {
    method: 'POST',
    body: formData
  });
}

export async function getMemory(id) {
  return request(`/memories/${id}`);
}

export async function updateMemory(id, updates) {
  return request(`/memories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates)
  });
}

export async function deleteMemory(id) {
  return request(`/memories/${id}`, {
    method: 'DELETE'
  });
}

// ============ Config API ============

export async function getConfig() {
  return request('/config');
}

export async function updateConfig(updates) {
  return request('/config', {
    method: 'PATCH',
    body: JSON.stringify(updates)
  });
}

// ============ Server-Sent Events ============

let eventSource = null;
const eventListeners = new Map();

export function connectSSE() {
  if (eventSource) {
    return eventSource;
  }

  eventSource = new EventSource(`${API_BASE}/events`, {
    withCredentials: true
  });

  eventSource.onopen = () => {
    console.log('SSE connected');
  };

  eventSource.onerror = (err) => {
    console.error('SSE error:', err);
    // Reconnect after 5 seconds
    setTimeout(() => {
      disconnectSSE();
      connectSSE();
    }, 5000);
  };

  // Set up event listeners for each type
  ['memory:created', 'memory:updated', 'memory:deleted'].forEach(eventType => {
    eventSource.addEventListener(eventType, (event) => {
      const data = JSON.parse(event.data);
      const listeners = eventListeners.get(eventType) || [];
      listeners.forEach(callback => callback(data));
    });
  });

  return eventSource;
}

export function disconnectSSE() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
}

export function onEvent(eventType, callback) {
  if (!eventListeners.has(eventType)) {
    eventListeners.set(eventType, []);
  }
  eventListeners.get(eventType).push(callback);

  // Return unsubscribe function
  return () => {
    const listeners = eventListeners.get(eventType);
    const index = listeners.indexOf(callback);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  };
}

// ============ Media URLs ============

export function getMediaUrl(mediaPath) {
  return `/media/${encodeURIComponent(mediaPath)}`;
}
