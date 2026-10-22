import { ShieldCheck } from 'lucide-react'
import { resolveAdminReleaseChannel } from '@/lib/release-channel'
import { apiBaseUrl } from '@/lib/vdoc-api'
import { useLanguage } from '@/context/language-provider'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { MCPClientConfig } from './mcp-client-config'
import { PageChrome, CollectionCard } from './page-shared'
import { vdocMcpReleaseVersion } from './page-utils'

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
        <ol className='grid gap-3'>
          {[
            t(beta ? 'admin.skill.betaStepPackage' : 'admin.skill.stepPackage'),
            t('admin.skill.stepMcp'),
            t(beta ? 'admin.skill.betaStepVerify' : 'admin.skill.stepVerify'),
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
          {beta ? vdocBetaSkillInstallSnippet : vdocSkillInstallSnippet}
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
        <MCPClientConfig baseUrl={apiBaseUrl} />
      </CollectionCard>
    </PageChrome>
  )
}
