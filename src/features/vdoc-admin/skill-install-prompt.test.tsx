import { act, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { LANGUAGE_COOKIE_NAME } from '@/lib/i18n'
import { LanguageProvider, useLanguage } from '@/context/language-provider'
import { SkillInstallPrompt } from './skill-install-prompt'

const guideUrl = 'https://chnmig.github.io/Vdoc-site/skill-install.md'
const betaGuideUrl =
  'https://raw.githubusercontent.com/ChnMig/Vdoc-site/refs/tags/v0.3.17-beta.14/docs/public/skill-install.md'

function prompt(channel: 'beta' | 'release') {
  return (
    <LanguageProvider>
      <SkillInstallPrompt channel={channel} />
    </LanguageProvider>
  )
}

beforeEach(() => {
  document.cookie = `${LANGUAGE_COOKIE_NAME}=; path=/; max-age=0`
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.cookie = `${LANGUAGE_COOKIE_NAME}=; path=/; max-age=0`
})

it.each(['release', 'beta'] as const)(
  'copies a complete install request with the %s channel instead of only a link',
  async (channel) => {
    const expectedGuide = channel === 'beta' ? betaGuideUrl : guideUrl
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const screen = render(prompt(channel))

    fireEvent.click(screen.getByRole('button', { name: 'Copy install prompt' }))

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        `Read ${expectedGuide} and install the Vdoc Skill in the current project using the ${channel} channel.`
      )
    )
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Copied')
    )
    expect(
      screen.getByRole('link', { name: 'Read install instructions' })
    ).toHaveAttribute('href', expectedGuide)
  }
)

it('copies the Chinese install request in the Chinese interface', async () => {
  document.cookie = `${LANGUAGE_COOKIE_NAME}=zh-CN; path=/`
  const writeText = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  const screen = render(prompt('beta'))

  fireEvent.click(screen.getByRole('button', { name: '复制安装提示词' }))

  await waitFor(() =>
    expect(writeText).toHaveBeenCalledWith(
      `请阅读 ${betaGuideUrl}，帮我把 Vdoc Skill 安装到当前项目，使用 beta 渠道。`
    )
  )
  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent('已复制')
  )
})

it('keeps the install request selectable when clipboard access fails', async () => {
  const writeText = vi.fn().mockRejectedValue(new Error('Clipboard denied'))
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  const screen = render(prompt('release'))

  fireEvent.click(screen.getByRole('button', { name: 'Copy install prompt' }))

  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent(
      'Copy failed. Copy the sentence above manually.'
    )
  )
  expect(
    screen.getByText(
      `Read ${guideUrl} and install the Vdoc Skill in the current project using the release channel.`
    )
  ).toBeVisible()
  expect(
    screen.getByRole('button', { name: 'Copy install prompt' })
  ).toBeEnabled()
})

it('does not show feedback for another channel when an old copy finishes', async () => {
  let complete!: () => void
  const writeText = vi.fn().mockReturnValue(
    new Promise<void>((resolve) => {
      complete = resolve
    })
  )
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  const screen = render(prompt('beta'))
  fireEvent.click(screen.getByRole('button', { name: 'Copy install prompt' }))
  expect(screen.getByRole('button', { name: 'Copying…' })).toBeDisabled()

  screen.rerender(prompt('release'))
  await act(async () => complete())

  expect(screen.getByRole('status')).toBeEmptyDOMElement()
  expect(
    screen.getByRole('button', { name: 'Copy install prompt' })
  ).toBeEnabled()
  expect(
    screen.getByText(
      `Read ${guideUrl} and install the Vdoc Skill in the current project using the release channel.`
    )
  ).toBeVisible()
})

it('does not label a newly translated prompt as copied after a pending copy', async () => {
  function LanguageSwitch() {
    const { setLanguage } = useLanguage()
    return <button onClick={() => setLanguage('zh-CN')}>中文</button>
  }
  let complete!: () => void
  const writeText = vi.fn().mockReturnValue(
    new Promise<void>((resolve) => {
      complete = resolve
    })
  )
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  const screen = render(
    <LanguageProvider>
      <LanguageSwitch />
      <SkillInstallPrompt channel='beta' />
    </LanguageProvider>
  )
  fireEvent.click(screen.getByRole('button', { name: 'Copy install prompt' }))
  fireEvent.click(screen.getByRole('button', { name: '中文' }))
  await act(async () => complete())

  expect(screen.getByRole('status')).toBeEmptyDOMElement()
  expect(screen.getByRole('button', { name: '复制安装提示词' })).toBeEnabled()
})
