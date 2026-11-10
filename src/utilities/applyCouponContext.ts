/**
 * Shape of the skip-recalculate context value.
 *
 * Payload strips relationship field IDs during its internal `beforeChange` merge,
 * so we piggy-back the applied IDs here so the hook can write them back into `data`
 * before returning, ensuring they are actually persisted to the database.
 */
export type SkipRecalculateContext = {
  couponId?: string | number
  referralId?: string | number
}

/**
 * When `payload.update` is called from the apply-coupon (or referral) endpoint, that
 * handler has already computed the correct discount, commission, and total. Setting
 * this key on `req.context` (with a `SkipRecalculateContext` value) tells
 * `recalculateCart` to skip its own recalculation and pass the data through unchanged,
 * while also restoring the relationship IDs that Payload strips during its merge.
 */
export const SKIP_COUPON_RECALCULATE_CONTEXT_KEY =
  '__payloadEcommerceCouponSkipRecalculate' as const

/**
 * @deprecated Use SKIP_COUPON_RECALCULATE_CONTEXT_KEY instead.
 * Kept for any external consumers; will be removed in a future major version.
 */
export const PENDING_APPLIED_COUPON_ID_CONTEXT_KEY =
  '__payloadEcommerceCouponPendingAppliedCouponId' as const

/**
 * `appliedCoupon` / `appliedReferralCode` are only writable through the plugin's endpoints
 * (which run the tenant, min-order and per-customer checks). Other writes that set a new code,
 * such as `PATCH /api/carts/:id`, are reverted by `recalculateCart`. Admins (`access.isAdmin`)
 * are exempt; trusted server code can set this key to `true` on `req.context` to attach a code.
 * Clearing a code (`null`) is always allowed.
 */
export const ALLOW_CART_CODE_WRITE_CONTEXT_KEY = '__payloadEcommerceCouponAllowCodeWrite' as const
