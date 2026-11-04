import { useId, useMemo, useState } from 'react'
import { Check, Copy, ExternalLink } from 'lucide-react'
import { useLanguage } from '@/context/language-provider'
import { Button } from '@/components/ui/button'
import packageInfo from '../../../package.json'

const guideUrl = `https://raw.githubusercontent.com/ChnMig/Vdoc-site/refs/tags/v${packageInfo.version}/docs/public/mcp-install.md`

type MCPChannel = 'beta' | 'release'
type MCPAction = 'install' | 'update' | 'uninstall'

const copy = {
  en: {
    title: 'Let AI install, update, or uninstall MCP',
    actionLabel: 'MCP action',
    install: 'Install',
    update: 'Update',
    uninstall: 'Uninstall',
    description: {
      install:
        'Install once for this user, with one global MCP configuration shared by all projects.',
      update:
        'Update the shared global installation, preserving its channel, location, and user-wide MCP configuration.',
      uninstall:
        'Remove the selected user-wide connection for all projects; preserve other connections and shared installations.',
    },
    prompt: (channel: MCPChannel, action: MCPAction) =>
      action === 'install'
        ? `Read ${guideUrl} and globally install Vdoc MCP using the ${channel} channel and register it in this user's global MCP configuration for all projects.`
        : action === 'update'
          ? `Read ${guideUrl} and update this user's global Vdoc MCP to the latest version in its existing channel, preserving its installation location and user-wide MCP configuration.`
          : `Read ${guideUrl} and uninstall this user's global Vdoc MCP connection, preserving other MCP configurations and installations still used by other connections.`,
    copy: {
      install: 'Copy install prompt',
      update: 'Copy update prompt',
      uninstall: 'Copy uninstall prompt',
    },
    copying: 'Copying…',
    copyFailed: 'Copy failed. Copy the sentence above manually.',
    guideLink: 'Read instructions',
  },
  'zh-CN': {
    title: '一句话让 AI 安装、更新或卸载 MCP',
    actionLabel: 'MCP 操作',
    install: '安装',
    update: '更新',
    uninstall: '卸载',
    description: {
      install: '为当前用户全局安装一次，所有项目共用同一份 MCP 配置。',
      update: '更新共用的全局安装，保留原渠道、安装位置及用户级全局 MCP 配置。',
      uninstall:
        '移除所有项目共用的对应全局连接，保留其他连接及仍在使用的共享安装。',
    },
    prompt: (channel: MCPChannel, action: MCPAction) =>
      action === 'install'
        ? `请阅读 ${guideUrl}，使用 ${channel} 渠道全局安装 Vdoc MCP，并写入本机用户级全局 MCP 配置，供所有项目共用。`
        : action === 'update'
          ? `请阅读 ${guideUrl}，将本机全局 Vdoc MCP 更新到原渠道最新版本，保留现有安装位置和用户级全局 MCP 配置。`
          : `请阅读 ${guideUrl}，卸载本机用户级全局 Vdoc MCP 接入，保留其他 MCP 配置和仍被其他连接使用的安装。`,
    copy: {
      install: '复制安装提示词',
      update: '复制更新提示词',
      uninstall: '复制卸载提示词',
    },
    copying: '复制中…',
    copyFailed: '复制失败，请手动复制上方提示词。',
    guideLink: '阅读操作说明',
  },
}

export function MCPInstallPrompt({
  channel,
}: {
  readonly channel: MCPChannel
}) {
  const { language, t } = useLanguage()
  const text = copy[language]
  const headingId = useId()
  const promptId = useId()
  const [action, setAction] = useState<MCPAction>('install')
  const prompt = text.prompt(channel, action)
  const identity = useMemo(() => Symbol(prompt), [prompt])
  const [feedback, setFeedback] = useState<{
    identity: symbol
    status: 'pending' | 'success' | 'failure'
  }>()
  const copyInProgress = feedback?.status === 'pending'
  const status = feedback?.identity === identity ? feedback.status : undefined

  async function copyPrompt() {
    if (copyInProgress) return
    setFeedback({ identity, status: 'pending' })
    try {
      await navigator.clipboard.writeText(prompt)
      setFeedback((current) =>
        current?.identity === identity
          ? { identity, status: 'success' }
          : current
      )
    } catch {
      setFeedback((current) =>
        current?.identity === identity
          ? { identity, status: 'failure' }
          : current
      )
    }
  }

  return (
    <section
      aria-labelledby={headingId}
      className='grid min-w-0 gap-3 border-b pb-4'
    >
      <div className='space-y-1'>
        <h3 id={headingId} className='text-sm leading-6 font-medium'>
          {text.title}
        </h3>
      </div>
      <div
        role='group'
        aria-label={text.actionLabel}
        className='flex w-fit items-center gap-1 rounded-lg bg-muted p-1'
      >
        {(['install', 'update', 'uninstall'] as const).map((value) => (
          <Button
            key={value}
            type='button'
            size='sm'
            variant='ghost'
            className={
              action === value
                ? 'bg-background shadow-sm hover:bg-background'
                : undefined
            }
            aria-pressed={action === value}
            onClick={() => setAction(value)}
          >
            {text[value]}
          </Button>
        ))}
      </div>
      <p className='text-sm leading-6 text-muted-foreground'>
        {text.description[action]}
      </p>
      <p
        id={promptId}
        className='max-w-prose min-w-0 text-sm leading-7 break-words select-text'
      >
        {prompt}
      </p>
      <div className='flex flex-wrap items-center gap-x-4 gap-y-2'>
        <Button
          type='button'
          size='sm'
          aria-describedby={promptId}
          disabled={copyInProgress}
          onClick={() => void copyPrompt()}
        >
          {status === 'success' ? <Check aria-hidden /> : <Copy aria-hidden />}
          {status === 'success'
            ? t('admin.common.copied')
            : copyInProgress
              ? text.copying
              : text.copy[action]}
        </Button>
        <Button asChild size='sm' variant='link' className='px-0'>
          <a href={guideUrl} target='_blank' rel='noopener noreferrer'>
            {text.guideLink}
            <ExternalLink aria-hidden />
          </a>
        </Button>
      </div>
      <div
        role='status'
        aria-live='polite'
        className={status === 'failure' ? undefined : 'sr-only'}
      >
        {status === 'failure' && (
          <p className='text-sm text-destructive'>{text.copyFailed}</p>
        )}
        {status === 'success' && (
          <span className='sr-only'>{t('admin.common.copied')}</span>
        )}
      </div>
    </section>
  )
}
