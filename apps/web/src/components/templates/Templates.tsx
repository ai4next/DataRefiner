import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import '../../styles/Templates.css';

export default function Templates() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listTemplates().then(data => {
      setTemplates(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除？')) return;
    try {
      await api.deleteTemplate(id);
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch {}
  };

  const handleUse = (tmpl: any) => {
    // Store template in session and go to dashboard to upload
    sessionStorage.setItem('activeTemplate', JSON.stringify(tmpl));
    navigate('/task/new');
  };

  return (
    <div className="templates-page">
      <header className="dash-header">
        <div className="dash-header-left">
          <h2 className="logo">{t('app.title')}</h2>
          <nav className="dash-nav">
            <Link to="/dashboard">{t('nav.dashboard')}</Link>
            <Link to="/tasks">{t('nav.tasks')}</Link>
            <Link to="/templates" className="active">{t('nav.templates')}</Link>
            <Link to="/settings">{t('nav.settings')}</Link>
          </nav>
        </div>
      </header>

      <main className="templates-main">
        <div className="templates-header">
          <h3>{t('templates.myTemplates')}</h3>
        </div>

        {loading ? (
          <div className="loading-state"><div className="spinner"></div></div>
        ) : templates.length === 0 ? (
          <div className="empty-state">
            <p>{t('templates.empty')}</p>
          </div>
        ) : (
          <div className="template-grid">
            {templates.map((tmpl: any) => {
              const plan = JSON.parse(tmpl.template_json || '{}');
              return (
                <div key={tmpl.id} className="template-card">
                  <h4>{tmpl.name}</h4>
                  <p className="template-date">{tmpl.created_at?.slice(0, 10)}</p>
                  <div className="template-meta">
                    <span>{plan.actions?.length || 0}项操作</span>
                    {tmpl.source_columns && <span>适配: {tmpl.source_columns}</span>}
                  </div>
                  <div className="template-actions">
                    <button className="btn-primary btn-sm" onClick={() => handleUse(tmpl)}>{t('templates.use')}</button>
                    <button className="btn-danger btn-sm" onClick={() => handleDelete(tmpl.id)}>{t('common.delete')}</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}