import { describe, expect, it } from 'vitest'
import { AI_PROVIDER_DEFAULT_TUNING } from './ai-settings-types'
import { providerPayload } from './ai-settings-utils'

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
