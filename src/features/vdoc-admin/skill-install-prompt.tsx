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

const copy = {
  en: {
    title: 'Let AI install the Skill',
    description:
      'Send this sentence to your AI for installation in your project.',
    prompt: (channel: SkillChannel) =>
      `Read ${guideUrls[channel]} and install the Vdoc Skill in the current project using the ${channel} channel.`,
    copy: 'Copy install prompt',
    copying: 'Copying…',
    copyFailed: 'Copy failed. Copy the sentence above manually.',
    guideLink: 'Read install instructions',
  },
  'zh-CN': {
    title: '让 AI 帮你安装',
    description: '把这句话发给 AI，完成项目内安装。',
    prompt: (channel: SkillChannel) =>
      `请阅读 ${guideUrls[channel]}，帮我把 Vdoc Skill 安装到当前项目，使用 ${channel} 渠道。`,
    copy: '复制安装提示词',
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
  const guideUrl = guideUrls[channel]
  const prompt = text.prompt(channel)
  const identity = useMemo(() => Symbol(prompt), [prompt])
  const [feedback, setFeedback] = useState<{
    identity: symbol
    status: 'pending' | 'success' | 'failure'
  }>()
  const status = feedback?.identity === identity ? feedback.status : undefined

  async function copyPrompt() {
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
        <p className='text-sm leading-6 text-muted-foreground'>
          {text.description}
        </p>
      </div>
      <p
        id={promptId}
        className='max-w-prose text-sm leading-7 break-words select-text'
      >
        {prompt}
      </p>
      <div className='flex flex-wrap items-center gap-x-4 gap-y-2'>
        <Button
          type='button'
          size='sm'
          aria-describedby={promptId}
          disabled={status === 'pending'}
          onClick={() => void copyPrompt()}
        >
          {status === 'success' ? <Check aria-hidden /> : <Copy aria-hidden />}
          {status === 'success'
            ? t('admin.common.copied')
            : status === 'pending'
              ? text.copying
              : text.copy}
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
