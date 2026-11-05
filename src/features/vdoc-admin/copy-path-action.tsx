import { Copy, Ellipsis } from 'lucide-react'
import { toast } from 'sonner'
import { writeClipboardText } from '@/lib/clipboard'
import {
  resourceLocation,
  type ResourcePathScope,
} from '@/lib/resource-location'
import { useLanguage } from '@/context/language-provider'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

function useCopyPath(location: string | undefined) {
  const { t } = useLanguage()
  return async () => {
    if (!location) return
    try {
      await writeClipboardText(location)
      toast.success(t('admin.common.pathCopied'), { id: 'copy-resource-path' })
    } catch {
      toast.error(t('admin.common.copyFailed'), { id: 'copy-resource-path' })
    }
  }
}

export function CopyPathButton({
  path,
  scope,
}: {
  path: string | undefined
  scope: ResourcePathScope
}) {
  const { t } = useLanguage()
  const location = resourceLocation(scope, path)
  const copy = useCopyPath(location)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type='button'
          variant='ghost'
          size='icon'
          className='size-9 shrink-0'
          aria-label={t('admin.common.copyCurrentFolderPath')}
          disabled={!location}
          onClick={() => void copy()}
        >
          <Copy aria-hidden className='size-4' />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{t('admin.common.copyPathWithProject')}</TooltipContent>
    </Tooltip>
  )
}

export function CopyPathMenuItem({
  path,
  scope,
  documentId,
}: {
  path: string | undefined
  scope: ResourcePathScope
  documentId?: string
}) {
  const { t } = useLanguage()
  const location = resourceLocation(scope, path, documentId)
  const copy = useCopyPath(location)
  return (
    <DropdownMenuItem disabled={!location} onSelect={() => void copy()}>
      <Copy aria-hidden />
      {t('admin.common.copyPath')}
    </DropdownMenuItem>
  )
}

export function CopyPathMenu({
  path,
  label,
  scope,
  documentId,
}: {
  path: string | undefined
  label: string
  scope: ResourcePathScope
  documentId?: string
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type='button'
          variant='ghost'
          size='icon'
          className='size-9 shrink-0'
          aria-label={label}
        >
          <Ellipsis aria-hidden className='size-4' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        <CopyPathMenuItem path={path} scope={scope} documentId={documentId} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
