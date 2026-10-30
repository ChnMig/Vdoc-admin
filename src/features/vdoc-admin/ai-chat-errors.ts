import type { Language } from '@/lib/i18n'
import type { AIRequestErrorDetail } from '@/lib/vdoc-api'

const messages = {
  en: {
    timeout: 'The AI request timed out. Retry or reduce the reasoning effort.',
    quota:
      'The AI account has insufficient quota. Ask an administrator to check billing.',
    authentication:
      'The AI provider rejected the API key. Ask an administrator to check AI settings.',
    permission:
      'The AI account cannot access this model. Ask an administrator to check model permissions.',
    rate_limit:
      'The AI provider is rate limited. Wait a moment before retrying.',
    context_limit:
      'This model’s context limit was exceeded. Start a new conversation or reduce the attached content.',
    reasoning_unsupported:
      'This model does not support the selected reasoning setting. Choose default and retry.',
    model_configuration:
      'The AI endpoint or model was not found. Check the Base URL, API mode and model.',
    output_limit:
      'The AI reply exceeded the output limit. Increase the token limit or reduce reasoning before retrying.',
    unavailable: 'The AI provider is temporarily unavailable. Retry later.',
    invalid_request:
      'The AI provider rejected the request. Check the model, attachments and AI settings.',
    stream_interrupted:
      'The AI response stream was interrupted. The partial reply has not been saved; retry to continue.',
    network:
      'Could not connect to the AI provider. Check connectivity and retry.',
    provider_error:
      'The AI provider could not complete the request. Please retry.',
    context_compaction:
      'Could not summarize the earlier conversation. Original messages are preserved. Retry to continue.',
  },
  'zh-CN': {
    timeout: 'AI 请求超时，可重试或降低思考强度。',
    quota: 'AI 账户余额或额度不足，请联系管理员检查计费设置。',
    authentication: 'AI 提供商拒绝了 API Key，请联系管理员检查 AI 配置。',
    permission: 'AI 账户没有所选模型的使用权限，请联系管理员检查模型授权。',
    rate_limit: 'AI 提供商触发了频率限制，请稍后重试。',
    context_limit: '内容超出了当前模型的上下文限制，请新建会话或减少附件内容。',
    reasoning_unsupported: '当前模型不支持所选思考设置，请改回默认后重试。',
    model_configuration:
      '找不到 AI 接口或模型，请检查 Base URL、API 模式和模型名称。',
    output_limit:
      'AI 回答超出了输出长度限制，请提高 token 上限或降低思考强度后重试。',
    unavailable: 'AI 提供商暂时不可用，请稍后重试。',
    invalid_request: 'AI 提供商拒绝了请求，请检查模型、附件及 AI 配置。',
    stream_interrupted: 'AI 回复中途断开，未完成的内容尚未保存，可重试原提问。',
    network: '无法连接 AI 提供商，请检查网络后重试。',
    provider_error: 'AI 提供商未能完成请求，请重试。',
    context_compaction: '较早对话整理失败，原始记录已保留，请重试后继续。',
  },
} as const

export function aiChatErrorMessage(
  error: AIRequestErrorDetail,
  language: Language
) {
  return (
    messages[language][error.code as keyof typeof messages.en] ?? error.message
  )
}

const chatMessages = {
  en: {
    thinking: 'Thinking…',
    thinkingSummary: 'Reasoning summary',
    regenerateAnswer: 'Regenerate answer',
    regenerateFailureHint:
      'The previous answer is kept. Retry to generate a replacement.',
    partialReplyHint:
      'This reply is incomplete and has not been saved. Retry your original question below.',
    contextCompacting: 'Summarizing earlier conversation…',
    contextCompacted: 'Earlier conversation summarized',
    contextCompactedHint:
      '{count} earlier messages have been summarized for context. Original messages remain in this conversation. A summary may omit details; verify important facts against the originals.',
    retryAfter: 'Try again after {seconds} seconds.',
    errorDetails: 'Technical details',
    copyDiagnostics: 'Copy diagnostics',
    errorCode: 'Error code',
    requestId: 'Provider request ID',
  },
  'zh-CN': {
    thinking: '正在思考…',
    thinkingSummary: '思考摘要',
    regenerateAnswer: '重新生成回答',
    regenerateFailureHint: '原回答已保留，可重试生成替代回答。',
    partialReplyHint: '这条回答未完成，尚未保存。可在下方重试原提问。',
    contextCompacting: '正在整理较早的对话…',
    contextCompacted: '已整理较早的对话',
    contextCompactedHint:
      '已将较早的 {count} 条消息整理为上下文摘要，原始记录仍保留在对话中。摘要可能遗漏细节，重要事实请核对原文。',
    retryAfter: '请在 {seconds} 秒后重试。',
    errorDetails: '查看错误详情',
    copyDiagnostics: '复制诊断信息',
    errorCode: '错误代码',
    requestId: '提供商请求 ID',
  },
} as const

export function aiChatText(
  language: Language,
  key: keyof typeof chatMessages.en,
  values?: Record<string, string | number>
) {
  const text: string = chatMessages[language][key]
  return values
    ? text.replace(/\{(\w+)\}/g, (match, name: string) =>
        String(values[name] ?? match)
      )
    : text
}
