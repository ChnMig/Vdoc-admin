import { describe, expect, it } from 'vitest'
import type { TFunction } from '@/lib/i18n'
import { AI_PROVIDER_DEFAULT_TUNING } from './ai-settings-types'
import {
  providerConfigurationStatus,
  providerPayload,
  providerPayloadIsBlank,
  toProjectOptions,
} from './ai-settings-utils'

describe('providerPayload', () => {
  it('parses tuning fields and preserves zero temperature', () => {
    const formData = providerFormData({
      api_key: '   ',
      enabled: 'false',
      temperature: '0',
      timeout_ms: String(AI_PROVIDER_DEFAULT_TUNING.timeout_ms),
      max_output_tokens: String(AI_PROVIDER_DEFAULT_TUNING.max_output_tokens),
    })

    expect(providerPayload(formData)).toEqual({
      name: 'OpenAI compatible',
      base_url: 'https://api.openai.example',
      model: 'gpt-test',
      api_mode: 'responses',
      enabled: false,
      temperature: 0,
      timeout_ms: 30000,
      max_output_tokens: 1000,
    })
  })

  it('omits blank optional fields from provider payloads', () => {
    const payload = providerPayload(
      providerFormData({
        api_key: '   ',
        temperature: '   ',
        timeout_ms: '',
        max_output_tokens: '   ',
      })
    )

    expect(payload).toEqual({
      name: 'OpenAI compatible',
      base_url: 'https://api.openai.example',
      model: 'gpt-test',
      api_mode: 'responses',
      enabled: true,
    })
    expect(payload).not.toHaveProperty('api_key')
    expect(payload).not.toHaveProperty('temperature')
    expect(payload).not.toHaveProperty('timeout_ms')
    expect(payload).not.toHaveProperty('max_output_tokens')
  })

  it('exposes backend-aligned provider tuning defaults for UI fields', () => {
    expect(AI_PROVIDER_DEFAULT_TUNING).toEqual({
      temperature: 0.2,
      timeout_ms: 30000,
      max_output_tokens: 1000,
    })
  })

  it('detects an empty project override form for effective-provider testing', () => {
    const payload = providerPayload(
      providerFormData({
        name: '',
        base_url: '',
        model: '',
        api_key: '',
      })
    )

    expect(providerPayloadIsBlank(payload)).toBe(true)
    expect(
      providerConfigurationStatus(
        undefined,
        ((key) =>
          key === 'admin.ai.projectProviderFallbackStatus'
            ? 'Uses fallback'
            : key) as TFunction,
        'project'
      )
    ).toBe('Uses fallback')
  })
})

describe('toProjectOptions', () => {
  it('keeps archived projects reachable and labels their read-only state', () => {
    const timestamps = {
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    }

    expect(
      toProjectOptions(
        [
          {
            id: 'active-project',
            team_id: 'team-1',
            name: 'Active project',
            status: 1,
            created_by: 'user-1',
            ...timestamps,
          },
          {
            id: 'archived-project',
            team_id: 'team-1',
            name: 'Archived project',
            status: 2,
            created_by: 'user-1',
            ...timestamps,
          },
        ],
        ((key) =>
          key === 'admin.statuses.archived' ? 'Archived' : key) as TFunction
      )
    ).toEqual([
      { value: 'active-project', label: 'Active project' },
      {
        value: 'archived-project',
        label: 'Archived project — Archived',
      },
    ])
  })
})

function providerFormData(
  values: Readonly<Record<string, string>> = {}
): FormData {
  const formData = new FormData()
  const fields = {
    name: 'OpenAI compatible',
    base_url: 'https://api.openai.example',
    model: 'gpt-test',
    api_mode: 'responses',
    enabled: 'true',
    ...values,
  }

  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value)
  }

  return formData
}
