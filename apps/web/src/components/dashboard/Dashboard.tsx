import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import '../../styles/Dashboard.css';

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) setUser(JSON.parse(u));
    api.getUsage().then(setUsage).catch(() => {});
    loadFiles();
  }, []);

  const loadFiles = async () => {
    try {
      const data = await api.listFiles();
      setFiles(data.slice(0, 5));
    } catch {}
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) await uploadAndGo(file);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await uploadAndGo(file);
  };

  const uploadAndGo = async (file: File) => {
    try {
      const result = await api.uploadFile(file);
      navigate(`/task/${result.id}`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  const usagePercent = usage ? Math.round((usage.usedQuota / usage.monthlyQuota) * 100) : 0;

  return (
    <div className="dashboard">
      <header className="dash-header">
        <div className="dash-header-left">
          <h2 className="logo">{t('app.title')}</h2>
          <nav className="dash-nav">
            <Link to="/dashboard" className="active">{t('nav.dashboard')}</Link>
            <Link to="/tasks">{t('nav.tasks')}</Link>
            <Link to="/templates">{t('nav.templates')}</Link>
            <Link to="/settings">{t('nav.settings')}</Link>
          </nav>
        </div>
        <div className="dash-header-right">
          <span>{user?.phone}</span>
          <button onClick={handleLogout} className="btn-text">退出</button>
        </div>
      </header>

      <main className="dash-main">
        <div
          className={`upload-zone ${dragging ? 'dragging' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById('fileInput')?.click()}
        >
          <div className="upload-zone-content">
            <span className="upload-icon">+</span>
            <p>{t('upload.drag')}</p>
            <button className="btn-secondary" onClick={e => { e.stopPropagation(); document.getElementById('fileInput')?.click(); }}>
              {t('upload.select')}
            </button>
            <p className="upload-hint">{t('upload.support')} | {t('upload.maxSize')}</p>
          </div>
          <input id="fileInput" type="file" hidden accept=".xlsx,.xls,.csv,.tsv" onChange={handleFileSelect} />
        </div>

        {usage && (
          <div className="usage-card">
            <div className="usage-header">
              <span>{t('billing.usage')}: {usage.usedQuota.toLocaleString()} / {usage.monthlyQuota.toLocaleString()} {t('billing.rows')}</span>
              <span className="badge">{usage.planType === 'free' ? '免费版' : usage.planType}</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${usagePercent}%` }}></div>
            </div>
            <div className="usage-actions">
              <Link to="/settings">{t('billing.details')}</Link>
            </div>
          </div>
        )}

        <div className="recent-tasks">
          <h3>{t('nav.tasks')}</h3>
          {files.length === 0 ? (
            <p className="empty-state">
              {t('tasks.noTasks')}
              <button className="btn-primary" onClick={() => document.getElementById('fileInput')?.click()}>开始</button>
            </p>
          ) : (
            <table className="task-table">
              <thead>
                <tr>
                  <th>文件名</th>
                  <th>行数</th>
                  <th>状态</th>
                  <th>时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {files.map((f: any) => (
                  <tr key={f.id}>
                    <td>{f.original_name}</td>
                    <td>{f.row_count || '-'}</td>
                    <td><span className={`status-tag status-${f.status}`}>{statusLabel(f.status)}</span></td>
                    <td>{f.uploaded_at?.slice(0, 16).replace('T', ' ')}</td>
                    <td>
                      {f.status === 'completed' ? (
                        <Link to={`/task/${f.id}`} className="btn-sm">查看</Link>
                      ) : f.status === 'diagnosed' ? (
                        <Link to={`/task/${f.id}`} className="btn-sm">继续处理</Link>
                      ) : (
                        <span className="status-text">{f.status}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    uploaded: '已上传', diagnosing: '诊断中', diagnosed: '待确认',
    planning: '规划中', cleaning: '清洗中', completed: '已完成', expired: '已过期'
  };
  return map[s] || s;
}