import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod/mini'
import { SignIn } from '@/features/auth/sign-in'

const searchSchema = z.object({
  redirect: z.optional(z.string()),
})

export const Route = createFileRoute('/(auth)/sign-in')({
  component: SignIn,
  validateSearch: searchSchema,
})
