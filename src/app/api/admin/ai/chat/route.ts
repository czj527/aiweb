import { NextRequest } from "next/server";
import OpenAI from "openai";
import { verifyAdminToken } from "@/lib/admin-auth";
import { PROJECT_KNOWLEDGE, AI_FUNCTIONS } from "@/lib/services/ai-knowledge";
import { executeAction, queryDatabase } from "@/lib/services/ai-actions";

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || process.env.LLM_API_KEY || "";
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
const MODEL = "deepseek-chat";

function createClient(): OpenAI {
  return new OpenAI({
    apiKey: DEEPSEEK_API_KEY,
    baseURL: DEEPSEEK_BASE_URL,
  });
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ToolCall {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
}

function buildSystemPrompt(): string {
  return `${PROJECT_KNOWLEDGE}

## 回复规则
1. 使用中文回复，简洁专业
2. 需要执行操作时，调用 execute_action 函数
3. 需要查询数据时，调用 query_database 函数
4. 回答基于实际数据，不要编造信息
5. 如果操作失败，分析原因并给出建议`;
}

function sseData(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

async function handleToolCalls(
  toolCalls: ToolCall[],
  encoder: TextEncoder,
  controller: ReadableStreamDefaultController
): Promise<OpenAI.ChatCompletionMessageParam[]> {
  const toolResults: OpenAI.ChatCompletionMessageParam[] = [];

  for (const toolCall of toolCalls) {
    const { name, arguments: argsStr } = toolCall.function;
    let result: { success: boolean; message: string; data?: unknown };

    const actionLabel = name === "execute_action" ? "执行操作" : "查询数据";

    try {
      const args = JSON.parse(argsStr);

      controller.enqueue(
        encoder.encode(
          sseData({
            type: "action_start",
            action: { name, args, label: actionLabel },
          })
        )
      );

      if (name === "execute_action") {
        result = await executeAction(args.action);
      } else if (name === "query_database") {
        result = await queryDatabase(args.query_type, args.params);
      } else {
        result = { success: false, message: `未知函数: ${name}` };
      }
    } catch (e) {
      result = {
        success: false,
        message: `函数调用出错: ${e instanceof Error ? e.message : String(e)}`,
      };
    }

    controller.enqueue(
      encoder.encode(
        sseData({
          type: "action_result",
          action: { name, label: actionLabel },
          result,
        })
      )
    );

    toolResults.push({
      role: "tool",
      tool_call_id: toolCall.id,
      content: JSON.stringify(result),
    });
  }

  return toolResults;
}

export async function POST(request: NextRequest) {
  // Auth check
  const token = request.cookies.get("admin_token")?.value;
  if (!token || !verifyAdminToken(token)) {
    return new Response(JSON.stringify({ error: "未授权" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Parse body
  let messages: ChatMessage[];
  try {
    const body = await request.json();
    messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "消息列表不能为空" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch {
    return new Response(JSON.stringify({ error: "请求格式错误" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const client = createClient();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Build initial messages with system prompt
        const apiMessages: OpenAI.ChatCompletionMessageParam[] = [
          { role: "system", content: buildSystemPrompt() },
          ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        ];

        // First streaming call
        const response = await client.chat.completions.create({
          model: MODEL,
          messages: apiMessages,
          tools: AI_FUNCTIONS.map((fn) => ({
            type: "function" as const,
            function: fn,
          })),
          stream: true,
          temperature: 0.7,
        });

        // Accumulate tool calls across chunks
        let currentToolCalls: Map<number, ToolCall> = new Map();
        let contentBuffer = "";

        for await (const chunk of response) {
          const delta = chunk.choices?.[0]?.delta;
          const finishReason = chunk.choices?.[0]?.finish_reason;

          // Handle content
          if (delta?.content) {
            contentBuffer += delta.content;
            controller.enqueue(
              encoder.encode(sseData({ type: "content", text: delta.content }))
            );
          }

          // Handle tool calls (streamed incrementally)
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index;
              if (!currentToolCalls.has(idx)) {
                currentToolCalls.set(idx, {
                  id: tc.id || "",
                  function: { name: "", arguments: "" },
                });
              }
              const existing = currentToolCalls.get(idx)!;
              if (tc.id) existing.id = tc.id;
              if (tc.function?.name) existing.function.name = tc.function.name;
              if (tc.function?.arguments) existing.function.arguments += tc.function.arguments;
            }
          }

          // Handle tool call completion
          if (finishReason === "tool_calls") {
            const toolCallsArray = Array.from(currentToolCalls.values());

            // Execute tool calls and get results
            const toolResults = await handleToolCalls(
              toolCallsArray,
              encoder,
              controller
            );

            // Build follow-up messages: original + assistant with tool_calls + tool results
            const followUpMessages: OpenAI.ChatCompletionMessageParam[] = [
              ...apiMessages,
              {
                role: "assistant" as const,
                content: contentBuffer || null,
                tool_calls: toolCallsArray.map((tc) => ({
                  id: tc.id,
                  type: "function" as const,
                  function: tc.function,
                })),
              },
              ...toolResults,
            ];

            // Follow-up streaming call
            const followUpResponse = await client.chat.completions.create({
              model: MODEL,
              messages: followUpMessages,
              tools: AI_FUNCTIONS.map((fn) => ({
                type: "function" as const,
                function: fn,
              })),
              stream: true,
              temperature: 0.7,
            });

            // Reset accumulators for follow-up
            currentToolCalls = new Map();
            contentBuffer = "";

            for await (const followUpChunk of followUpResponse) {
              const fDelta = followUpChunk.choices?.[0]?.delta;
              const fFinishReason = followUpChunk.choices?.[0]?.finish_reason;

              if (fDelta?.content) {
                contentBuffer += fDelta.content;
                controller.enqueue(
                  encoder.encode(sseData({ type: "content", text: fDelta.content }))
                );
              }

              // Handle nested tool calls in follow-up (simple accumulation)
              if (fDelta?.tool_calls) {
                for (const tc of fDelta.tool_calls) {
                  const idx = tc.index;
                  if (!currentToolCalls.has(idx)) {
                    currentToolCalls.set(idx, {
                      id: tc.id || "",
                      function: { name: "", arguments: "" },
                    });
                  }
                  const existing = currentToolCalls.get(idx)!;
                  if (tc.id) existing.id = tc.id;
                  if (tc.function?.name) existing.function.name = tc.function.name;
                  if (tc.function?.arguments) existing.function.arguments += tc.function.arguments;
                }
              }

              // If follow-up also has tool calls, execute them (one level deep)
              if (fFinishReason === "tool_calls" && currentToolCalls.size > 0) {
                const nestedToolCalls = Array.from(currentToolCalls.values());
                await handleToolCalls(nestedToolCalls, encoder, controller);
                currentToolCalls = new Map();
              }
            }
          }
        }

        // Signal completion
        controller.enqueue(encoder.encode(sseData({ type: "done" })));
        controller.close();
      } catch (e) {
        const message = e instanceof Error ? e.message : "服务器内部错误";
        console.error("[AI Chat] Error:", message);
        try {
          controller.enqueue(encoder.encode(sseData({ type: "error", message })));
          controller.close();
        } catch {
          // Controller may already be closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
