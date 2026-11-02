import { useState, type ComponentProps } from 'react'
import { useLanguage } from '@/context/language-provider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AIContextPanel } from './ai-panels'
import { RepositoryAutomation } from './repository-automation'

export function RepositoryDocumentAI({
  project,
  projectId,
  documentId,
  interactive,
  ...analysis
}: Omit<ComponentProps<typeof RepositoryAutomation>, 'view'> & {
  project: string
  interactive: boolean
}) {
  const { language } = useLanguage()
  const zh = language === 'zh-CN'
  const [mode, setMode] = useState('chat')
  return (
    <Tabs
      value={mode}
      onValueChange={setMode}
      className='flex h-full min-h-0 flex-col gap-3 p-4'
    >
      <TabsList
        className='w-full shrink-0'
        aria-label={zh ? 'AI 助手功能' : 'AI assistant tools'}
      >
        <TabsTrigger value='chat'>{zh ? '对话' : 'Chat'}</TabsTrigger>
        <TabsTrigger value='analysis'>
          {zh ? '版本分析' : 'Version analysis'}
        </TabsTrigger>
      </TabsList>
      <TabsContent
        value='chat'
        forceMount
        hidden={mode !== 'chat'}
        className='min-h-0 data-[state=inactive]:hidden'
      >
        <div className='flex h-full min-h-0 flex-col gap-3'>
          <p className='shrink-0 text-xs leading-5 text-muted-foreground'>
            {zh
              ? '围绕这份文档提问，可指定分支或版本。对话保留在当前文档中。'
              : 'Ask about this document, including a branch or version. Conversations stay with this document.'}
          </p>
          <AIContextPanel
            target={
              documentId
                ? {
                    projectId: project,
                    documentId,
                    ownerType: 'document',
                    ownerId: documentId,
                  }
                : undefined
            }
            interactive={interactive && Boolean(documentId)}
            presentation='sidebar'
            mode='chat'
          />
        </div>
      </TabsContent>
      <TabsContent
        value='analysis'
        forceMount
        hidden={mode !== 'analysis'}
        className='min-h-0 overflow-y-auto overscroll-contain data-[state=inactive]:hidden'
      >
        <RepositoryAutomation
          {...analysis}
          projectId={projectId}
          documentId={documentId}
          view='ai'
          presentation='sidebar'
          active={analysis.active && mode === 'analysis'}
        />
      </TabsContent>
    </Tabs>
  )
}
