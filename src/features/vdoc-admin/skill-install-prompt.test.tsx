import { act, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { LANGUAGE_COOKIE_NAME } from '@/lib/i18n'
import { LanguageProvider, useLanguage } from '@/context/language-provider'
import { SkillInstallPrompt } from './skill-install-prompt'

const guideUrl =
  'https://raw.githubusercontent.com/ChnMig/Vdoc-site/refs/tags/v0.3.17-beta.15/docs/public/skill-install.md'

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
    const expectedGuide = guideUrl
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
      screen.getByRole('link', { name: 'Read instructions' })
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
      `请阅读 ${guideUrl}，帮我把 Vdoc Skill 安装到当前项目，使用 beta 渠道。`
    )
  )
  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent('已复制')
  )
})

it.each([
  ['en', 'release'],
  ['en', 'beta'],
  ['zh-CN', 'release'],
  ['zh-CN', 'beta'],
] as const)(
  'copies the full %s update request for %s',
  async (language, channel) => {
    document.cookie = `${LANGUAGE_COOKIE_NAME}=${language}; path=/`
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const screen = render(prompt(channel))
    const update = screen.getByRole('button', {
      name: language === 'en' ? 'Update' : '更新',
    })
    fireEvent.click(update)
    expect(update).toHaveAttribute('aria-pressed', 'true')
    const expectedGuide = guideUrl
    const sentence =
      language === 'en'
        ? `Read ${expectedGuide} and update this project's Vdoc MCP and Skill to the latest version in its existing channel, preserving the existing installation location and MCP configuration.`
        : `请阅读 ${expectedGuide}，将当前项目的 Vdoc MCP 和 Skill 更新到原渠道最新版本，保留现有安装位置和 MCP 配置。`

    fireEvent.click(
      screen.getByRole('button', {
        name: language === 'en' ? 'Copy update prompt' : '复制更新提示词',
      })
    )

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(sentence))
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        language === 'en' ? 'Copied' : '已复制'
      )
    )
    expect(screen.getByText(sentence, { exact: true })).toBeVisible()
  }
)

it.each([
  ['en', 'release'],
  ['en', 'beta'],
  ['zh-CN', 'release'],
  ['zh-CN', 'beta'],
] as const)(
  'copies the full %s uninstall request for %s without choosing a local channel',
  async (language, channel) => {
    document.cookie = `${LANGUAGE_COOKIE_NAME}=${language}; path=/`
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const screen = render(prompt(channel))
    const uninstall = screen.getByRole('button', {
      name: language === 'en' ? 'Uninstall' : '卸载',
    })
    fireEvent.click(uninstall)
    expect(uninstall).toHaveAttribute('aria-pressed', 'true')
    const sentence =
      language === 'en'
        ? `Read ${guideUrl} and uninstall the current project's Vdoc MCP and Skill integration, preserving installations shared with other projects and other tool configurations.`
        : `请阅读 ${guideUrl}，卸载当前项目的 Vdoc MCP 和 Skill 接入，保留其他项目共用的安装以及其他工具配置。`
    fireEvent.click(
      screen.getByRole('button', {
        name: language === 'en' ? 'Copy uninstall prompt' : '复制卸载提示词',
      })
    )
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(sentence))
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        language === 'en' ? 'Copied' : '已复制'
      )
    )
    expect(screen.getByText(sentence, { exact: true })).toBeVisible()
  }
)

it('prevents overlapping clipboard writes when switching among all three actions', async () => {
  let complete!: () => void
  const writeText = vi
    .fn()
    .mockReturnValueOnce(
      new Promise<void>((resolve) => {
        complete = resolve
      })
    )
    .mockResolvedValue(undefined)
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  const screen = render(prompt('beta'))
  fireEvent.click(screen.getByRole('button', { name: 'Copy install prompt' }))
  expect(screen.getByRole('button', { name: 'Copying…' })).toBeDisabled()

  for (const action of ['Update', 'Uninstall']) {
    fireEvent.click(screen.getByRole('button', { name: action }))
    const pending = screen.getByRole('button', { name: 'Copying…' })
    expect(pending).toBeDisabled()
    fireEvent.click(pending)
    expect(writeText).toHaveBeenCalledTimes(1)
  }
  await act(async () => complete())

  expect(screen.getByRole('status')).toBeEmptyDOMElement()
  const copyUninstall = screen.getByRole('button', {
    name: 'Copy uninstall prompt',
  })
  expect(copyUninstall).toBeEnabled()
  fireEvent.click(copyUninstall)
  await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2))
  expect(writeText).toHaveBeenLastCalledWith(
    `Read ${guideUrl} and uninstall the current project's Vdoc MCP and Skill integration, preserving installations shared with other projects and other tool configurations.`
  )
  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent('Copied')
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
