import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

export function useFiles() {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.listFiles();
      setFiles(data);
    } catch (err) {
      console.error('Failed to load files', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { files, loading, refresh };
}

/**
 * Run diagnosis and track progress via WebSocket events,
 * falling back to polling if WebSocket is unavailable.
 */
export function useDiagnosis(fileId: string | null) {
  const [diagnosis, setDiagnosis] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');

  const run = useCallback(async () => {
    if (!fileId) return;
    setLoading(true);
    setProgress(0);
    setMessage('开始诊断...');
    try {
      await api.diagnose(fileId);
      // Start polling for results
      const poll = setInterval(async () => {
        try {
          const data = await api.getDiagnosis(fileId);
          if (data.report) {
            setDiagnosis(data);
            setProgress(100);
            setMessage('诊断完成');
            setLoading(false);
            clearInterval(poll);
          }
        } catch {
          // Still processing
        }
      }, 1500);
      // Timeout after 120s
      setTimeout(() => { clearInterval(poll); setLoading(false); }, 120000);
    } catch (err) {
      console.error('Diagnosis failed', err);
      setLoading(false);
    }
  }, [fileId]);

  // Update progress from WebSocket events
  const updateProgress = useCallback((event: any) => {
    if (event.stage === 'diagnose') {
      if (event.data.progress !== undefined) {
        setProgress(Math.round(event.data.progress * 100));
      }
      if (event.data.message) {
        setMessage(event.data.message);
      }
      if (event.type === 'complete') {
        setLoading(false);
        setProgress(100);
        setMessage('诊断完成');
        // Fetch the actual diagnosis data
        if (fileId) {
          api.getDiagnosis(fileId).then(d => setDiagnosis(d)).catch(() => {});
        }
      }
      if (event.type === 'error') {
        setLoading(false);
        setMessage(event.data.error || '诊断失败');
      }
    }
  }, [fileId]);

  return { diagnosis, loading, progress, message, run, updateProgress };
}

export function usePlan(fileId: string | null) {
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const generate = useCallback(async () => {
    if (!fileId) return;
    setLoading(true);
    try {
      const data = await api.generatePlan(fileId);
      setPlan(data);
    } catch (err) {
      console.error('Generate plan failed', err);
    } finally {
      setLoading(false);
    }
  }, [fileId]);

  const fetch = useCallback(async () => {
    if (!fileId) return;
    try {
      const data = await api.getPlan(fileId);
      setPlan(data);
    } catch { /* ignore */ }
  }, [fileId]);

  return { plan, loading, generate, fetch };
}

export function useCleaning(fileId: string | null) {
  const [result, setResult] = useState<any>(null);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const execute = useCallback(async () => {
    if (!fileId) return;
    setLoading(true);
    setProgress(0);
    setMessage('开始清洗...');
    try {
      await api.executeClean(fileId);
      // Poll for completion
      const poll = setInterval(async () => {
        try {
          const data = await api.previewResult(fileId);
          if (data.stats && data.stats.resultRowCount !== undefined) {
            setResult(data);
            setProgress(100);
            setMessage('清洗完成');
            setLoading(false);
            clearInterval(poll);
          }
        } catch {
          setProgress(p => Math.min(p + 10, 90));
        }
      }, 2000);
      setTimeout(() => { clearInterval(poll); setLoading(false); }, 120000);
    } catch (err) {
      console.error('Cleaning failed', err);
      setLoading(false);
    }
  }, [fileId]);

  // Update progress from WebSocket events
  const updateProgress = useCallback((event: any) => {
    if (event.stage === 'clean') {
      if (event.data.progress !== undefined) {
        setProgress(Math.round(event.data.progress * 100));
      }
      if (event.data.message) {
        setMessage(event.data.message);
      }
      if (event.type === 'complete') {
        setLoading(false);
        setProgress(100);
        setMessage('清洗完成');
        if (fileId) {
          api.previewResult(fileId).then(r => setResult(r)).catch(() => {});
        }
      }
      if (event.type === 'error') {
        setLoading(false);
        setMessage(event.data.error || '清洗失败');
      }
    }
  }, [fileId]);

  return { result, progress, message, loading, execute, updateProgress };
}