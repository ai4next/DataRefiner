const API_BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('token');
}

async function request(path: string, options: RequestInit = {}): Promise<any> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }

  return res.json();
}

export const api = {
  // Auth
  login: (phone: string, code: string) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ phone, code }) }),

  getMe: () => request('/auth/me'),

  // Files
  uploadFile: async (file: File, onProgress?: (pct: number) => void): Promise<any> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE}/files/upload`);
      const token = getToken();
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          try { reject(new Error(JSON.parse(xhr.responseText).error)); }
          catch { reject(new Error('Upload failed')); }
        }
      };
      xhr.onerror = () => reject(new Error('Network error'));

      const fd = new FormData();
      fd.append('file', file);
      xhr.send(fd);
    });
  },

  listFiles: () => request('/files'),

  getFile: (id: string) => request(`/files/${id}`),

  previewFile: (id: string) => request(`/files/${id}/preview`),

  deleteFile: (id: string) => request(`/files/${id}`, { method: 'DELETE' }),

  // Diagnosis
  diagnose: (fileId: string) =>
    request(`/files/${fileId}/diagnose`, { method: 'POST' }),

  getDiagnosis: (fileId: string) =>
    request(`/files/${fileId}/diagnosis`),

  // Cleaning Plan
  getPlan: (fileId: string) => request(`/files/${fileId}/plan`),
  generatePlan: (fileId: string) =>
    request(`/files/${fileId}/plan/generate`, { method: 'POST' }),

  updatePlan: (fileId: string, actions: any[]) =>
    request(`/files/${fileId}/plan`, { method: 'PUT', body: JSON.stringify({ actions }) }),

  executeClean: (fileId: string) =>
    request(`/files/${fileId}/clean`, { method: 'POST' }),

  // Results
  previewResult: (fileId: string) =>
    request(`/files/${fileId}/result/preview`),

  getDownloadUrl: (fileId: string, format: string = 'xlsx') =>
    `${API_BASE}/files/${fileId}/result/download?format=${format}`,

  downloadReportUrl: (fileId: string) =>
    `${API_BASE}/files/${fileId}/result/report`,

  // Templates
  listTemplates: () => request('/templates'),
  saveTemplate: (name: string, templateJson: string, sourceColumns?: string) =>
    request('/templates', { method: 'POST', body: JSON.stringify({ name, templateJson, sourceColumns }) }),
  deleteTemplate: (id: string) =>
    request(`/templates/${id}`, { method: 'DELETE' }),

  // Billing
  getUsage: () => request('/billing/usage'),
  getBillingRecords: () => request('/billing/records'),
};