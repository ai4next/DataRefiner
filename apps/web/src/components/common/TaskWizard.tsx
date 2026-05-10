import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import UploadStep from '../upload/UploadStep.js';
import DiagnosisStep from '../diagnosis/DiagnosisStep.js';
import CleaningStep from '../cleaning/CleaningStep.js';
import ResultStep from '../result/ResultStep.js';
import { api } from '../../lib/api';
import { useWebSocket } from '../../hooks/useWebSocket';
import '../../styles/TaskWizard.css';

const STEPS = ['upload', 'diagnosis', 'plan', 'result'];

export default function TaskWizard() {
  const { t } = useTranslation();
  const { fileId: paramFileId } = useParams();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [fileInfo, setFileInfo] = useState<any>(null);
  const [diagnosis, setDiagnosis] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [diagnosisError, setDiagnosisError] = useState('');

  // WebSocket event handler
  const handleWsEvent = useCallback((event: any) => {
    if (event.stage === 'diagnose') {
      if (event.data.progress !== undefined) {
        setProgress(Math.round(event.data.progress * 100));
      }
      if (event.data.message) setStatusMessage(event.data.message);
      if (event.type === 'complete') {
        setLoading(false);
        setProgress(100);
        const fid = fileInfo?.id || paramFileId;
        if (fid) {
          api.getDiagnosis(fid).then(d => {
            setDiagnosis(d);
            setStep(1);
          }).catch(() => {});
        }
      }
      if (event.type === 'error') {
        setLoading(false);
        setStatusMessage(event.data.error || '诊断失败');
        setDiagnosisError(event.data.error || '诊断失败，请重试');
      }
    }
    if (event.stage === 'clean') {
      if (event.data.progress !== undefined) {
        setProgress(Math.round(event.data.progress * 100));
      }
      if (event.data.message) setStatusMessage(event.data.message);
      if (event.type === 'complete') {
        setLoading(false);
        setProgress(100);
        const fid = fileInfo?.id || paramFileId;
        if (fid) {
          api.previewResult(fid).then(r => {
            setResult(r);
            setStep(3);
          }).catch(() => {});
        }
      }
      if (event.type === 'error') {
        setLoading(false);
        setStatusMessage(event.data.error || '清洗失败');
      }
    }
  }, [fileInfo, paramFileId]);

  const sessionId = fileInfo?.id || paramFileId || null;
  useWebSocket(sessionId, handleWsEvent);

  useEffect(() => {
    if (paramFileId) {
      api.getFile(paramFileId).then(f => {
        setFileInfo(f);
        const statusOrder = ['uploaded', 'diagnosing', 'diagnosed', 'planning', 'cleaning', 'completed'];
        const stepIndex = Math.max(0, statusOrder.indexOf(f.status) - 1);
        setStep(Math.min(stepIndex, 3));

        if (f.status === 'diagnosed' || f.status === 'completed') {
          api.getDiagnosis(paramFileId).then(d => setDiagnosis(d)).catch(() => {});
        }
        if (f.status === 'diagnosed' || f.status === 'completed') {
          api.getPlan(paramFileId).then(p => setPlan(p)).catch(() => {});
        }
        if (f.status === 'completed') {
          api.previewResult(paramFileId).then(r => setResult(r)).catch(() => {});
        }
      }).catch(() => navigate('/dashboard'));
    }
  }, [paramFileId]);

  const handleUploadDone = (info: any) => {
    setFileInfo(info);
    setLoading(true);
    setProgress(10);
    setStatusMessage('开始诊断...');
    api.diagnose(info.id).catch(() => setLoading(false));
  };

  const handleDiagnosisDone = async () => {
    if (!fileInfo) return;
    setLoading(true);
    setProgress(0);
    setStatusMessage('生成清洗方案...');
    try {
      const p = await api.generatePlan(fileInfo.id);
      setPlan(p);
      setStep(2);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePlanConfirmed = async () => {
    if (!fileInfo || !plan) return;
    setLoading(true);
    setProgress(10);
    setStatusMessage('开始清洗...');
    try {
      await api.executeClean(fileInfo.id);
    } catch (err: any) {
      alert(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="task-wizard">
      <header className="wizard-header">
        <Link to="/dashboard" className="btn-text">← {t('nav.dashboard')}</Link>
      </header>

      <div className="wizard-steps">
        {STEPS.map((s, i) => (
          <div key={s} className={`step-item ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}>
            <span className="step-num">{i < step ? '✓' : i + 1}</span>
            <span className="step-label">{t(`steps.${s}`)}</span>
          </div>
        ))}
      </div>

      {loading && statusMessage && (
        <div className="wizard-status">
          <div className="wizard-progress-bar">
            <div className="wizard-progress-fill" style={{ width: `${Math.min(progress, 95)}%` }}></div>
          </div>
          <p className="wizard-status-text">{statusMessage}</p>
        </div>
      )}

      <div className="wizard-body">
        {step === 0 && !paramFileId && <UploadStep onDone={handleUploadDone} />}
        {step === 1 && (
          <DiagnosisStep
            fileInfo={fileInfo}
            diagnosis={diagnosis}
            loading={loading}
            error={diagnosisError}
            onNext={handleDiagnosisDone}
            onBack={() => { setStep(0); setDiagnosis(null); setDiagnosisError(''); }}
          />
        )}
        {step === 2 && (
          <CleaningStep
            fileInfo={fileInfo}
            plan={plan}
            loading={loading}
            onConfirm={handlePlanConfirmed}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <ResultStep
            fileInfo={fileInfo}
            result={result}
            loading={loading}
            onReset={() => { setStep(1); setResult(null); }}
          />
        )}
        {step === 0 && paramFileId && (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>{t('common.loading')}</p>
          </div>
        )}
      </div>
    </div>
  );
}