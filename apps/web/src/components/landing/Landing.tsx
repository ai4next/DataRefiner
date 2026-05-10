import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import '../../styles/Landing.css';

export default function Landing() {
  const { t } = useTranslation();

  return (
    <div className="landing">
      <header className="landing-header">
        <div className="logo">{t('app.title')}</div>
        <nav>
          <Link to="/login">{t('nav.login')}</Link>
        </nav>
      </header>

      <section className="hero">
        <h1>{t('landing.hero')}</h1>
        <p className="subtitle">{t('landing.subhero')}</p>
        <Link to="/login" className="btn-primary btn-large">{t('landing.start')}</Link>
      </section>

      <section className="features">
        <div className="feature-card">
          <h3>{t('landing.feature1')}</h3>
          <p>{t('landing.feature1Desc')}</p>
        </div>
        <div className="feature-card">
          <h3>{t('landing.feature2')}</h3>
          <p>{t('landing.feature2Desc')}</p>
        </div>
        <div className="feature-card">
          <h3>{t('landing.feature3')}</h3>
          <p>{t('landing.feature3Desc')}</p>
        </div>
      </section>

      <section className="steps">
        <h2>三步搞定</h2>
        <div className="step-row">
          <span className="step-badge">① {t('landing.step1')}</span>
          <span className="step-arrow">→</span>
          <span className="step-badge">② {t('landing.step2')}</span>
          <span className="step-arrow">→</span>
          <span className="step-badge">③ {t('landing.step3')}</span>
          <span className="step-arrow">→</span>
          <span className="step-badge">{t('landing.step4')}</span>
        </div>
      </section>

      <section className="pricing">
        <h2>定价</h2>
        <div className="pricing-grid">
          <div className="pricing-card">
            <h3>免费体验</h3>
            <p className="price">¥0</p>
            <p>1,000行/月</p>
          </div>
          <div className="pricing-card">
            <h3>基础版</h3>
            <p className="price">¥99<small>/月</small></p>
            <p>5万行/月</p>
          </div>
          <div className="pricing-card featured">
            <h3>专业版</h3>
            <p className="price">¥299<small>/月</small></p>
            <p>50万行/月</p>
          </div>
          <div className="pricing-card">
            <h3>企业版</h3>
            <p className="price">¥999<small>/月</small></p>
            <p>不限行数</p>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <p>&copy; 2026 DataRefiner</p>
      </footer>
    </div>
  );
}