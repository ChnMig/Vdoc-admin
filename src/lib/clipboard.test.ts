import { afterEach, describe, expect, it, vi } from 'vitest'
import { writeClipboardText } from './clipboard'

const originalExecCommand = Object.getOwnPropertyDescriptor(
  document,
  'execCommand'
)
afterEach(() => {
  vi.unstubAllGlobals()
  if (originalExecCommand)
    Object.defineProperty(document, 'execCommand', originalExecCommand)
  else Reflect.deleteProperty(document, 'execCommand')
  document.body.replaceChildren()
})

describe('clipboard writes', () => {
  it('copies the exact Unicode and multiline location through the Clipboard API', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const text =
      '{\n  "project_id": "project-a",\n  "path": "版本/前端接口.md"\n}'
    await writeClipboardText(text)
    expect(writeText).toHaveBeenCalledWith(text)
  })

  it('reports a denied clipboard write instead of claiming success', async () => {
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error('Permission denied')),
      },
    })
    await expect(writeClipboardText('private/path.md')).rejects.toThrow(
      'Permission denied'
    )
  })

  it('copies on HTTP LAN deployments and restores the previous focus', async () => {
    vi.stubGlobal('navigator', {})
    const button = document.createElement('button')
    document.body.append(button)
    button.focus()
    let copied = ''
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: (command: string) => {
        expect(command).toBe('copy')
        copied = (document.activeElement as HTMLTextAreaElement).value
        return true
      },
    })
    await writeClipboardText('版本变更/前端接口.md')
    expect(copied).toBe('版本变更/前端接口.md')
    expect(document.activeElement).toBe(button)
    expect(document.querySelector('textarea')).toBeNull()
  })

  it('reports unsupported copying and removes temporary elements', async () => {
    vi.stubGlobal('navigator', {})
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: () => false,
    })
    await expect(writeClipboardText('path')).rejects.toThrow(
      'Clipboard unavailable'
    )
    expect(document.querySelector('textarea')).toBeNull()
  })
})
