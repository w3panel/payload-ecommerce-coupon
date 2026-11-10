import {
  addDataAndFileToRequest,
  type Endpoint,
  type PayloadHandler,
  type PayloadRequest,
} from 'payload'

import type { SanitizedCouponPluginOptions } from '../types'

type Args = {
  pluginConfig: SanitizedCouponPluginOptions
}

async function readBody(req: any): Promise<Record<string, unknown>> {
  if (req?.data && typeof req.data === 'object') return req.data as Record<string, unknown>
  try {
    await addDataAndFileToRequest(req)
  } catch {
    // Non-standard (test/mocked) request; fall back to req.json below.
  }
  if (req?.data && typeof req.data === 'object') return req.data as Record<string, unknown>
  try {
    const parsed = await req?.json?.()
    if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>
  } catch {
    // Empty or malformed body.
  }
  return {}
}

const NOT_FOUND = () => Response.json({ success: false, error: 'Cart not found' }, { status: 404 })

/**
 * Clears the applied coupon and referral code from a cart.
 *
 * Runs with the caller's own cart access (`overrideAccess: false`), so only the cart's owner,
 * or a guest holding the cart secret, can remove its code. The `recalculateCart` hook then
 * resets the discount fields and restores `total` to the subtotal.
 */
export const removeCouponHandler =
  ({ pluginConfig }: Args): PayloadHandler =>
  async (req) => {
    const { payload } = req
    const fields = pluginConfig.integration.fields
    const cartsSlug = pluginConfig.integration.collections.cartsSlug
    const data = await readBody(req)

    const cartIDRaw = data.cartID
    const cartID = typeof cartIDRaw === 'string' || typeof cartIDRaw === 'number' ? cartIDRaw : null
    if (cartID == null || cartID === '') {
      return Response.json({ success: false, error: 'Cart ID is required' }, { status: 400 })
    }

    const secret =
      typeof data.secret === 'string' && data.secret.trim().length > 0
        ? data.secret.trim()
        : undefined

    if (!req.user && !secret) return NOT_FOUND()

    const reqForCart = (
      secret ? { ...req, context: { ...(req.context || {}), cartSecret: secret } } : req
    ) as PayloadRequest

    try {
      const cart = await payload.findByID({
        collection: cartsSlug as any,
        id: cartID,
        depth: 0,
        overrideAccess: false,
        req: reqForCart,
      })
      if (!cart) return NOT_FOUND()
    } catch {
      return NOT_FOUND()
    }

    const update: Record<string, unknown> = {
      [fields.cartAppliedCouponField]: null,
      [fields.cartDiscountAmountField]: 0,
    }
    if (pluginConfig.enableReferrals) {
      update[fields.cartAppliedReferralCodeField] = null
      update[fields.cartCustomerDiscountField] = 0
      update[fields.cartPartnerCommissionField] = 0
    }

    try {
      await payload.update({
        collection: cartsSlug as any,
        id: cartID,
        data: update,
        overrideAccess: false,
        req: reqForCart,
      })
    } catch (error) {
      console.error('Code removal error:', error)
      return Response.json({ success: false, error: 'Could not remove code' }, { status: 500 })
    }

    return Response.json({ success: true, message: 'Code removed' })
  }

export const removeCouponEndpoint = ({ pluginConfig }: Args): Endpoint => ({
  path: pluginConfig.endpoints.removeCoupon,
  method: 'post',
  handler: removeCouponHandler({ pluginConfig }),
})
