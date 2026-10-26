import { vi } from 'vitest'

export function deferFileRead(file: File) {
  let complete: ((content: string) => void) | undefined
  const originalRead = FileReader.prototype.readAsArrayBuffer
  const spy = vi
    .spyOn(FileReader.prototype, 'readAsArrayBuffer')
    .mockImplementation(function (this: FileReader, blob: Blob) {
      if (blob === file) {
        complete = (content) => {
          Object.defineProperty(this, 'result', {
            value: new TextEncoder().encode(content).buffer,
            configurable: true,
          })
          this.dispatchEvent(new ProgressEvent('load'))
        }
      } else originalRead.call(this, blob)
    })
  return {
    resolve(content: string) {
      if (!complete) throw new Error('The file read has not started')
      complete(content)
      spy.mockRestore()
    },
  }
}
