import type { MCPTokenDTO } from '@/lib/vdoc-api'
import { useLanguage } from '@/context/language-provider'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { tokenCapabilityCopy } from './mcp-token-capabilities-copy'
import {
  SCOPE_API_READ,
  SCOPE_DOC_READ,
  tokenIsActive,
  stringify,
} from './page-utils'

export function TokenCapabilities({ token }: { token: MCPTokenDTO }) {
  const { t, language } = useLanguage()
  const copy = tokenCapabilityCopy[language]
  const canRead =
    token.scopes.includes(SCOPE_API_READ) ||
    token.scopes.includes(SCOPE_DOC_READ)
  const canWrite = token.scopes.includes(2) || token.scopes.includes(4)
  const canPatch =
    (token.scopes.includes(1) && token.scopes.includes(2)) ||
    (token.scopes.includes(3) && token.scopes.includes(4))
  return (
    <section
      aria-label={copy.capabilitiesTitle}
      className='min-w-0 rounded-lg border bg-card'
    >
      <div className='grid gap-4 p-5'>
        <div>
          <h2 className='text-base font-semibold'>{copy.capabilitiesTitle}</h2>
          <p className='mt-1 text-sm text-muted-foreground'>{token.name}</p>
        </div>
        {!tokenIsActive(token) && (
          <p role='status' className='text-sm text-destructive'>
            {copy.inactiveCapabilities}
          </p>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('admin.fields.type')}</TableHead>
              <TableHead>{t('admin.token.readDocuments')}</TableHead>
              <TableHead>{t('admin.token.writeDocuments')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(
              [
                ['OpenAPI', 1, 2],
                ['Markdown / TXT', 3, 4],
              ] as const
            ).map(([label, read, write]) => (
              <TableRow key={label}>
                <TableCell>{label}</TableCell>
                {[read, write].map((scope) => (
                  <TableCell key={scope}>
                    {token.scopes.includes(scope)
                      ? copy.permissionGranted
                      : copy.permissionNotGranted}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <dl className='grid gap-4 text-sm leading-6'>
          <div>
            <dt className='font-medium'>{copy.allowedActions}</dt>
            <dd className='mt-1 space-y-1 text-muted-foreground'>
              {canRead && <p>{copy.readCapabilities}</p>}
              {canWrite && <p>{copy.writeCapabilities}</p>}
              {canPatch && <p>{copy.patchCapabilities}</p>}
              {!canRead && !canWrite && <p>{copy.noKnownCapabilities}</p>}
            </dd>
          </div>
          <div>
            <dt className='font-medium'>{copy.accessBoundary}</dt>
            <dd className='mt-1 space-y-1 text-muted-foreground'>
              <p>{copy.crossProjectAccess}</p>
              <p>{copy.roleBoundary}</p>
              <p>{copy.publishBoundary}</p>
            </dd>
          </div>
        </dl>
      </div>
      <details className='border-t'>
        <summary className='cursor-pointer rounded-lg px-5 py-4 text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'>
          {t('admin.sections.tokenDetails')}
        </summary>
        <pre className='max-h-[32rem] overflow-auto border-t p-5 text-xs leading-relaxed'>
          {stringify(tokenDetails(token))}
        </pre>
      </details>
    </section>
  )
}

function tokenDetails(token: MCPTokenDTO) {
  return {
    id: token.id,
    user_id: token.user_id,
    name: token.name,
    token: token.token,
    scopes: token.scopes,
    status: token.status,
    created_at: token.created_at,
    updated_at: token.updated_at,
    expires_at: token.expires_at,
    revoked_at: token.revoked_at,
    revoked_by: token.revoked_by,
    last_used_at: token.last_used_at,
  }
}
