import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import '../../styles/Forms.css';
import '../../styles/Cleaning.css';

interface Props {
  fileInfo: any;
  plan: any;
  loading: boolean;
  onConfirm: () => void;
  onBack: () => void;
}

export default function CleaningStep({ fileInfo, plan, loading, onConfirm, onBack }: Props) {
  const { t } = useTranslation();
  const [actions, setActions] = useState<any[]>([]);

  useEffect(() => {
    if (plan?.plan?.actions) {
      setActions(plan.plan.actions.map((a: any) => ({ ...a })));
    }
  }, [plan]);

  const toggleAction = (index: number) => {
    setActions(prev => prev.map((a, i) => i === index ? { ...a, enabled: !a.enabled } : a));
  };

  const updateParam = (index: number, key: string, value: string) => {
    setActions(prev => prev.map((a, i) => i === index ? { ...a, params: { ...a.params, [key]: value } } : a));
  };

  const confirmedCount = actions.filter(a => a.enabled).length;
  const totalImpact = actions.filter(a => a.enabled).reduce((sum, a) => sum + (a.estimatedImpactRows || 0), 0);

  const handleSaveTemplate = async () => {
    const name = prompt('模板名称:');
    if (!name) return;
    try {
      await api.saveTemplate(name, JSON.stringify({ actions }));
      alert('模板保存成功');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleConfirm = async () => {
    if (!fileInfo) return;
    try {
      await api.updatePlan(fileInfo.id, actions);
      onConfirm();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner"></div>
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="empty-state">
        <p>正在生成AI清洗方案...</p>
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="cleaning-step">
      <h3>{t('cleaning.aiSuggest')} {actions.length} {t('cleaning.actions')}</h3>

      <div className="actions-list">
        {actions.map((action, i) => (
          <div key={i} className={`action-card ${action.enabled ? '' : 'disabled'}`}>
            <div className="action-header">
              <label className="checkbox-label">
                <input type="checkbox" checked={action.enabled} onChange={() => toggleAction(i)} />
                <span className={`action-name ${action.enabled ? '' : 'strikethrough'}`}>{action.name}</span>
              </label>
              <span className="action-confidence">{action.confidence >= 0.8 ? '高' : action.confidence >= 0.5 ? '中' : '低'}</span>
            </div>
            <div className="action-meta">
              <span>影响列: {action.affectedColumns?.join(', ') || t('cleaning.allColumns')}</span>
              <span>影响行数: ~{action.estimatedImpactRows || '所有'}</span>
            </div>
            {action.enabled && action.params && Object.keys(action.params).length > 0 && (
              <div className="action-params">
                {Object.entries(action.params).map(([key, val]) => (
                  <div key={key} className="param-row">
                    <label>{key}:</label>
                    <input
                      type="text"
                      value={String(val ?? '')}
                      onChange={e => updateParam(i, key, e.target.value)}
                      className="param-input"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="plan-summary">
        {t('cleaning.total')} {actions.length} 项操作，{t('cleaning.confirm')} {confirmedCount} 项 | 预计影响 {totalImpact.toLocaleString()} 行
      </div>

      <div className="step-actions">
        <button className="btn-secondary" onClick={handleSaveTemplate}>{t('cleaning.saveTemplate')}</button>
        <div className="step-nav">
          <button className="btn-secondary" onClick={onBack}>{t('common.prev')}</button>
          <button className="btn-primary" onClick={handleConfirm} disabled={confirmedCount === 0 || loading}>
            {loading ? t('common.loading') : t('cleaning.execute')}
          </button>
        </div>
      </div>
    </div>
  );
}