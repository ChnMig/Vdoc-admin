import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page, type Route } from '@playwright/test'

const projectId = 'model-discovery-project'
const root = '/api/v1/private'
const systemPath = `${root}/ai/provider`
const projectPath = `${root}/projects/${projectId}/ai/provider`
const provider = {
  id: 'model-discovery-provider',
  name: 'Example provider',
  base_url: 'https://models.example.test',
  model: 'saved-model',
  api_mode: 'responses',
  api_key_set: true,
  api_key_last4: 'test',
  enabled: true,
  temperature: 0.2,
  timeout_ms: 30000,
  max_output_tokens: 1000,
}

async function reply(route: Route, detail: unknown, code = 200) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'Authorization, Content-Type',
      'access-control-allow-methods': 'GET, POST, PUT, OPTIONS',
    },
    body: JSON.stringify({
      code,
      status: code === 200 ? 'OK' : 'FAILED_PRECONDITION',
      description: code === 200 ? 'OK' : 'Provider model discovery unavailable',
      detail,
      timestamp: 1,
      ...(Array.isArray(detail) ? { total: detail.length } : {}),
    }),
  })
}

async function fixture(page: Page) {
  const state = {
    requests: [] as { path: string; body: Record<string, unknown> }[],
    saves: [] as { path: string; body: Record<string, unknown> }[],
    failNext: false,
  }
  const providers = {
    [systemPath]: { ...provider, scope: 'system' },
    [projectPath]: { ...provider, scope: 'project', project_id: projectId },
  }
  await page.addInitScript(() => {
    sessionStorage.setItem('vdoc_admin_access_token', 'model-fixture-session')
  })
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    if (request.method() === 'OPTIONS') return reply(route, null)
    const path = new URL(request.url()).pathname
    if (path.endsWith('/identity/me'))
      return reply(route, {
        id: 'model-admin',
        email: 'model-admin@example.test',
        name: 'Model Admin',
        is_super_admin: true,
        can_access_audit: true,
        status: 1,
      })
    if (path === `${root}/projects`)
      return reply(route, [
        {
          id: projectId,
          team_id: 'model-team',
          team_name: 'Documentation',
          name: 'Model testing project',
          status: 1,
        },
      ])
    if (path.endsWith('/ai/provider/models')) {
      state.requests.push({ path, body: request.postDataJSON() })
      if (state.failNext) {
        state.failNext = false
        return reply(route, null, 412)
      }
      return reply(route, {
        models: ['remote-alpha', 'remote-beta', 'saved-model'],
      })
    }
    if (providers[path]) {
      if (request.method() === 'PUT') {
        const body = request.postDataJSON()
        state.saves.push({ path, body })
        providers[path] = { ...providers[path], model: body.model }
      }
      return reply(route, providers[path])
    }
    return reply(route, [])
  })
  return state
}

for (const width of [1280, 390]) {
  test(`remote model selection and custom fallback at ${width}px`, async ({
    page,
    context,
    baseURL,
  }, info) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.setViewportSize({ width, height: 900 })
    await context.addCookies([
      { name: 'vdoc-admin-language', value: 'en', url: baseURL! },
      {
        name: 'vite-ui-theme',
        value: width === 390 ? 'dark' : 'light',
        url: baseURL!,
      },
    ])
    const state = await fixture(page)
    await page.goto('/settings')
    await page.getByRole('tab', { name: 'AI', exact: true }).click()
    const model = page.getByRole('textbox', { name: 'Model', exact: true })
    await expect(model).toHaveValue('saved-model')
    await page.getByRole('button', { name: 'Browse provider models' }).click()
    const search = page.getByRole('combobox', { name: 'Search models' })
    await search.fill('remote-beta')
    await expect(page.getByRole('option')).toHaveCount(1)
    expect(state.requests).toEqual([
      {
        path: `${systemPath}/models`,
        body: { base_url: provider.base_url, timeout_ms: 30000 },
      },
    ])
    await expect(model).toHaveValue('saved-model')
    const accessibility = await new AxeBuilder({ page })
      .include('[data-slot="popover-content"]')
      .include('section[class*="provider-panel"]')
      .analyze()
    expect(accessibility.violations).toEqual([])
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true)
    await page.screenshot({ path: info.outputPath(`models-${width}.png`) })
    await search.press('ArrowDown')
    await search.press('Enter')
    await expect(model).toHaveValue('remote-beta')
    await expect(model).toBeFocused()
    expect(state.saves).toHaveLength(0)

    await page.getByRole('button', { name: 'Browse provider models' }).click()
    state.failNext = true
    await page.getByRole('button', { name: 'Refresh models' }).click()
    await expect(page.getByText(/Could not load models/)).toBeVisible()
    await page.keyboard.press('Escape')
    await model.fill('my-custom-model')
    await page.getByRole('button', { name: 'Save system provider' }).click()
    await expect.poll(() => state.saves.length).toBe(1)
    expect(state.saves[0].body.model).toBe('my-custom-model')
    expect(state.saves[0].body.api_key).toBeUndefined()

    await page
      .getByRole('tab', { name: 'Project override', exact: true })
      .click()
    await expect(model).toHaveValue('saved-model')
    await page.getByRole('button', { name: 'Browse provider models' }).click()
    await expect(
      page.getByRole('option', { name: 'remote-alpha' })
    ).toBeVisible()
    expect(state.requests.at(-1)?.path).toBe(`${projectPath}/models`)
    await page.getByRole('option', { name: 'remote-alpha' }).click()
    await expect(model).toHaveValue('remote-alpha')
    await expect(model).toBeFocused()
    expect(errors).toEqual([])
  })
}
