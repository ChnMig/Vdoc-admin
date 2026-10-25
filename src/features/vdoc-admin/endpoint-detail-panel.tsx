import type { EndpointDTO } from '@/lib/vdoc-api'
import { useLanguage } from '@/context/language-provider'
import { Badge } from '@/components/ui/badge'
import { jsonPreview, methodLabel } from './page-utils'

export function EndpointDetailPanel({ endpoint }: { endpoint: EndpointDTO }) {
  const { t } = useLanguage()
  const untaggedLabel = t('admin.developerPortal.untagged')
  return (
    <section className='grid min-w-0 content-start gap-5 border-t pt-5 lg:border-s lg:border-t-0 lg:ps-5 lg:pt-0'>
      <div className='grid gap-2'>
        <h3 className='flex min-w-0 flex-wrap items-center gap-2 font-semibold'>
          <Badge variant='outline'>{methodLabel(endpoint.method)}</Badge>
          <code className='font-mono text-sm break-all'>{endpoint.path}</code>
        </h3>
        <p className='text-sm text-muted-foreground'>
          {endpoint.summary ??
            endpoint.operation_id ??
            t('admin.developerPortal.noEndpointSummary')}
        </p>
      </div>
      <div className='grid min-w-0 gap-5'>
        <section className='grid min-w-0 gap-4 sm:grid-cols-2'>
          <div className='min-w-0'>
            <p className='text-xs font-medium text-muted-foreground'>
              {t('admin.developerPortal.operationId')}
            </p>
            <p className='mt-1 font-mono text-sm break-all'>
              {endpoint.operation_id ?? t('admin.common.none')}
            </p>
          </div>
          <div className='min-w-0'>
            <p className='text-xs font-medium text-muted-foreground'>
              {t('admin.developerPortal.tags')}
            </p>
            <div className='mt-2 flex flex-wrap gap-1.5'>
              {(endpoint.tags?.length ? endpoint.tags : [untaggedLabel]).map(
                (tag) => (
                  <Badge key={tag} variant='secondary'>
                    {tag}
                  </Badge>
                )
              )}
            </div>
          </div>
        </section>
        <EndpointJsonSection
          title={t('admin.fields.request')}
          rows={[
            [
              t('admin.developerPortal.parameters'),
              endpoint.parameters,
              endpoint.json_preview?.parameters,
            ],
            [
              t('admin.developerPortal.requestBody'),
              endpoint.request_body,
              endpoint.json_preview?.request_body,
            ],
          ]}
        />
        <EndpointJsonSection
          title={t('admin.fields.response')}
          rows={[
            [
              t('admin.developerPortal.responses'),
              endpoint.responses,
              endpoint.json_preview?.responses,
            ],
          ]}
        />
        <EndpointJsonSection
          title={t('admin.developerPortal.runtime')}
          rows={[
            [
              t('admin.developerPortal.security'),
              endpoint.security,
              endpoint.json_preview?.security,
            ],
            [
              t('admin.developerPortal.servers'),
              endpoint.servers,
              endpoint.json_preview?.servers,
            ],
            [
              t('admin.developerPortal.schemaRefs'),
              endpoint.schema_refs,
              endpoint.json_preview?.schema_refs,
            ],
            [
              t('admin.developerPortal.normalizedOperation'),
              endpoint.normalized_operation,
              endpoint.json_preview?.normalized_operation,
            ],
          ]}
        />
      </div>
    </section>
  )
}

function EndpointJsonSection({
  title,
  rows,
}: {
  title: string
  rows: Array<[string, unknown, string?]>
}) {
  return (
    <section className='grid min-w-0 gap-3 border-t pt-4'>
      <p className='font-medium'>{title}</p>
      <div className='grid gap-3'>
        {rows.map(([label, value, exactJSON]) => (
          <div key={label} className='grid min-w-0 gap-2'>
            <p className='text-xs font-medium text-muted-foreground'>{label}</p>
            <pre className='max-h-80 overflow-auto rounded-md border bg-background p-3 text-xs leading-relaxed'>
              {jsonPreview(value, exactJSON)}
            </pre>
          </div>
        ))}
      </div>
    </section>
  )
}
