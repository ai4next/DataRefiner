import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../../styles/Forms.css';
import '../../styles/Diagnosis.css';

interface Props {
  fileInfo: any;
  diagnosis: any;
  loading: boolean;
  error?: string;
  onNext: () => void;
  onBack: () => void;
}

export default function DiagnosisStep({ fileInfo, diagnosis, loading, error, onNext, onBack }: Props) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [showIssuesOnly, setShowIssuesOnly] = useState(false);
  const [expandedCol, setExpandedCol] = useState<string | null>(null);

  const report = diagnosis?.report;
  const columns = report?.columns || {};
  const entries = Object.entries(columns) as [string, any][];

  const filtered = entries.filter(([name, col]) => {
    if (search && !name.includes(search)) return false;
    if (showIssuesOnly && col.issues.length === 0) return false;
    return true;
  });

  const getSeverityColor = (col: any) => {
    if (col.issues.some((i: any) => i.severity === 'critical')) return 'critical';
    if (col.issues.some((i: any) => i.severity === 'warning')) return 'warning';
    if (col.issues.length > 0) return 'info';
    return 'ok';
  };

  const getStatusLabel = (col: any) => {
    if (col.issues.length === 0) return '✅ 正常';
    const worst = col.issues.reduce((a: any, b: any) =>
      a.severity === 'critical' || b.severity === 'critical' ? { severity: 'critical' } :
      a.severity === 'warning' ? a : b
    );
    const labels: Record<string, string> = {
      inconsistent_format: '格式异常',
      contains_symbol: '含单位文字',
      outliers: '含异常值',
    };
    const label = labels[col.issues[0].type] || col.issues[0].type;
    return `⚠️ ${label}`;
  };

  const typeLabels: Record<string, string> = {
    date: '日期',
    phone: '手机号',
    number: '数字',
    amount: '金额',
    text: '文本',
    id_card: '身份证',
    email: '邮箱',
    url: 'URL',
    null: '空值',
  };

  return (
    <div className="diagnosis-step">
      {fileInfo && (
        <div className="file-info-bar">
          文件: {fileInfo.original_name} | {fileInfo.col_count}列 {fileInfo.row_count?.toLocaleString()}行 | {(fileInfo.file_size / 1024).toFixed(0)}KB
        </div>
      )}

      {error ? (
        <div className="error-state">
          <p className="form-error">{error}</p>
          <button className="btn-primary" onClick={onBack}>返回重试</button>
        </div>
      ) : loading && !report ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>{t('common.loading')}</p>
        </div>
      ) : report ? (
        <>
          <div className="health-card">
            <div className="health-score">
              <span className="score-number" style={{ color: report.overallScore >= 80 ? '#52c41a' : report.overallScore >= 50 ? '#faad14' : '#ff4d4f' }}>
                {report.overallScore}
              </span>
              <span className="score-unit">{t('diagnosis.score')}</span>
            </div>
            <div className="health-info">
              <p>⚠️ 发现 {report.summary.totalIssues} 个{t('diagnosis.issues')}
                {report.summary.criticalIssues > 0 && <span className="issue-count critical"> {report.summary.criticalIssues}个严重</span>}
                {report.summary.warningIssues > 0 && <span className="issue-count warning"> {report.summary.warningIssues}个警告</span>}
              </p>
              <div className="health-bar">
                <div className="health-fill" style={{ width: `${report.overallScore}%`, backgroundColor: report.overallScore >= 80 ? '#52c41a' : report.overallScore >= 50 ? '#faad14' : '#ff4d4f' }}></div>
              </div>
              <p className="health-meta">
                完整度 {(entries.filter(([,c]) => c.nullRate < 0.05).length / Math.max(entries.length, 1) * 100).toFixed(0)}%
                | {report.duplicateRows ? `重复行 ${report.duplicateRows}行` : '无重复行'}
              </p>
            </div>
          </div>

          <div className="diagnosis-controls">
            <input
              type="text"
              placeholder={t('diagnosis.searching')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="search-input"
            />
            <label className="issue-toggle">
              <input type="checkbox" checked={showIssuesOnly} onChange={e => setShowIssuesOnly(e.target.checked)} />
              {t('diagnosis.showIssues')}
            </label>
          </div>

          <div className="column-table">
            <div className="col-header">
              <span className="col-name">{t('diagnosis.columns')}</span>
              <span className="col-type">类型</span>
              <span className="col-completeness">完整度</span>
              <span className="col-unique">唯一性</span>
              <span className="col-status">状态</span>
            </div>
            {filtered.length === 0 ? (
              <div className="empty-table">无匹配列</div>
            ) : (
              filtered.map(([name, col]) => (
                <div key={name}>
                  <div
                    className={`col-row ${getSeverityColor(col)}`}
                    onClick={() => setExpandedCol(expandedCol === name ? null : name)}
                  >
                    <span className="col-name" title={name}>{name.length > 12 ? name.slice(0, 12) + '…' : name}</span>
                    <span className="col-type">{typeLabels[col.inferredType] || col.inferredType}</span>
                    <span className="col-completeness">{(col.nullRate !== undefined ? ((1 - col.nullRate) * 100).toFixed(0) : '-')}%</span>
                    <span className="col-unique">{col.sampleValues?.length > 0 ? Math.min(100, Math.round(col.uniqueCount / col.sampleValues.length * 100)) : 0}%</span>
                    <span className="col-status">{getStatusLabel(col)}</span>
                    <span className="col-expand">{expandedCol === name ? '▲' : '▼'}</span>
                  </div>
                  {expandedCol === name && (
                    <div className="col-detail">
                      <p><strong>推断类型:</strong> {typeLabels[col.inferredType] || col.inferredType}</p>
                      <p><strong>完整度:</strong> {(col.nullRate !== undefined ? ((1 - col.nullRate) * 100).toFixed(0) : '-')}%
                        {col.nullRate > 0 && <span> ({Math.round(col.nullRate * (fileInfo?.row_count || 0))}行空值)</span>}
                      </p>
                      <p><strong>唯一值:</strong> {col.uniqueCount?.toLocaleString() || '-'}个</p>
                      {col.formatConsistency !== undefined && (
                        <p><strong>格式一致率:</strong> {(col.formatConsistency * 100).toFixed(0)}%</p>
                      )}
                      {col.issues.length > 0 && (
                        <div className="issues-list">
                          <p><strong>问题:</strong></p>
                          {col.issues.map((issue: any, i: number) => (
                            <p key={i} className={`issue-item issue-${issue.severity}`}>
                              [{issue.severity === 'critical' ? '严重' : issue.severity === 'warning' ? '警告' : '提示'}] {issue.detail}
                            </p>
                          ))}
                        </div>
                      )}
                      <div className="sample-values">
                        <p><strong>样本数据:</strong></p>
                        <div className="sample-grid">
                          {col.sampleValues?.map((v: any, i: number) => (
                            <span key={i} className="sample-item">{String(v ?? '(空)')}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <p className="expand-hint">{t('diagnosis.expand')}</p>
        </>
      ) : (
        <div className="empty-state">
          <p>暂无诊断数据，请先上传文件</p>
        </div>
      )}

      <div className="step-actions">
        <button className="btn-secondary" onClick={onBack}>{t('common.prev')}</button>
        <button className="btn-primary" onClick={onNext} disabled={!report || loading}>
          {t('common.next')} → {t('steps.plan')}
        </button>
      </div>
    </div>
  );
}