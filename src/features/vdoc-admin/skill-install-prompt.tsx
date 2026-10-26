import { useId, useMemo, useState } from 'react'
import { Check, Copy, ExternalLink } from 'lucide-react'
import { useLanguage } from '@/context/language-provider'
import { Button } from '@/components/ui/button'
import { vdocMcpReleaseVersion } from './page-utils'

const guideUrls = {
  release: 'https://chnmig.github.io/Vdoc-site/skill-install.md',
  beta: `https://raw.githubusercontent.com/ChnMig/Vdoc-site/refs/tags/v${vdocMcpReleaseVersion}/docs/public/skill-install.md`,
}

type SkillChannel = 'beta' | 'release'
type SkillAction = 'install' | 'update'

const copy = {
  en: {
    title: 'Let AI install or update',
    actionLabel: 'Skill action',
    install: 'Install',
    update: 'Update',
    description: {
      install:
        'Send this sentence to your AI for installation in your project.',
      update:
        'Keep the existing channel, installation location, and MCP configuration. Other projects sharing this installation update too.',
    },
    prompt: (channel: SkillChannel, action: SkillAction) =>
      action === 'install'
        ? `Read ${guideUrls[channel]} and install the Vdoc Skill in the current project using the ${channel} channel.`
        : `Read ${guideUrls[channel]} and update this project's Vdoc MCP and Skill to the latest version in its existing channel, preserving the existing installation location and MCP configuration.`,
    copy: { install: 'Copy install prompt', update: 'Copy update prompt' },
    copying: 'Copying…',
    copyFailed: 'Copy failed. Copy the sentence above manually.',
    guideLink: 'Read install instructions',
  },
  'zh-CN': {
    title: '让 AI 帮你安装或更新',
    actionLabel: 'Skill 操作',
    install: '安装',
    update: '更新',
    description: {
      install: '把这句话发给 AI，完成项目内安装。',
      update:
        '保留原渠道、安装位置及 MCP 配置；共享此安装位置的项目会一起更新。',
    },
    prompt: (channel: SkillChannel, action: SkillAction) =>
      action === 'install'
        ? `请阅读 ${guideUrls[channel]}，帮我把 Vdoc Skill 安装到当前项目，使用 ${channel} 渠道。`
        : `请阅读 ${guideUrls[channel]}，将当前项目的 Vdoc MCP 和 Skill 更新到原渠道最新版本，保留现有安装位置和 MCP 配置。`,
    copy: { install: '复制安装提示词', update: '复制更新提示词' },
    copying: '复制中…',
    copyFailed: '复制失败，请手动复制上方提示词。',
    guideLink: '阅读安装说明',
  },
}

export function SkillInstallPrompt({
  channel,
}: {
  readonly channel: SkillChannel
}) {
  const { language, t } = useLanguage()
  const text = copy[language]
  const headingId = useId()
  const promptId = useId()
  const [action, setAction] = useState<SkillAction>('install')
  const guideUrl = guideUrls[channel]
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
        {(['install', 'update'] as const).map((value) => (
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
