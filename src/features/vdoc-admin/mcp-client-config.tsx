import { useLanguage } from '@/context/language-provider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { stringify, vdocMcpSource } from './page-utils'

export function MCPClientConfig({
  baseUrl,
  token = '<YOUR_ACTIVE_VDOC_TOKEN>',
}: {
  baseUrl: string
  token?: string
}) {
  const { t } = useLanguage()
  const codex = `[mcp_servers.vdoc]
command = "npx"
args = ["--yes", ${JSON.stringify(vdocMcpSource)}]
startup_timeout_sec = 60
tool_timeout_sec = 180

[mcp_servers.vdoc.env]
VDOC_BASE_URL = ${JSON.stringify(baseUrl)}
VDOC_MCP_TOKEN = ${JSON.stringify(token)}`
  const cursor = stringify({
    mcpServers: {
      vdoc: {
        command: 'npx',
        args: ['--yes', vdocMcpSource],
        env: { VDOC_BASE_URL: baseUrl, VDOC_MCP_TOKEN: token },
      },
    },
  })
  return (
    <Tabs defaultValue='codex'>
      <TabsList aria-label={t('admin.token.clientLabel')}>
        <TabsTrigger value='codex'>Codex</TabsTrigger>
        <TabsTrigger value='cursor'>Cursor</TabsTrigger>
      </TabsList>
      {(
        [
          ['codex', '~/.codex/config.toml', codex, t('admin.token.codexSteps')],
          [
            'cursor',
            '~/.cursor/mcp.json',
            cursor,
            t('admin.token.cursorSteps'),
          ],
        ] as const
      ).map(([client, path, content, steps]) => (
        <TabsContent key={client} value={client} className='space-y-3'>
          <p className='text-sm text-muted-foreground'>
            <code>{path}</code> — {steps}
          </p>
          <pre className='overflow-x-auto rounded-md border bg-[var(--surface-control)] p-4 text-xs leading-relaxed'>
            {content}
          </pre>
        </TabsContent>
      ))}
      <p className='mt-3 text-sm text-muted-foreground'>
        {t('admin.token.clientVerify')}
      </p>
    </Tabs>
  )
}
