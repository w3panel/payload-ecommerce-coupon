import { APIError } from 'payload'

import type { SanitizedCouponPluginOptions } from '../types'
import { type RelationValue, relationId } from './relationId'

export type TenantId = string | number

const TENANT_HEADER = 'x-tenant'
const TENANT_COOKIE = 'payload-tenant'

function readHeader(req: any, name: string): string | null {
  const headers = req?.headers
  if (!headers) return null
  if (typeof headers.get === 'function') return headers.get(name)
  const value = headers[name]
  return typeof value === 'string' ? value : null
}

function readCookie(req: any, name: string): string | null {
  const header = readHeader(req, 'cookie')
  if (!header) return null
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    if (part.slice(0, eq).trim() !== name) continue
    try {
      return decodeURIComponent(part.slice(eq + 1).trim())
    } catch {
      return part.slice(eq + 1).trim()
    }
  }
  return null
}

function cleanId(value: unknown): TenantId | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  return null
}

/**
 * Tenant for a coupon request, or null when tenant scoping is off.
 * Order: custom `resolveTenant`, the cart's tenant field, `x-tenant` header, `payload-tenant` cookie.
 * The cart wins over the request so a shopper cannot redeem another tenant's code by
 * switching their cookie.
 */
export async function resolveTenantId({
  pluginConfig,
  req,
  cart,
}: {
  pluginConfig: SanitizedCouponPluginOptions
  req: unknown
  cart?: unknown
}): Promise<TenantId | null> {
  const { enabled, tenantField, resolveTenant } = pluginConfig.multiTenant
  if (!enabled) return null

  if (resolveTenant) {
    return cleanId(relationId((await resolveTenant({ req, cart })) as RelationValue))
  }

  if (cart && typeof cart === 'object') {
    const fromCart = relationId((cart as Record<string, unknown>)[tenantField] as RelationValue)
    if (fromCart != null) return fromCart
  }

  return cleanId(readHeader(req, TENANT_HEADER)) ?? cleanId(readCookie(req, TENANT_COOKIE))
}

/** Where clause fragment limiting a query to one tenant (empty when scoping is off). */
export function tenantWhere(
  pluginConfig: SanitizedCouponPluginOptions,
  tenantId: TenantId | null,
): Record<string, unknown>[] {
  if (!pluginConfig.multiTenant.enabled || tenantId == null) return []
  return [{ [pluginConfig.multiTenant.tenantField]: { equals: tenantId } }]
}

/**
 * With tenant scoping on, `code` is unique per tenant rather than per collection (the DB-level
 * `unique` index is dropped). Throws a 400 when another document of the same tenant has the code.
 */
export async function assertCodeUniqueInTenant({
  pluginConfig,
  req,
  collection,
  data,
  originalDoc,
}: {
  pluginConfig: SanitizedCouponPluginOptions
  req: any
  collection: string
  data: Record<string, unknown> | undefined
  originalDoc?: Record<string, unknown>
}): Promise<void> {
  if (!pluginConfig.multiTenant.enabled || !data || !req?.payload) return
  const normalizedCode = data.normalizedCode
  if (typeof normalizedCode !== 'string' || normalizedCode.length === 0) return

  const field = pluginConfig.multiTenant.tenantField
  const tenantId = relationId((field in data ? data[field] : originalDoc?.[field]) as RelationValue)
  const ownId = relationId(originalDoc?.id as RelationValue)

  const and: Record<string, unknown>[] = [
    { normalizedCode: { equals: normalizedCode } },
    tenantId != null ? { [field]: { equals: tenantId } } : { [field]: { exists: false } },
  ]
  if (ownId != null) and.push({ id: { not_equals: ownId } })

  const existing = await req.payload.find({
    collection,
    where: { and },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    req,
  })
  if (existing?.docs?.length) {
    throw new APIError(
      `The code "${String(data.code ?? normalizedCode)}" already exists for this tenant`,
      400,
    )
  }
}
