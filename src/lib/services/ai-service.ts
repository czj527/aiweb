import OpenAI from "openai";

// LLM 服务 - 调用大语言模型进行摘要、分类、打分等
// 使用 DeepSeek API (OpenAI 兼容接口)

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

const DEFAULT_MODEL = "deepseek-chat";

/** 获取 OpenAI 客户端（单例） */
function getClient(): OpenAI {
  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.LLM_API_KEY;
  if (!apiKey) {
    throw new Error(
      "未配置 API Key，请设置环境变量 DEEPSEEK_API_KEY"
    );
  }
  return new OpenAI({
    apiKey,
    baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
  });
}

/**
 * 非流式调用 LLM
 * 使用 DeepSeek Chat Completion API
 */
export async function chat(
  messages: LLMMessage[],
  options: LLMOptions = {}
): Promise<string> {
  const { model = DEFAULT_MODEL, temperature = 0.3 } = options;
  const client = getClient();

  const response = await client.chat.completions.create({
    model,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    temperature,
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("LLM returned empty response");
  }

  return content;
}

/**
 * 结构化输出 - 让 LLM 返回 JSON 格式
 * 增强版：支持截断JSON修复、多种格式提取
 */
export async function chatJSON<T>(
  messages: LLMMessage[],
  options: LLMOptions = {}
): Promise<T> {
  const result = await chat(messages, options);
  console.log(`[chatJSON] LLM raw response length: ${result.length}, first 200 chars: ${result.slice(0, 200)}`);

  // 尝试多种方式提取 JSON
  let jsonStr: string | null = null;

  // 1. 尝试提取 ```json ... ``` 代码块
  const codeBlockMatch = result.match(/```json\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }

  // 2. 尝试提取完整的 JSON 数组 [...]
  if (!jsonStr) {
    const arrayMatch = result.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      jsonStr = arrayMatch[0];
    }
  }

  // 3. 尝试提取完整的 JSON 对象 {...}
  if (!jsonStr) {
    const objectMatch = result.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      jsonStr = objectMatch[0];
    }
  }

  if (!jsonStr) {
    throw new Error("LLM did not return valid JSON: " + result.slice(0, 300));
  }

  // 尝试直接解析
  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    // JSON 可能被截断，尝试修复
  }

  // 尝试修复截断的 JSON 数组：补全缺失的括号和对象
  try {
    let fixed = jsonStr;

    // 移除末尾的逗号（在 ] 或 } 前的逗号）
    fixed = fixed.replace(/,\s*([}\]])/g, "$1");

    // 计算未闭合的括号
    let openBrackets = 0;
    let openBraces = 0;
    let inString = false;
    let escape = false;

    for (const ch of fixed) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === "[") openBrackets++;
      if (ch === "]") openBrackets--;
      if (ch === "{") openBraces++;
      if (ch === "}") openBraces--;
    }

    // 如果在字符串中被截断，先关闭字符串
    if (inString) {
      fixed += '"';
    }

    // 关闭未闭合的对象和数组
    for (let i = 0; i < openBraces; i++) {
      fixed += "}";
    }
    for (let i = 0; i < openBrackets; i++) {
      fixed += "]";
    }

    return JSON.parse(fixed) as T;
  } catch (e) {
    // 最后尝试：逐个提取数组中的对象
    try {
      const items: unknown[] = [];
      const objectRegex = /\{\s*"title"[\s\S]*?\}/g;
      let match: RegExpExecArray | null;
      while ((match = objectRegex.exec(jsonStr)) !== null) {
        try {
          let objStr = match[0];
          // 移除末尾逗号
          objStr = objStr.replace(/,\s*([}\]])/g, "$1");
          // 补全缺失的括号
          let braceCount = 0;
          for (const ch of objStr) {
            if (ch === "{") braceCount++;
            if (ch === "}") braceCount--;
          }
          for (let i = 0; i < braceCount; i++) {
            objStr += "}";
          }
          // 移除多余闭合
          while (braceCount < 0) {
            objStr = objStr.slice(0, objStr.lastIndexOf("}"));
            braceCount++;
          }
          items.push(JSON.parse(objStr));
        } catch {
          // 跳过无法解析的单个对象
        }
      }
      if (items.length > 0) {
        return items as T;
      }
    } catch {
      // 给 up
    }

    throw new Error(
      "Failed to parse LLM JSON response: " + result.slice(0, 300)
    );
  }
}
