import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import '../../styles/Settings.css';

export default function Settings() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) setUser(JSON.parse(u));
    api.getUsage().then(setUsage).catch(() => {});
    api.getBillingRecords().then(setRecords).catch(() => {});
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  return (
    <div className="settings-page">
      <header className="dash-header">
        <div className="dash-header-left">
          <h2 className="logo">{t('app.title')}</h2>
          <nav className="dash-nav">
            <Link to="/dashboard">{t('nav.dashboard')}</Link>
            <Link to="/tasks">{t('nav.tasks')}</Link>
            <Link to="/templates">{t('nav.templates')}</Link>
            <Link to="/settings" className="active">{t('nav.settings')}</Link>
          </nav>
        </div>
      </header>

      <main className="settings-main">
        <section className="settings-section">
          <h3>个人信息</h3>
          <div className="info-row"><label>手机号:</label><span>{user?.phone}</span></div>
          <div className="info-row"><label>公司:</label><span>{user?.companyName || '-'}</span></div>
        </section>

        {usage && (
          <section className="settings-section">
            <h3>{t('billing.plan')}</h3>
            <div className="plan-card">
              <div className="plan-name">{usage.planType === 'free' ? '免费体验' : usage.planType === 'basic' ? '基础版' : usage.planType === 'pro' ? '专业版' : '企业版'}</div>
              <div className="plan-quota">
                已使用 {usage.usedQuota.toLocaleString()} / {usage.monthlyQuota.toLocaleString()} 行/月
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${Math.min(100, (usage.usedQuota / usage.monthlyQuota) * 100)}%` }}></div>
              </div>
            </div>
          </section>
        )}

        <section className="settings-section">
          <h3>消费记录</h3>
          {records.length === 0 ? (
            <p className="empty-state">暂无消费记录</p>
          ) : (
            <table className="records-table">
              <thead>
                <tr><th>日期</th><th>处理行数</th></tr>
              </thead>
              <tbody>
                {records.map((r: any) => (
                  <tr key={r.id}>
                    <td>{r.deducted_at?.slice(0, 16).replace('T', ' ')}</td>
                    <td>{r.rows_processed?.toLocaleString()} 行</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="settings-section">
          <h3>账户操作</h3>
          <button className="btn-danger" onClick={handleLogout}>退出登录</button>
        </section>
      </main>
    </div>
  );
}