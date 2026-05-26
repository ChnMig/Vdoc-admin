import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'

type VdocPlaceholderPageProps = {
  title: string
  description: string
  endpoint: string
}

export function VdocPlaceholderPage({
  title,
  description,
  endpoint,
}: VdocPlaceholderPageProps) {
  return (
    <>
      <Header>
        <Search />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>
      <Main>
        <div className='mb-6 space-y-2'>
          <p className='text-sm font-medium text-muted-foreground'>Vdoc Console</p>
          <h1 className='text-2xl font-bold tracking-tight'>{title}</h1>
          <p className='max-w-3xl text-muted-foreground'>{description}</p>
        </div>
        <Card className='max-w-3xl'>
          <CardHeader>
            <CardTitle>API integration placeholder</CardTitle>
            <CardDescription>
              This starter keeps the Vdoc Admin shell ready while the data table
              wiring is connected to the Vdoc backend.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='rounded-lg border bg-muted/40 p-4 font-mono text-sm text-muted-foreground'>
              {endpoint}
            </div>
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
