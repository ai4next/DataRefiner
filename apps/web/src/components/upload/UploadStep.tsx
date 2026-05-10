import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import '../../styles/Forms.css';

interface Props {
  onDone: (info: any) => void;
}

export default function UploadStep({ onDone }: Props) {
  const { t } = useTranslation();
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv', 'tsv'].includes(ext || '')) {
      setError(`不支持的文件格式: .${ext}。支持: .xlsx .xls .csv .tsv`);
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setError('文件超过 100MB 限制');
      return;
    }

    setUploading(true);
    setError('');
    try {
      const result = await api.uploadFile(file, setProgress);
      onDone(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleFile(e.target.files[0]);
  };

  return (
    <div className="upload-step">
      <div
        className={`drop-zone ${dragging ? 'dragging' : ''} ${uploading ? 'uploading' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
      >
        {uploading ? (
          <div className="upload-progress">
            <div className="upload-file-name">上传中... {progress}%</div>
            <div className="progress-bar"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
          </div>
        ) : (
          <div className="drop-zone-content">
            <span className="drop-icon">📁</span>
            <p className="drop-text">{t('upload.drag')}</p>
            <button className="btn-secondary" onClick={e => { e.stopPropagation(); inputRef.current?.click(); }}>
              {t('upload.select')}
            </button>
            <p className="drop-hint">{t('upload.support')} | {t('upload.maxSize')}</p>
            <p className="drop-tip">💡 提示: 如果文件有多个Sheet，上传后默认读取第一个</p>
          </div>
        )}
        <input ref={inputRef} type="file" hidden accept=".xlsx,.xls,.csv,.tsv" onChange={handleSelect} />
      </div>
      {error && <div className="form-error">{error}</div>}
    </div>
  );
}