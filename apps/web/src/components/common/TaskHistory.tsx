import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import '../../styles/TaskHistory.css';

export default function TaskHistory() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listFiles().then(data => {
      setFiles(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除？此操作不可逆。')) return;
    try {
      await api.deleteFile(id);
      setFiles(prev => prev.filter(f => f.id !== id));
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="task-history-page">
      <header className="dash-header">
        <div className="dash-header-left">
          <h2 className="logo">{t('app.title')}</h2>
          <nav className="dash-nav">
            <Link to="/dashboard">{t('nav.dashboard')}</Link>
            <Link to="/tasks" className="active">{t('nav.tasks')}</Link>
            <Link to="/templates">{t('nav.templates')}</Link>
            <Link to="/settings">{t('nav.settings')}</Link>
          </nav>
        </div>
      </header>

      <main className="task-history-main">
        <h3>{t('nav.tasks')}</h3>

        {loading ? (
          <div className="loading-state"><div className="spinner"></div></div>
        ) : files.length === 0 ? (
          <div className="empty-state">
            <p>{t('tasks.noTasks')}</p>
            <button className="btn-primary" onClick={() => navigate('/dashboard')}>开始</button>
          </div>
        ) : (
          <table className="task-table full">
            <thead>
              <tr>
                <th>文件名</th><th>行数</th><th>列数</th><th>状态</th><th>大小</th><th>上传时间</th><th>操作</th>
              </tr>
            </thead>
            <tbody>
              {files.map((f: any) => (
                <tr key={f.id}>
                  <td>{f.original_name}</td>
                  <td>{f.row_count || '-'}</td>
                  <td>{f.col_count || '-'}</td>
                  <td><span className={`status-tag status-${f.status}`}>{f.status}</span></td>
                  <td>{(f.file_size / 1024).toFixed(0)}KB</td>
                  <td>{f.uploaded_at?.slice(0, 16).replace('T', ' ')}</td>
                  <td className="actions-cell">
                    <Link to={`/task/${f.id}`} className="btn-sm">查看</Link>
                    <button className="btn-sm btn-danger" onClick={() => handleDelete(f.id)}>{t('common.delete')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </div>
  );
}