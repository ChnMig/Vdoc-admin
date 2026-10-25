import type { ComponentProps } from 'react'
import { Link } from '@tanstack/react-router'
import {
  clearDocumentContext,
  isWorkspaceEntryPath,
} from '@/lib/document-workspace-navigation'
import type { NavLink } from './types'

export function NavigationLink({
  to,
  ...props
}: Omit<ComponentProps<'a'>, 'href'> & {
  to: NavLink['url']
}) {
  return isWorkspaceEntryPath(to) ? (
    <Link to='/documents' search={clearDocumentContext} {...props} />
  ) : (
    <Link to={to} search={true} {...props} />
  )
}
