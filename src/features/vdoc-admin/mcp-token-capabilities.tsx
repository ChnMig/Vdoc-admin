import { mcpTokenPermissions } from '@/lib/mcp-token-permissions'
import type { MCPTokenDTO } from '@/lib/vdoc-api'
import { useLanguage } from '@/context/language-provider'
import { tokenCapabilityCopy } from './mcp-token-capabilities-copy'
import { StatusBadge } from './page-shared'
import { tokenIsActive, stringify } from './page-utils'

export function TokenCapabilities({ token }: { token: MCPTokenDTO }) {
  const { t, language } = useLanguage()
  const copy = tokenCapabilityCopy[language]
  const permissions = mcpTokenPermissions(token)
  const { canRead, canWrite, canPatch } = permissions
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
        <dl className='divide-y rounded-md bg-muted/40 px-4'>
          {(
            [
              ['read', t('admin.token.readDocuments'), copy.readSummary],
              ['write', t('admin.token.writeDocuments'), copy.writeSummary],
            ] as const
          ).map(([capability, label, description]) => (
            <div
              key={capability}
              className='flex items-start justify-between gap-4 py-4'
            >
              <div className='min-w-0'>
                <dt className='text-sm font-medium'>{label}</dt>
                <dd className='mt-1 text-sm leading-relaxed text-muted-foreground'>
                  {description}
                </dd>
              </div>
              <StatusBadge muted={permissions[capability] === 'none'}>
                {permissions[capability] === 'full'
                  ? copy.permissionGranted
                  : permissions[capability] === 'partial'
                    ? copy.permissionPartial
                    : copy.permissionNotGranted}
              </StatusBadge>
            </div>
          ))}
        </dl>
        {permissions.legacy && (
          <p className='text-sm leading-relaxed text-muted-foreground'>
            {copy.legacyPermissions}
          </p>
        )}
        <dl className='grid gap-4 text-sm leading-6'>
          <div>
            <dt className='font-medium'>{copy.allowedActions}</dt>
            <dd className='mt-1 space-y-1 text-muted-foreground'>
              {canRead && <p>{copy.readCapabilities}</p>}
              {canWrite && <p>{copy.writeCapabilities}</p>}
              {canPatch && <p>{copy.patchCapabilities}</p>}
              {canWrite && <p>{copy.managementCapabilities}</p>}
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
    scope_names: token.scope_names,
    scope_model: token.scope_model,
    status: token.status,
    created_at: token.created_at,
    updated_at: token.updated_at,
    expires_at: token.expires_at,
    revoked_at: token.revoked_at,
    revoked_by: token.revoked_by,
    last_used_at: token.last_used_at,
  }
}
