import { useQuery } from '@tanstack/react-query'
import { CheckCircle2 } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { apiBaseUrl, getHealth, getIdentity } from '@/lib/vdoc-api'
import { useLanguage } from '@/context/language-provider'
import { useTheme } from '@/context/theme-provider'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AISettingsPanel } from './ai-settings'
import { PageChrome, CollectionCard } from './page-shared'

export function SettingsPage() {
  const { t, language } = useLanguage()
  const { theme, resolvedTheme } = useTheme()
  const authUser = useAuthStore((state) => state.auth.user)
  const identityQuery = useQuery({
    queryKey: ['identity'],
    queryFn: ({ signal }) => getIdentity({ signal }),
  })
  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => getHealth({ signal }),
  })
  const identity = identityQuery.data ?? authUser
  return (
    <PageChrome page='settings'>
      <section className='grid gap-4 md:grid-cols-2'>
        <SettingsCard
          title={t('admin.fields.identity')}
          rows={[
            [t('admin.fields.name'), identity?.name ?? '-'],
            [t('admin.fields.email'), identity?.email ?? '-'],
            [
              t('admin.fields.superAdmin'),
              identity?.is_super_admin
                ? t('admin.common.yes')
                : t('admin.common.no'),
            ],
          ]}
        />
        <SettingsCard
          title={t('admin.fields.request')}
          rows={[
            [t('admin.fields.apiBaseUrl'), apiBaseUrl],
            [t('admin.fields.health'), healthQuery.data?.status ?? '-'],
            [
              t('admin.fields.session'),
              authUser ? t('admin.statuses.active') : t('admin.common.none'),
            ],
          ]}
        />
        <SettingsCard
          title={t('admin.fields.theme')}
          rows={[
            [t('admin.fields.theme'), `${theme} / ${resolvedTheme}`],
            [t('admin.fields.language'), language],
          ]}
        />
      </section>
      {identity && <AISettingsPanel user={identity} />}
      <Alert>
        <CheckCircle2 />
        <AlertTitle>satnaing/shadcn-admin</AlertTitle>
        <AlertDescription>{t('admin.common.attribution')}</AlertDescription>
      </Alert>
    </PageChrome>
  )
}

function SettingsCard({
  title,
  rows,
}: {
  title: string
  rows: Array<[string, string]>
}) {
  return (
    <CollectionCard title={title}>
      {rows.map(([label, value]) => (
        <div
          key={label}
          className='flex justify-between gap-4 rounded-lg border p-3 text-sm'
        >
          <span className='text-muted-foreground'>{label}</span>
          <span className='text-end font-medium'>{value}</span>
        </div>
      ))}
    </CollectionCard>
  )
}
