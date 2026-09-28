import { afterEach, expect, it } from 'vitest'
import { vdocApi } from '@/lib/vdoc-api'
import { jsonPreview } from './page-utils'

const originalAdapter = vdocApi.defaults.adapter
afterEach(() => {
  vdocApi.defaults.adapter = originalAdapter
})

it('preserves exact contract numbers through the real Axios JSON decoder', async () => {
  vdocApi.defaults.adapter = async (config) => ({
    config,
    headers: { 'content-type': 'application/json' },
    status: 200,
    statusText: 'OK',
    data: '{"old_value":9007199254740992,"new_value":9007199254740993,"old_value_json":"9007199254740992","new_value_json":"9007199254740993","json_preview":{"responses":"{\\"enum\\":[9007199254740993,0.123456789012345678901,1e131071,1e-16383,\\"9007199254740993\\"]}"}}',
  })
  const { data } = await vdocApi.get('/precision-regression')
  expect(data.old_value).toBe(data.new_value)
  expect(jsonPreview(data.old_value, data.old_value_json)).toBe(
    '9007199254740992'
  )
  expect(jsonPreview(data.new_value, data.new_value_json)).toBe(
    '9007199254740993'
  )
  expect(jsonPreview(undefined, data.json_preview.responses)).toBe(
    '{"enum":[9007199254740993,0.123456789012345678901,1e131071,1e-16383,"9007199254740993"]}'
  )
  expect(jsonPreview(1, '1')).not.toBe(jsonPreview('1', '"1"'))
  expect(jsonPreview(null, 'null')).toBe('null')
  expect(jsonPreview({ legacy: 1 })).toBe('{\n  "legacy": 1\n}')
})
