import { resolveAdminReleaseChannel } from '@/lib/release-channel'
import { useLanguage } from '@/context/language-provider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CodeSnippet } from './code-snippet'
import { stringify, vdocMcpSource } from './page-utils'

export function MCPClientConfig({
  baseUrl,
  token = '<YOUR_ACTIVE_VDOC_TOKEN>',
}: {
  baseUrl: string
  token?: string
}) {
  const { t } = useLanguage()
  const beta = resolveAdminReleaseChannel() === 'beta'
  const serverName = beta ? 'vdoc_beta' : 'vdoc'
  const command = beta ? '<ABSOLUTE_BETA_MCP_PATH>' : 'npx'
  const args = beta
    ? ''
    : `\nargs = ["--yes", ${JSON.stringify(vdocMcpSource)}]`
  const codex = `[mcp_servers.${serverName}]
command = ${JSON.stringify(command)}${args}
startup_timeout_sec = 60
tool_timeout_sec = 180

[mcp_servers.${serverName}.env]
VDOC_BASE_URL = ${JSON.stringify(baseUrl)}
VDOC_MCP_TOKEN = ${JSON.stringify(token)}`
  const cursor = stringify({
    mcpServers: {
      [serverName]: {
        command,
        ...(beta ? {} : { args: ['--yes', vdocMcpSource] }),
        env: { VDOC_BASE_URL: baseUrl, VDOC_MCP_TOKEN: token },
      },
    },
  })
  return (
    <Tabs defaultValue='codex' className='min-w-0'>
      {beta && (
        <p className='mb-3 text-sm text-muted-foreground'>
          {t('admin.token.betaClientSetup')}
        </p>
      )}
      <TabsList aria-label={t('admin.token.clientLabel')}>
        <TabsTrigger value='codex'>Codex</TabsTrigger>
        <TabsTrigger value='cursor'>Cursor</TabsTrigger>
      </TabsList>
      {(
        [
          [
            'codex',
            '~/.codex/config.toml',
            codex,
            t(beta ? 'admin.token.betaCodexSteps' : 'admin.token.codexSteps'),
          ],
          [
            'cursor',
            '~/.cursor/mcp.json',
            cursor,
            t(beta ? 'admin.token.betaCursorSteps' : 'admin.token.cursorSteps'),
          ],
        ] as const
      ).map(([client, path, content, steps]) => (
        <TabsContent key={client} value={client} className='min-w-0 space-y-3'>
          <p className='text-sm text-muted-foreground'>
            <code>{path}</code> — {steps}
          </p>
          <CodeSnippet title={path} content={content} />
        </TabsContent>
      ))}
      <p className='mt-3 text-sm text-muted-foreground'>
        {t('admin.token.clientVerify')}
      </p>
    </Tabs>
  )
}
