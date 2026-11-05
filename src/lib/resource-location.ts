export type ResourcePathScope = {
  projectId: string
  projectName?: string
  teamId?: string
  teamName?: string
}

export function resourceLocation(
  scope: ResourcePathScope,
  path: string | undefined,
  documentId?: string
): string | undefined {
  if (!scope.projectId || path === undefined) return undefined
  return JSON.stringify(
    {
      team_id: scope.teamId,
      team_name: scope.teamName,
      project_id: scope.projectId,
      project_name: scope.projectName,
      ...(documentId
        ? { document_id: documentId, relative_path: path }
        : { path }),
    },
    null,
    2
  )
}
