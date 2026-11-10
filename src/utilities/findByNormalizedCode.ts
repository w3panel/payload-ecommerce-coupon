import type { SanitizedCouponPluginOptions } from '../types'
import { type TenantId, tenantWhere } from './tenant'

/**
 * Find a coupon or referral code by its normalized (trimmed, uppercased) code, falling back to
 * the raw `code` field for documents saved before `normalizedCode` existed.
 *
 * With tenant scoping on, only documents of `tenantId` match.
 */
export async function findByNormalizedCode({
  payload,
  collection,
  normalizedCode,
  pluginConfig,
  tenantId = null,
}: {
  payload: any
  collection: string
  normalizedCode: string
  pluginConfig: SanitizedCouponPluginOptions
  tenantId?: TenantId | null
}): Promise<any | null> {
  // No tenant on a scoped request: match nothing rather than every tenant's codes.
  if (pluginConfig.multiTenant.enabled && tenantId == null) return null

  const scope = tenantWhere(pluginConfig, tenantId)
  const candidates: Record<string, unknown>[] = [
    { normalizedCode: { equals: normalizedCode } },
    { code: { equals: normalizedCode.toLowerCase() } },
    { code: { equals: normalizedCode } },
  ]

  for (const match of candidates) {
    const result = await payload.find({
      collection,
      where: scope.length ? { and: [match, ...scope] } : match,
      limit: 1,
      // Lookup only: the endpoint checks who may apply a code. Shoppers cannot read these
      // collections, so without this every code (valid or not) threw Forbidden -> 500.
      overrideAccess: true,
    })
    if (result?.docs?.[0]) return result.docs[0]
  }

  return null
}
