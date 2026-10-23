export type AdminBuildInfo = {
  version: string
  gitCommit: string
  buildTime: string
}

export const adminBuildInfo: Readonly<AdminBuildInfo> =
  __VDOC_ADMIN_BUILD_INFO__
