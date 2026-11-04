import { useLanguage } from '@/context/language-provider'

const en = {
  actions: 'Document actions',
  rename: 'Rename document',
  renameDescription:
    'Update the document title and file name. Versions and links are retained.',
  name: 'Document title',
  filename: 'File name',
  invalidFilename:
    'Enter a file name without slashes, backslashes, or a relative directory.',
  move: 'Move document',
  moveDescription:
    'Choose a destination in this project. Versions, branches and links are retained.',
  delete: 'Delete document',
  deleteDescription:
    'This document will be removed from the project directory and all its public shares will stop working. Version history will be retained for audit.',
  unavailable:
    'The project or account changed. Reopen the document to try again.',
} as const

const zh: Record<keyof typeof en, string> = {
  actions: '文档操作',
  rename: '重命名文档',
  renameDescription: '修改文档标题和文件名，保留版本记录和链接。',
  name: '文档标题',
  filename: '文件名',
  invalidFilename: '请输入文件名，不能包含斜杠、反斜杠或相对目录。',
  move: '移动文档',
  moveDescription: '选择当前项目中的目标文件夹，保留版本、分支和链接。',
  delete: '删除文档',
  deleteDescription:
    '文档将从项目目录中移除，所有公开分享随之失效。版本历史会保留用于审计。',
  unavailable: '项目或账号已切换，请重新打开文档后重试。',
}

export function useDocumentActionsCopy() {
  return useLanguage().language === 'zh-CN' ? zh : en
}
