import { useEffect, useId, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Share2 } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { DOCUMENT_SHARE_EXPIRY_PRESETS } from '@/lib/document-share-api'
import {
  buildDocumentShareUrl,
  parseDocumentShareId,
  parseDocumentShareSecret,
} from '@/lib/document-share-url'
import { resolvePublicShareBaseUrl } from '@/lib/public-share-config'
import {
  createRepositoryShare,
  listRepositoryShares,
  revealRepositoryShare,
  revokeRepositoryShare,
} from '@/lib/repository-share-api'
import { useLanguage } from '@/context/language-provider'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LoadingErrorState, NativeSelect } from './page-shared'

type Props = {
  projectId: string
  documentId: string
  releaseId: string
  disabled?: boolean
}

export function RepositoryShareDialog(props: Props) {
  const [open, setOpen] = useState(false)
  const { language } = useLanguage()
  const sessionVersion = useAuthStore((state) => state.auth.sessionVersion)
  const title = language === 'zh-CN' ? '分享此发布' : 'Share release'
  return (
    <Dialog open={open && !props.disabled} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type='button'
          variant='outline'
          size='sm'
          disabled={props.disabled}
        >
          <Share2 aria-hidden className='size-4' />
          {title}
        </Button>
      </DialogTrigger>
      {open && !props.disabled && (
        <RepositorySharePanel
          key={`${sessionVersion}:${props.projectId}:${props.releaseId}:${props.documentId}`}
          {...props}
        />
      )}
    </Dialog>
  )
}

function RepositorySharePanel({ projectId, releaseId, documentId }: Props) {
  const { language, t } = useLanguage()
  const zh = language === 'zh-CN'
  const copy = zh
    ? {
        title: '分享此发布',
        description:
          '链接仅包含此发布中的当前文档。后续提交和发布不会改变链接内容。',
        expiry: '有效期',
        password: '访问密码（可选）',
        passwordHint: '12–72 字节，首尾不能有空格。请单独发送密码。',
        create: '创建分享链接',
        creating: '正在处理…',
        link: '分享链接',
        copy: '复制链接',
        copied: '链接已复制',
        copyFailed: '复制失败，请手动复制链接。',
        existing: '此发布的分享链接',
        empty: '尚未创建分享链接。',
        reveal: '显示链接',
        revoke: '撤销',
        confirm: '确认撤销',
        cancel: '取消',
        active: '有效',
        expired: '已过期',
        revoked: '已撤销',
        protected: '需要密码',
        permanent: '永久有效',
        failed: '操作失败，请重试。',
      }
    : {
        title: 'Share release',
        description:
          'The link contains this document from this release. Later commits and releases do not change its content.',
        expiry: 'Expires after',
        password: 'Access password (optional)',
        passwordHint:
          '12–72 bytes, with no leading or trailing spaces. Send the password separately.',
        create: 'Create share link',
        creating: 'Working…',
        link: 'Share link',
        copy: 'Copy link',
        copied: 'Link copied',
        copyFailed: 'Copy failed. Copy the link manually.',
        existing: 'Links for this release',
        empty: 'No share links yet.',
        reveal: 'Show link',
        revoke: 'Revoke',
        confirm: 'Confirm revocation',
        cancel: 'Cancel',
        active: 'Active',
        expired: 'Expired',
        revoked: 'Revoked',
        protected: 'Password required',
        permanent: 'Never expires',
        failed: 'Operation failed. Please retry.',
      }
  const queryClient = useQueryClient()
  const queryKey = ['repository-shares', projectId, releaseId, documentId]
  const shares = useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      listRepositoryShares(projectId, releaseId, documentId, { signal }),
  })
  const controlId = useId()
  const [link, setLink] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [copyStatus, setCopyStatus] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const [revokeId, setRevokeId] = useState('')
  const locked = useRef(false)
  const copyRequest = useRef(0)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => {
      alive.current = false
      window.clearInterval(timer)
    }
  }, [])
  async function perform(action: () => Promise<void>) {
    if (locked.current) return
    locked.current = true
    setPending(true)
    setError('')
    setCopyStatus('')
    copyRequest.current += 1
    try {
      await action()
    } catch (value) {
      if (alive.current)
        setError(value instanceof Error ? value.message : copy.failed)
    } finally {
      locked.current = false
      if (alive.current) setPending(false)
    }
  }
  function showLink(value: { share: { id: string }; secret: string }) {
    if (!alive.current) return
    copyRequest.current += 1
    setCopyStatus('')
    setLink(
      buildDocumentShareUrl({
        baseUrl: resolvePublicShareBaseUrl(),
        shareId: parseDocumentShareId(value.share.id),
        secret: parseDocumentShareSecret(value.secret),
      })
    )
  }
  const expiryLabels = zh
    ? ['1 个月', '3 个月', '6 个月', '1 年', '永久']
    : ['1 month', '3 months', '6 months', '1 year', 'Never']
  return (
    <DialogContent className='max-h-[90dvh] overflow-y-auto'>
      <DialogHeader>
        <DialogTitle>{copy.title}</DialogTitle>
        <DialogDescription>{copy.description}</DialogDescription>
      </DialogHeader>
      <form
        className='grid gap-4'
        onSubmit={(event) => {
          event.preventDefault()
          const data = new FormData(event.currentTarget)
          const expiry = String(
            data.get('expiry')
          ) as (typeof DOCUMENT_SHARE_EXPIRY_PRESETS)[number]
          void perform(async () => {
            const value = await createRepositoryShare(
              projectId,
              releaseId,
              documentId,
              { expiry_preset: expiry, ...(password ? { password } : {}) }
            )
            if (!alive.current) return
            showLink(value)
            setPassword('')
            await queryClient.invalidateQueries({ queryKey })
          })
        }}
      >
        <NativeSelect
          name='expiry'
          label={copy.expiry}
          placeholder={copy.expiry}
          defaultValue='3_months'
          disabled={pending}
          options={DOCUMENT_SHARE_EXPIRY_PRESETS.map((value, index) => ({
            value,
            label: expiryLabels[index],
          }))}
        />
        <div className='grid gap-2'>
          <Label htmlFor={`${controlId}-password`}>{copy.password}</Label>
          <Input
            id={`${controlId}-password`}
            type='password'
            autoComplete='new-password'
            value={password}
            disabled={pending}
            minLength={12}
            maxLength={72}
            aria-describedby={`${controlId}-hint`}
            onChange={(event) => setPassword(event.target.value)}
          />
          <p id={`${controlId}-hint`} className='text-xs text-muted-foreground'>
            {copy.passwordHint}
          </p>
        </div>
        <Button type='submit' className='w-fit' disabled={pending}>
          {pending ? copy.creating : copy.create}
        </Button>
      </form>
      {error && (
        <p role='alert' className='text-sm text-destructive'>
          {error}
        </p>
      )}
      {link && (
        <div className='grid gap-2 border-t pt-4'>
          <Label htmlFor={`${controlId}-link`}>{copy.link}</Label>
          <Input
            id={`${controlId}-link`}
            readOnly
            value={link}
            onFocus={(event) => event.currentTarget.select()}
          />
          <Button
            type='button'
            variant='outline'
            className='w-fit'
            onClick={() => {
              const requestId = ++copyRequest.current
              void (async () => {
                try {
                  await navigator.clipboard.writeText(link)
                  if (alive.current && requestId === copyRequest.current)
                    setCopyStatus(copy.copied)
                } catch {
                  if (alive.current && requestId === copyRequest.current)
                    setCopyStatus(copy.copyFailed)
                }
              })()
            }}
          >
            <Copy aria-hidden className='size-4' />
            {copy.copy}
          </Button>
          <p role='status' className='text-xs text-muted-foreground'>
            {copyStatus}
          </p>
        </div>
      )}
      <section
        className='grid gap-3 border-t pt-4'
        aria-labelledby={`${controlId}-existing`}
      >
        <h3 id={`${controlId}-existing`} className='text-sm font-semibold'>
          {copy.existing}
        </h3>
        <LoadingErrorState state={shares} />
        {!shares.isPending && !shares.isError && !shares.data?.items.length && (
          <p className='text-sm text-muted-foreground'>{copy.empty}</p>
        )}
        <ul className='divide-y'>
          {shares.data?.items.map((share) => {
            const expired = Boolean(
              share.expires_at && Date.parse(share.expires_at) <= now
            )
            const active = share.status === 1 && !expired
            return (
              <li key={share.id} className='grid gap-2 py-3 text-sm'>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <span className='font-mono text-xs' title={share.id}>
                    {share.id.slice(0, 12)}
                  </span>
                  <span>
                    {share.status === 2
                      ? copy.revoked
                      : expired
                        ? copy.expired
                        : copy.active}
                  </span>
                </div>
                <p className='text-xs text-muted-foreground'>
                  {share.expires_at
                    ? new Date(share.expires_at).toLocaleString(language)
                    : copy.permanent}
                  {share.password_protected ? ` · ${copy.protected}` : ''}
                </p>
                <div className='flex flex-wrap gap-2'>
                  {active && (
                    <Button
                      type='button'
                      size='sm'
                      variant='outline'
                      disabled={pending}
                      onClick={() =>
                        void perform(async () =>
                          showLink(
                            await revealRepositoryShare(
                              projectId,
                              releaseId,
                              documentId,
                              share.id
                            )
                          )
                        )
                      }
                    >
                      {copy.reveal}
                    </Button>
                  )}
                  {share.status === 1 &&
                    (revokeId === share.id ? (
                      <>
                        <Button
                          type='button'
                          size='sm'
                          variant='destructive'
                          disabled={pending}
                          onClick={() =>
                            void perform(async () => {
                              await revokeRepositoryShare(
                                projectId,
                                releaseId,
                                documentId,
                                share.id
                              )
                              if (!alive.current) return
                              setLink('')
                              setRevokeId('')
                              await queryClient.invalidateQueries({ queryKey })
                            })
                          }
                        >
                          {copy.confirm}
                        </Button>
                        <Button
                          type='button'
                          size='sm'
                          variant='ghost'
                          disabled={pending}
                          onClick={() => setRevokeId('')}
                        >
                          {copy.cancel}
                        </Button>
                      </>
                    ) : (
                      <Button
                        type='button'
                        size='sm'
                        variant='ghost'
                        disabled={pending}
                        onClick={() => setRevokeId(share.id)}
                      >
                        {copy.revoke}
                      </Button>
                    ))}
                </div>
              </li>
            )
          })}
        </ul>
        {shares.isError && (
          <Button
            type='button'
            variant='outline'
            size='sm'
            className='w-fit'
            onClick={() => void shares.refetch()}
          >
            {t('admin.common.refresh')}
          </Button>
        )}
      </section>
    </DialogContent>
  )
}
