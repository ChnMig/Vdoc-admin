import { ShieldCheck } from 'lucide-react'
import { resolveAdminReleaseChannel } from '@/lib/release-channel'
import { apiBaseUrl } from '@/lib/vdoc-api'
import { useLanguage } from '@/context/language-provider'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { CodeSnippet } from './code-snippet'
import { MCPClientConfig } from './mcp-client-config'
import { PageChrome, CollectionCard } from './page-shared'
import { vdocMcpReleaseVersion } from './page-utils'
import { SkillInstallPrompt } from './skill-install-prompt'

const vdocSkillInstallSnippet = `# Personal install; use .agents/skills/vdoc for repository scope instead.
(
  set -eu
  VDOC_SKILL_DIR="$HOME/.agents/skills/vdoc"
  VDOC_MCP_VERSION=${vdocMcpReleaseVersion}
  VDOC_MCP_PACKAGE_DIR="$(mktemp -d)"
  trap 'rm -rf -- "$VDOC_MCP_PACKAGE_DIR"' EXIT
  VDOC_MCP_RELEASE="https://github.com/ChnMig/Vdoc-mcp/releases/download/v$VDOC_MCP_VERSION"
  curl -fsSL "$VDOC_MCP_RELEASE/vdoc-mcp-$VDOC_MCP_VERSION.tgz" -o "$VDOC_MCP_PACKAGE_DIR/vdoc-mcp-$VDOC_MCP_VERSION.tgz"
  curl -fsSL "$VDOC_MCP_RELEASE/SHA256SUMS" -o "$VDOC_MCP_PACKAGE_DIR/SHA256SUMS"
  (cd "$VDOC_MCP_PACKAGE_DIR" && shasum -a 256 -c SHA256SUMS)
  npm install --global "$VDOC_MCP_PACKAGE_DIR/vdoc-mcp-$VDOC_MCP_VERSION.tgz"
  vdoc-mcp skill install --directory "$VDOC_SKILL_DIR"
  test -f "$VDOC_SKILL_DIR/SKILL.md"
)`

const vdocBetaSkillInstallSnippet = `# Run from a separate beta project; the Skill is scoped to this project.
(
  set -eu
  VDOC_MCP_INSTALLER_TAG='v${vdocMcpReleaseVersion}'
  VDOC_MCP_INSTALLER_DIR="$(mktemp -d)"
  trap 'rm -rf -- "$VDOC_MCP_INSTALLER_DIR"' EXIT
  VDOC_MCP_RELEASE="https://github.com/ChnMig/Vdoc-mcp/releases/download/$VDOC_MCP_INSTALLER_TAG"
  curl -fsSL "$VDOC_MCP_RELEASE/install-channel.mjs" -o "$VDOC_MCP_INSTALLER_DIR/install-channel.mjs"
  curl -fsSL "$VDOC_MCP_RELEASE/install-channel.mjs.sha256" -o "$VDOC_MCP_INSTALLER_DIR/install-channel.mjs.sha256"
  (cd "$VDOC_MCP_INSTALLER_DIR" && shasum -a 256 -c install-channel.mjs.sha256)
  VDOC_BETA_MCP_PREFIX="$HOME/.local/share/vdoc/mcp/beta"
  node "$VDOC_MCP_INSTALLER_DIR/install-channel.mjs" --channel beta --prefix "$VDOC_BETA_MCP_PREFIX"
  VDOC_SKILL_DIR="$PWD/.agents/skills/vdoc"
  "$VDOC_BETA_MCP_PREFIX/node_modules/.bin/vdoc-mcp" skill install --directory "$VDOC_SKILL_DIR"
  test -f "$VDOC_SKILL_DIR/SKILL.md"
)`

export function SkillPage() {
  const { t } = useLanguage()
  const beta = resolveAdminReleaseChannel() === 'beta'
  return (
    <PageChrome page='skill'>
      <CollectionCard
        title={t('admin.skill.installTitle')}
        description={t(
          beta
            ? 'admin.skill.betaInstallDescription'
            : 'admin.skill.installDescription'
        )}
      >
        <SkillInstallPrompt channel={beta ? 'beta' : 'release'} />
        <div className='grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]'>
          <div className='grid min-w-0 gap-6'>
            <ol className='grid gap-5'>
              {[
                {
                  title: t('admin.skill.packageStepTitle'),
                  description: t(
                    beta
                      ? 'admin.skill.betaStepPackage'
                      : 'admin.skill.stepPackage'
                  ),
                },
                {
                  title: t('admin.skill.mcpStepTitle'),
                  description: t('admin.skill.stepMcp'),
                },
                {
                  title: t('admin.skill.verifyStepTitle'),
                  description: t(
                    beta
                      ? 'admin.skill.betaStepVerify'
                      : 'admin.skill.stepVerify'
                  ),
                },
              ].map((step, index) => (
                <li
                  key={step.title}
                  className='grid min-w-0 grid-cols-[1.5rem_minmax(0,1fr)] items-start gap-3 text-sm'
                >
                  <Badge className='mt-0.5 justify-center' variant='outline'>
                    {index + 1}
                  </Badge>
                  <div className='min-w-0 space-y-2'>
                    <h3 className='leading-6 font-medium'>{step.title}</h3>
                    {index === 0 ? (
                      <details className='text-muted-foreground'>
                        <summary className='w-fit cursor-pointer rounded-sm underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'>
                          {t('admin.skill.installDetails')}
                        </summary>
                        <p className='pt-2 leading-6'>{step.description}</p>
                      </details>
                    ) : (
                      <p className='leading-6 text-muted-foreground'>
                        {step.description}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            <Alert className='rounded-none border-0 border-t bg-transparent px-0 pt-5 pb-0'>
              <ShieldCheck />
              <AlertTitle>{t('admin.skill.boundaryTitle')}</AlertTitle>
              <AlertDescription>
                {t('admin.skill.boundaryDescription')}
              </AlertDescription>
            </Alert>
          </div>
          <CodeSnippet
            title={t('admin.skill.commandTitle')}
            content={
              beta ? vdocBetaSkillInstallSnippet : vdocSkillInstallSnippet
            }
          />
        </div>
      </CollectionCard>
      <CollectionCard
        title={t('admin.token.configTitle')}
        description={t('admin.token.configDescription')}
      >
        <MCPClientConfig baseUrl={apiBaseUrl} />
      </CollectionCard>
    </PageChrome>
  )
}
