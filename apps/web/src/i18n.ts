import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n.use(LanguageDetector).use(initReactI18next).init({
  resources: {
    zh: {
      translation: {
        app: { title: 'AI非标数据清洗工坊', subtitle: '上传即诊断，一键清洗脏数据' },
        nav: { dashboard: '工作台', tasks: '历史任务', templates: '模板', settings: '设置', login: '登录' },
        upload: { drag: '拖拽文件到此处', select: '选择文件', support: '支持格式: .xlsx .xls .csv .tsv', maxSize: '单文件最大 100MB', uploading: '上传中...', done: '上传完成' },
        diagnosis: { title: '数据诊断', health: '数据健康度', issues: '数据问题', score: '分', columns: '列详情', searching: '搜索列名', showIssues: '只显示有问题列', normal: '正常', formatIssue: '格式异常', expand: '点击任一行可展开详细列分析' },
        cleaning: { title: '清洗方案', aiSuggest: 'AI 建议以下', actions: '项清洗操作', allColumns: '全部列', confirm: '已确认', total: '共', saveTemplate: '保存为模板', execute: '执行清洗' },
        result: { complete: '清洗完成！', stats: '清洗统计', compare: '清洗前后对比', before: '处理前', after: '处理后', downloadXlsx: '下载 .xlsx', downloadCsv: '下载 .csv', downloadReport: '下载清洗报告(PDF)', reClean: '重新清洗' },
        common: { prev: '上一步', next: '下一步', cancel: '取消', confirm: '确认', delete: '删除', loading: '加载中...', error: '出错了', retry: '重试' },
        steps: { upload: '上传文件', diagnosis: '诊断', plan: '清洗方案', result: '结果' },
        billing: { usage: '用量概览', plan: '当前套餐', upgrade: '升级', details: '查看详情', rows: '行' },
        landing: { hero: 'AI非标数据清洗工坊', subhero: '上传即诊断，一键清洗脏数据', start: '开始免费使用', step1: '上传文件', step2: 'AI诊断', step3: '一键清洗', step4: '下载结果', feature1: '智能诊断', feature1Desc: 'AI自动识别12种数据问题', feature2: '一键清洗', feature2Desc: '逐项确认，拖拽即完成', feature3: '安全可靠', feature3Desc: '7天自动过期，加密存储' },
        templates: { myTemplates: '我的清洗模板', new: '新建', use: '使用', empty: '还没有保存过模板，在清洗方案页可以保存' },
        tasks: { noTasks: '还没有清洗过数据，开始你的第一个任务吧' },
      }
    },
    en: {
      translation: {
        app: { title: 'AI Data Refiner', subtitle: 'Upload, Diagnose, Clean - One Click' },
        nav: { dashboard: 'Dashboard', tasks: 'History', templates: 'Templates', settings: 'Settings', login: 'Login' },
        upload: { drag: 'Drag & drop file here', select: 'Select File', support: 'Supported: .xlsx .xls .csv .tsv', maxSize: 'Max 100MB', uploading: 'Uploading...', done: 'Upload complete' },
        diagnosis: { title: 'Diagnosis', health: 'Data Health', issues: 'Issues Found', score: 'Score', columns: 'Column Details', searching: 'Search columns', showIssues: 'Show issues only', normal: 'Normal', formatIssue: 'Format Issue', expand: 'Click a row for detailed analysis' },
        cleaning: { title: 'Cleaning Plan', aiSuggest: 'AI suggests', actions: 'actions', allColumns: 'All columns', confirm: 'Confirmed', total: 'Total', saveTemplate: 'Save as Template', execute: 'Execute Cleaning' },
        result: { complete: 'Cleaning Complete!', stats: 'Cleaning Stats', compare: 'Before/After', before: 'Before', after: 'After', downloadXlsx: 'Download .xlsx', downloadCsv: 'Download .csv', downloadReport: 'Download Report (PDF)', reClean: 'Re-clean' },
        common: { prev: 'Previous', next: 'Next', cancel: 'Cancel', confirm: 'Confirm', delete: 'Delete', loading: 'Loading...', error: 'Error', retry: 'Retry' },
        steps: { upload: 'Upload', diagnosis: 'Diagnosis', plan: 'Plan', result: 'Result' },
        billing: { usage: 'Usage', plan: 'Plan', upgrade: 'Upgrade', details: 'Details', rows: 'rows' },
        landing: { hero: 'AI Data Refiner', subhero: 'Upload, Diagnose, Clean - One Click', start: 'Start Free', step1: 'Upload', step2: 'AI Diagnosis', step3: 'One-Click Clean', step4: 'Download', feature1: 'Smart Diagnosis', feature1Desc: 'AI detects 12 data issues', feature2: 'One-Click Clean', feature2Desc: 'Confirm & execute with ease', feature3: 'Secure', feature3Desc: 'Auto-expire in 7 days' },
        templates: { myTemplates: 'My Templates', new: 'New', use: 'Use', empty: 'No templates yet' },
        tasks: { noTasks: 'No tasks yet, start your first one!' },
      }
    }
  },
  fallbackLng: 'zh',
  interpolation: { escapeValue: false },
});

export default i18n;