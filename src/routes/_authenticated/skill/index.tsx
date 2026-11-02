import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/skill/')({
  beforeLoad: () => {
    throw redirect({ to: '/mcp-tokens', replace: true })
  },
})
