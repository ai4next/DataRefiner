import { ChatAnthropic } from '@langchain/anthropic';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { logger } from './logger.js';

const apiKey = process.env.AI_API_KEY;

export function getLlm() {
  if (!apiKey) {
    logger.warn('AI_API_KEY not set, AI features will be degraded');
    return null;
  }
  return new ChatAnthropic({
    apiKey,
    model: process.env.AI_MODEL || 'claude-haiku-4-5-20251001',
    temperature: 0,
  });
}

export async function generateAiSuggestions(
  profileJson: string,
  samplesJson: string
): Promise<string> {
  const llm = getLlm();
  if (!llm) {
    return JSON.stringify({ column_insights: [] });
  }

  const systemPrompt = `你是专业的数据分析师。你需要根据数据列的统计信息和样本数据，诊断数据质量问题并给出清洗建议。

请严格按以下JSON格式输出：
{
  "column_insights": [
    {
      "column_name": "列名",
      "semantic_type": "推测的语义类型(如: 中文日期、中国手机号、中文地址...)",
      "description": "问题描述(一句话)",
      "suggestions": [
        {
          "action": "format_date|fill_null|clean_phone|trim_whitespace|format_number|remove_duplicates|split_column|merge_columns|remove_outliers",
          "params": { "目标参数": "值" },
          "reason": "为什么这样做",
          "confidence": 0.0-1.0
        }
      ]
    }
  ]
}`;

  const prompt = ChatPromptTemplate.fromMessages([
    ['system', systemPrompt],
    ['human', `列统计信息：\n{profile}\n\n样本数据：\n{samples}`],
  ]);

  const chain = prompt.pipe(llm);
  const response = await chain.invoke({
    profile: profileJson,
    samples: samplesJson,
  });

  const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
  return content;
}