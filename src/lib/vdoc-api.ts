import axios from 'axios'
import { useAuthStore, type AuthUser } from '@/stores/auth-store'

export type VdocEnvelope<T> = {
  code: number
  status: string
  description?: string
  message?: string
  detail?: T
  total?: number
  trace_id?: string
  timestamp: number
}

type VdocSession = {
  user: AuthUser
  token: string
}

type LoginPayload = {
  email: string
  password: string
}

type RegisterPayload = LoginPayload & {
  name?: string
}

export class VdocApiError extends Error {
  envelope: VdocEnvelope<unknown>
  code: number
  status: string

  constructor(envelope: VdocEnvelope<unknown>) {
    super(envelope.message || envelope.description || envelope.status)
    this.name = 'VdocApiError'
    this.envelope = envelope
    this.code = envelope.code
    this.status = envelope.status
  }
}

const apiBaseUrl =
  import.meta.env.VITE_VDOC_API_BASE_URL?.replace(/\/$/, '') ||
  'http://127.0.0.1:8080'

export const vdocApi = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
})

vdocApi.interceptors.request.use((config) => {
  const token = useAuthStore.getState().auth.accessToken
  if (token) {
    config.headers.Authorization = token
  }
  return config
})

export async function unwrapEnvelope<T>(request: Promise<{ data: VdocEnvelope<T> }>) {
  const response = await request
  const envelope = response.data

  if (envelope.code !== 200 || envelope.status !== 'OK') {
    throw new VdocApiError(envelope as VdocEnvelope<unknown>)
  }

  return envelope.detail as T
}

export function login(payload: LoginPayload) {
  return unwrapEnvelope<VdocSession>(
    vdocApi.post('/api/v1/open/auth/login', payload)
  )
}

export function register(payload: RegisterPayload) {
  return unwrapEnvelope<VdocSession>(
    vdocApi.post('/api/v1/open/auth/register', payload)
  )
}

export function getIdentity() {
  return unwrapEnvelope<AuthUser>(vdocApi.get('/api/v1/private/identity/me'))
}
