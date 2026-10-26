import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const guideUrls = {
  release: 'https://chnmig.github.io/Vdoc-site/skill-install.md',
  beta: 'https://raw.githubusercontent.com/ChnMig/Vdoc-site/refs/tags/v0.3.17-beta.14/docs/public/skill-install.md',
}

for (const language of ['en', 'zh-CN'] as const) {
  for (const channel of ['release', 'beta'] as const) {
    for (const width of [375, 1280]) {
      test(`AI Skill installation: ${language}, ${channel}, ${width}px`, async ({
        page,
        context,
      }) => {
        await page.setViewportSize({ width, height: 900 })
        await context.grantPermissions(['clipboard-read', 'clipboard-write'])
        await page.route(
          /https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com)\//,
          (route) => route.abort()
        )
        await page.addInitScript(
          ({ language, channel }) => {
            sessionStorage.setItem(
              'vdoc_admin_access_token',
              'skill-install-fixture'
            )
            document.cookie = `vdoc-admin-language=${language}; path=/`
            window.__VDOC_ADMIN_CONFIG__ = {
              releaseChannel: channel,
              apiBaseUrl: window.location.origin,
            }
          },
          { language, channel }
        )
        await page.route('**/api/v1/**', async (route) => {
          if (route.request().method() === 'OPTIONS')
            return route.fulfill({ status: 204 })
          const identity = new URL(route.request().url()).pathname.endsWith(
            '/identity/me'
          )
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              code: 200,
              status: 'OK',
              timestamp: 1,
              detail: identity
                ? {
                    id: 'admin-fixture',
                    email: 'admin@example.test',
                    name: 'Admin',
                    is_super_admin: true,
                    can_access_audit: true,
                    status: 1,
                  }
                : [],
            }),
          })
        })
        await page.goto('/skill')
        const title =
          language === 'en' ? 'Let AI install the Skill' : '让 AI 帮你安装'
        const section = page.getByRole('region', { name: title })
        await expect(section).toBeVisible()
        const guide = guideUrls[channel]
        const sentence =
          language === 'en'
            ? `Read ${guide} and install the Vdoc Skill in the current project using the ${channel} channel.`
            : `请阅读 ${guide}，帮我把 Vdoc Skill 安装到当前项目，使用 ${channel} 渠道。`
        await expect(section.getByText(sentence, { exact: true })).toBeVisible()
        await expect(section.getByRole('link')).toHaveAttribute('href', guide)
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth
          )
        ).toBe(true)
        expect(
          await section.evaluate(
            (element) => element.scrollWidth <= element.clientWidth
          )
        ).toBe(true)
        expect(
          await section
            .getByText(sentence, { exact: true })
            .evaluate((element) => {
              const bounds = element.closest('section')!.getBoundingClientRect()
              const range = document.createRange()
              range.selectNodeContents(element)
              return Array.from(range.getClientRects()).every(
                (rect) =>
                  rect.left >= bounds.left - 0.5 &&
                  rect.right <= bounds.right + 0.5 &&
                  rect.top >= bounds.top - 0.5 &&
                  rect.bottom <= bounds.bottom + 0.5
              )
            })
        ).toBe(true)
        const directory = resolve(
          '..',
          '.artifacts/ai-skill-install-20261026/screenshots'
        )
        await mkdir(directory, { recursive: true })
        await page.screenshot({
          path: resolve(directory, `admin-${language}-${channel}-${width}.png`),
          fullPage: true,
        })
        await section
          .getByRole('button', {
            name: language === 'en' ? 'Copy install prompt' : '复制安装提示词',
          })
          .click()
        await expect
          .poll(() => page.evaluate(() => navigator.clipboard.readText()))
          .toBe(sentence)
        await expect(
          section.getByRole('button', {
            name: language === 'en' ? 'Copied' : '已复制',
          })
        ).toBeVisible()
        const id = await section.getAttribute('aria-labelledby')
        const result = await new AxeBuilder({ page })
          .include(`section[aria-labelledby="${id}"]`)
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
        expect(result.violations).toEqual([])
      })
    }
  }
}
