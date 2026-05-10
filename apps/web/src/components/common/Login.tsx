import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import '../../styles/Login.css';

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setError('请输入正确的手机号');
      return;
    }
    const finalCode = code || '000000';
    if (finalCode.length !== 6) {
      setError('请输入6位验证码');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await api.login(phone, finalCode);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>{t('app.title')}</h1>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>手机号</label>
            <input
              type="tel"
              placeholder="请输入手机号"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              maxLength={11}
            />
          </div>
          <div className="form-group">
            <label>验证码</label>
            <div className="code-row">
              <input
                type="text"
                placeholder="6位验证码"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
              />
              <button type="button" className="btn-code" onClick={() => alert('演示环境: 任意6位数字即可登录')}>
                获取验证码
              </button>
            </div>
          </div>
          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="btn-primary btn-full" disabled={loading}>
            {loading ? '登录中...' : t('nav.login')}
          </button>
          <p className="form-hint">演示环境: 输入任意11位手机号和6位验证码即可登录</p>
        </form>
      </div>
    </div>
  );
}