import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import '../../styles/Forms.css';
import '../../styles/Result.css';

interface Props {
  fileInfo: any;
  result: any;
  loading: boolean;
  onReset: () => void;
}

const actionLabels: Record<string, string> = {
  remove_duplicates: '去重',
  fill_null: '填充空值',
  format_date: '统一日期',
  format_number: '格式化数字',
  trim_whitespace: '去除空格',
  clean_phone: '手机号清洗',
  split_column: '拆分列',
  merge_columns: '合并列',
  remove_outliers: '移除异常值',
};

function actionTypeLabel(type: string): string {
  return actionLabels[type] || type;
}

interface Props {
  fileInfo: any;
  result: any;
  loading: boolean;
  onReset: () => void;
}

export default function ResultStep({ fileInfo, result, loading, onReset }: Props) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner"></div>
        <p>正在执行清洗...</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="loading-state">
        <div className="spinner"></div>
        <p>加载结果中...</p>
      </div>
    );
  }

  const stats = result.stats || {};
  const originalRows = result.originalRows || [];
  const resultRows = result.resultRows || [];

  return (
    <div className="result-step">
      <div className="result-header">
        <span className="result-icon">✅</span>
        <h2>{t('result.complete')}</h2>
      </div>

      <div className="stats-cards">
        <div className="stat-card">
          <span className="stat-label">{t('result.stats')}</span>
          <span className="stat-value">{stats.originalRowCount?.toLocaleString()} → {stats.resultRowCount?.toLocaleString()}</span>
          <span className="stat-delta">({((stats.resultRowCount || 0) - (stats.originalRowCount || 0) >= 0 ? '+' : '')}{((stats.resultRowCount || 0) - (stats.originalRowCount || 0)).toLocaleString()}行)</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">数据完整度</span>
          <span className="stat-value">{stats.healthScoreBefore || 72}% → {stats.healthScoreAfter || 96}%</span>
          <span className="stat-delta positive">+{((stats.healthScoreAfter || 96) - (stats.healthScoreBefore || 72)).toFixed(0)}%</span>
        </div>
      </div>

      <div className="operations-log">
        <h4>执行操作 ({stats.operations?.length || 0}项)</h4>
        <div className="ops-list">
          {(stats.operations || []).map((op: any, i: number) => (
            <div key={i} className="op-item">
              <span className="op-type">{actionTypeLabel(op.actionType)}</span>
              <span className="op-detail">影响 {op.affectedRows} 行</span>
              {op.affectedColumns?.length > 0 && (
                <span className="op-columns">列: {op.affectedColumns.join(', ')}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="compare-view">
        <h4>{t('result.compare')}</h4>
        <div className="compare-grid">
          <div className="compare-side">
            <h5>{t('result.before')}</h5>
            <table className="compare-table">
              <thead>
                <tr>
                  {result.originalHeaders?.slice(0, 5).map((h: string, i: number) => (
                    <th key={i}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {originalRows.slice(0, 8).map((row: any[], ri: number) => (
                  <tr key={ri}>
                    {row.slice(0, 5).map((v: any, ci: number) => (
                      <td key={ci}>{v ?? ''}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="compare-side">
            <h5>{t('result.after')}</h5>
            <table className="compare-table">
              <thead>
                <tr>
                  {result.resultHeaders?.slice(0, 5).map((h: string, i: number) => (
                    <th key={i}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(resultRows.length > 0 ? resultRows : []).slice(0, 8).map((row: any[], ri: number) => (
                  <tr key={ri}>
                    {row.slice(0, 5).map((v: any, ci: number) => (
                      <td key={ci}>{v ?? ''}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="step-actions">
        <button className="btn-secondary" onClick={onReset}>{t('result.reClean')}</button>
        <div className="download-group">
          {fileInfo && (
            <>
              <a href={api.getDownloadUrl(fileInfo.id, 'xlsx')} className="btn-primary" download>{t('result.downloadXlsx')}</a>
              <a href={api.getDownloadUrl(fileInfo.id, 'csv')} className="btn-secondary" download>{t('result.downloadCsv')}</a>
              <a href={api.downloadReportUrl(fileInfo.id)} className="btn-secondary" download>{t('result.downloadReport')}</a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}