import { generateAiSuggestions } from '../lib/llm.js';
import type { DiagnosisResult } from './diagnosis-engine.js';
import { logger } from '../lib/logger.js';
import type { AiSuggestion } from '@datarefiner/shared';

export async function generateSuggestions(diagnosis: DiagnosisResult, sampleRows: (string | number | null | undefined)[][]): Promise<AiSuggestion[]> {
  try {
    const profileJson = JSON.stringify(diagnosis.columns, null, 2);
    const samplesJson = JSON.stringify(sampleRows.slice(0, 20));

    const raw = await generateAiSuggestions(profileJson, samplesJson);
    const parsed = JSON.parse(raw);
    return parsed.column_insights || [];
  } catch (err) {
    logger.warn({ err }, 'AI suggestion generation failed, using rule-based fallback');
    return generateFallbackSuggestions(diagnosis);
  }
}

function generateFallbackSuggestions(diagnosis: DiagnosisResult): AiSuggestion[] {
  const suggestions: AiSuggestion[] = [];

  for (const [colName, profile] of Object.entries(diagnosis.columns)) {
    const colSuggestions: AiSuggestion['suggestions'] = [];

    if (profile.nullRate > 0.05) {
      colSuggestions.push({
        action: 'fill_null',
        params: { column: colName, fillValue: '' },
        reason: `缺失率 ${(profile.nullRate * 100).toFixed(0)}%，建议填充`,
        confidence: 0.7,
      });
    }

    if (profile.formatConsistency !== undefined && profile.formatConsistency < 0.8) {
      colSuggestions.push({
        action: 'format_date',
        params: { column: colName, targetFormat: 'iso' },
        reason: '日期格式不一致，建议统一为 yyyy-MM-dd',
        confidence: 0.9,
      });
    }

    if (profile.inferredType === 'phone') {
      colSuggestions.push({
        action: 'clean_phone',
        params: { column: colName },
        reason: '手机号含分隔符，建议统一去除',
        confidence: 0.9,
      });
    }

    if (profile.inferredType === 'amount') {
      colSuggestions.push({
        action: 'format_number',
        params: { column: colName, pattern: '[¥$￥€元, ]' },
        reason: '金额列含单位文字，建议转纯数字',
        confidence: 0.8,
      });
    }

    if (profile.issues.some(i => i.type === 'outliers')) {
      colSuggestions.push({
        action: 'remove_outliers',
        params: { column: colName, iqrMultiplier: 1.5 },
        reason: '检测到异常值，建议移除',
        confidence: 0.7,
      });
    }

    if (colSuggestions.length > 0) {
      suggestions.push({
        columnName: colName,
        semanticType: profile.inferredType,
        description: `${colName} 列存在 ${colSuggestions.length} 个可优化项`,
        suggestions: colSuggestions,
      });
    }
  }

  // Add global trim suggestion
  suggestions.push({
    columnName: '*',
    semanticType: 'text',
    description: '建议去除所有文本列前后空格',
    suggestions: [{
      action: 'trim_whitespace',
      params: {},
      reason: '文本列可能存在前后空格，统一清理',
      confidence: 0.95,
    }],
  });

  // Add duplicate removal suggestion if duplicates detected
  if (diagnosis.duplicateRows && diagnosis.duplicateRows > 0) {
    suggestions.push({
      columnName: '*',
      semanticType: 'text',
      description: `检测到 ${diagnosis.duplicateRows} 行完全重复数据`,
      suggestions: [{
        action: 'remove_duplicates',
        params: {},
        reason: `存在 ${diagnosis.duplicateRows} 行完全重复，建议清理`,
        confidence: 0.95,
      }],
    });
  }

  return suggestions;
}