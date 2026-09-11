import { ShieldCheck } from 'lucide-react'
import { apiBaseUrl } from '@/lib/vdoc-api'
import { useLanguage } from '@/context/language-provider'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { PageChrome, CollectionCard } from './page-shared'
import { stringify, vdocMcpSource } from './page-utils'

const vdocSkillCommit = '9f3a1807e7cd09c677475b4a2397faff2a985829'

const vdocSkillInstallSnippet = `# Personal install; use .agents/skills/vdoc for repository scope instead.
VDOC_SKILL_DIR="$HOME/.agents/skills/vdoc"
VDOC_SKILL_COMMIT=${vdocSkillCommit}
test ! -e "$VDOC_SKILL_DIR"
mkdir -p "$(dirname -- "$VDOC_SKILL_DIR")"
git init "$VDOC_SKILL_DIR"
git -C "$VDOC_SKILL_DIR" remote add origin https://github.com/ChnMig/Vdoc-skill.git
git -C "$VDOC_SKILL_DIR" fetch --depth 1 origin "$VDOC_SKILL_COMMIT"
git -C "$VDOC_SKILL_DIR" checkout --detach FETCH_HEAD
test "$(git -C "$VDOC_SKILL_DIR" rev-parse HEAD)" = "$VDOC_SKILL_COMMIT"
test -f "$VDOC_SKILL_DIR/SKILL.md"`

export function SkillPage() {
  const { t } = useLanguage()
  return (
    <PageChrome page='skill'>
      <CollectionCard
        title={t('admin.skill.installTitle')}
        description={t('admin.skill.installDescription')}
      >
        <ol className='grid gap-3'>
          {[
            t('admin.skill.stepPackage'),
            t('admin.skill.stepMcp'),
            t('admin.skill.stepVerify'),
          ].map((step, index) => (
            <li
              key={step}
              className='grid grid-cols-[2rem_1fr] items-start gap-3 rounded-md border bg-[var(--surface-control)] p-4 text-sm'
            >
              <Badge className='justify-center' variant='outline'>
                {index + 1}
              </Badge>
              <span className='leading-6'>{step}</span>
            </li>
          ))}
        </ol>
        <pre className='overflow-x-auto rounded-md border bg-background p-4 text-xs leading-relaxed'>
          {vdocSkillInstallSnippet}
        </pre>
      </CollectionCard>
      <Alert>
        <ShieldCheck />
        <AlertTitle>{t('admin.skill.boundaryTitle')}</AlertTitle>
        <AlertDescription>
          {t('admin.skill.boundaryDescription')}
        </AlertDescription>
      </Alert>
      <CollectionCard
        title={t('admin.token.configTitle')}
        description={t('admin.token.configDescription')}
      >
        <pre className='overflow-x-auto rounded-md border bg-[var(--surface-control)] p-4 text-xs leading-relaxed'>
          {stringify({
            mcpServers: {
              vdoc: {
                command: 'npx',
                args: ['--yes', vdocMcpSource],
                env: {
                  VDOC_BASE_URL: apiBaseUrl,
                  VDOC_MCP_TOKEN: '<YOUR_ACTIVE_VDOC_TOKEN>',
                },
              },
            },
          })}
        </pre>
      </CollectionCard>
    </PageChrome>
  )
}
