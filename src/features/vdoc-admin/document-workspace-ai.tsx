import { useState } from 'react'
import type { AISummaryTarget, AIChatTarget, DocumentDTO } from '@/lib/vdoc-api'
import { useLanguage } from '@/context/language-provider'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AIContextPanel } from './ai-panels'
import type { DocumentReadingSelection } from './document-workspace-content'

export function DocumentWorkspaceAI({
  projectId,
  document,
  selection,
  interactive,
  canRegenerate,
  summaryInteractive = interactive,
}: {
  projectId: string
  document: DocumentDTO
  selection: DocumentReadingSelection
  interactive: boolean
  canRegenerate: boolean
  summaryInteractive?: boolean
}) {
  const { t } = useLanguage()
  const [activeTab, setActiveTab] = useState('chat')
  const revision =
    selection.mode === 'published' ? selection.version : selection.draft
  const invalid = Boolean(
    selection.invalid ||
    (revision &&
      (revision.project_id !== projectId ||
        revision.document_id !== document.id ||
        !selection.branchId ||
        revision.branch_id !== selection.branchId))
  )
  const target: AISummaryTarget | undefined =
    !selection.pending && !invalid && revision?.id
      ? {
          projectId,
          documentId: document.id,
          ownerType: selection.mode === 'published' ? 'version' : 'draft',
          ownerId: revision.id,
        }
      : undefined

  const chatTarget: AIChatTarget = {
    projectId,
    documentId: document.id,
    ownerType: 'document',
    ownerId: document.id,
  }

  return (
    <section
      aria-label={t('admin.workspace.aiContext')}
      className='flex h-full min-h-0 min-w-0 flex-col'
    >
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className='min-h-0 flex-1 gap-4'
      >
        <TabsList
          className='w-full shrink-0'
          aria-label={t('admin.workspace.aiContext')}
        >
          <TabsTrigger value='summary'>
            {t('admin.ai.summaryTitle')}
          </TabsTrigger>
          <TabsTrigger value='chat'>{t('admin.ai.chatTitle')}</TabsTrigger>
        </TabsList>
        <TabsContent
          value='summary'
          forceMount
          hidden={activeTab !== 'summary'}
          className='min-h-0 min-w-0 overflow-y-auto overscroll-contain data-[state=inactive]:hidden'
        >
          <div className='mb-4 grid min-w-0 gap-3 border-b pb-4'>
            <p className='text-xs leading-5 text-muted-foreground'>
              {t('admin.workspace.aiContextDescription')}
            </p>
            {target && (
              <div className='flex min-w-0 items-center gap-2 text-xs'>
                <Badge variant='secondary'>
                  {selection.mode === 'published'
                    ? t('admin.workspace.published')
                    : t('admin.workspace.draft')}
                </Badge>
                <span
                  className='max-w-56 truncate font-medium'
                  title={revision?.version_name || target.ownerId}
                >
                  {revision?.version_name || target.ownerId}
                </span>
              </div>
            )}
          </div>
          {selection.pending ? (
            <p role='status' className='py-4 text-sm text-muted-foreground'>
              {t('admin.common.loading')}
            </p>
          ) : target ? (
            <AIContextPanel
              target={target}
              interactive={summaryInteractive}
              canRegenerate={canRegenerate}
              presentation='sidebar'
              mode='summary'
            />
          ) : (
            <p role='status' className='text-sm text-muted-foreground'>
              {t('admin.workspace.aiNoContext')}
            </p>
          )}
        </TabsContent>
        <TabsContent
          value='chat'
          forceMount
          hidden={activeTab !== 'chat'}
          className='min-h-0 min-w-0 data-[state=inactive]:hidden'
        >
          <AIContextPanel
            target={chatTarget}
            interactive={interactive}
            presentation='sidebar'
            mode='chat'
          />
        </TabsContent>
      </Tabs>
    </section>
  )
}
