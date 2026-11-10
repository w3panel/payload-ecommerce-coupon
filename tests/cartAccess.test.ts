import { beforeEach, describe, expect, it, jest } from 'bun:test'
import { applyCouponHandler } from '../src/endpoints/applyCoupon'
import { recalculateCartHook } from '../src/hooks/recalculateCart'
import {
  ALLOW_CART_CODE_WRITE_CONTEXT_KEY,
  SKIP_COUPON_RECALCULATE_CONTEXT_KEY,
} from '../src/utilities/applyCouponContext'
import { sanitizePluginConfig } from '../src/utilities/sanitizePluginConfig'

const makePayload = () => ({
  find: jest.fn(),
  findByID: jest.fn(),
  update: jest.fn(),
})

const coupon = { id: 'c1', code: 'WELCOME10', type: 'percentage', value: 10 }

describe('apply endpoint uses the caller cart access', () => {
  const pluginConfig = sanitizePluginConfig({ pluginConfig: { enabled: true } })
  let payload: ReturnType<typeof makePayload>

  beforeEach(() => {
    payload = makePayload()
  })

  it('refuses anonymous callers without a cart secret, before reading the cart', async () => {
    const resp = await applyCouponHandler({ pluginConfig })({
      payload,
      data: { code: 'WELCOME10', cartID: 1 },
    } as any)

    expect(resp.status).toBe(404)
    expect(payload.findByID).not.toHaveBeenCalled()
    expect(payload.update).not.toHaveBeenCalled()
  })

  it('returns 404 (not the discount) when the caller cannot read the cart', async () => {
    payload.findByID.mockRejectedValue(new Error('Not Found'))

    const resp = await applyCouponHandler({ pluginConfig })({
      payload,
      user: { id: 'someone-else' },
      data: { code: 'WELCOME10', cartID: 1 },
    } as any)
    const body = await resp.json()

    expect(resp.status).toBe(404)
    expect(body.discount).toBeUndefined()
    expect(body.alreadyApplied).toBeUndefined()
    expect(payload.find).not.toHaveBeenCalled()
    expect(payload.update).not.toHaveBeenCalled()
  })

  it('reads and writes the cart with overrideAccess false and the guest secret', async () => {
    payload.findByID.mockResolvedValue({ id: 'cart-1', subtotal: 100, total: 100 })
    payload.find.mockResolvedValue({ docs: [coupon] })
    payload.update.mockResolvedValue({})

    const resp = await applyCouponHandler({ pluginConfig })({
      payload,
      data: { code: 'WELCOME10', cartID: 'cart-1', secret: 'sek' },
    } as any)

    expect(resp.status).toBe(200)
    const read = payload.findByID.mock.calls[0][0]
    expect(read.overrideAccess).toBe(false)
    expect(read.req.context.cartSecret).toBe('sek')
    const write = payload.update.mock.calls[0][0]
    expect(write.overrideAccess).toBe(false)
    expect(write.req.context.cartSecret).toBe('sek')
    expect(write.req.context[SKIP_COUPON_RECALCULATE_CONTEXT_KEY]).toEqual({ couponId: 'c1' })
  })
})

describe('recalculateCart only accepts codes from the plugin endpoints', () => {
  const pluginConfig = sanitizePluginConfig({ pluginConfig: { enabled: true } })
  const items = [{ product: 'p1', quantity: 1 }]

  const makeReq = (extra: Record<string, unknown> = {}) => {
    const find = jest.fn((args: any) => {
      if (args.collection === 'products')
        return Promise.resolve({ docs: [{ id: 'p1', price: 100 }] })
      if (args.collection === 'coupons') return Promise.resolve({ docs: [coupon] })
      return Promise.resolve({ docs: [] })
    })
    return { payload: { find, findByID: jest.fn() }, ...extra } as any
  }

  it('reverts a coupon written straight to a cart that had none', async () => {
    const hook = recalculateCartHook(pluginConfig)
    const req = makeReq()
    const result: any = await hook({
      data: { items, appliedCoupon: 'c1' },
      originalDoc: { id: 1, items, appliedCoupon: null },
      req,
    } as any)

    expect(result.appliedCoupon).toBeNull()
    expect(result.discountAmount).toBe(0)
    expect(result.total).toBe(100)
    expect(req.payload.find.mock.calls.some(([a]: any) => a.collection === 'coupons')).toBe(false)
  })

  it('reverts a swap to a different coupon and keeps the original one', async () => {
    const hook = recalculateCartHook(pluginConfig)
    const req = makeReq()
    const result: any = await hook({
      data: { items, appliedCoupon: 'c-other' },
      originalDoc: { id: 1, items, appliedCoupon: 'c1' },
      req,
    } as any)

    expect(result.appliedCoupon).toBe('c1')
    expect(result.discountAmount).toBe(10)
  })

  it('reverts a referral code written straight to the cart', async () => {
    const hook = recalculateCartHook(
      sanitizePluginConfig({ pluginConfig: { enabled: true, enableReferrals: true } }),
    )
    const result: any = await hook({
      data: { items, appliedReferralCode: 'r1' },
      originalDoc: { id: 1, items },
      req: makeReq(),
    } as any)

    expect(result.appliedReferralCode ?? null).toBeNull()
    expect(result.customerDiscount ?? 0).toBe(0)
  })

  it('still lets a write clear the code', async () => {
    const hook = recalculateCartHook(pluginConfig)
    const result: any = await hook({
      data: { items, appliedCoupon: null },
      originalDoc: { id: 1, items, appliedCoupon: 'c1', discountAmount: 10 },
      req: makeReq(),
    } as any)

    expect(result.appliedCoupon).toBeNull()
    expect(result.total).toBe(100)
  })

  it('keeps a write that repeats the code already on the cart (populated relation)', async () => {
    const hook = recalculateCartHook(pluginConfig)
    const result: any = await hook({
      data: { items, appliedCoupon: { id: 'c1', code: 'WELCOME10' } },
      originalDoc: { id: 1, items, appliedCoupon: 'c1' },
      req: makeReq(),
    } as any)

    expect(result.discountAmount).toBe(10)
  })

  it('accepts the code from trusted server code via the context flag', async () => {
    const hook = recalculateCartHook(pluginConfig)
    const result: any = await hook({
      data: { items, appliedCoupon: 'c1' },
      originalDoc: { id: 1, items },
      req: makeReq({ context: { [ALLOW_CART_CODE_WRITE_CONTEXT_KEY]: true } }),
    } as any)

    expect(result.appliedCoupon).toBe('c1')
    expect(result.discountAmount).toBe(10)
  })

  it('accepts the code from an admin', async () => {
    const hook = recalculateCartHook(
      sanitizePluginConfig({ pluginConfig: { enabled: true, access: { isAdmin: () => true } } }),
    )
    const result: any = await hook({
      data: { items, appliedCoupon: 'c1' },
      originalDoc: { id: 1, items },
      req: makeReq({ user: { id: 'admin' } }),
    } as any)

    expect(result.discountAmount).toBe(10)
  })

  it('does not treat an isAdmin query constraint as admin', async () => {
    const hook = recalculateCartHook(
      sanitizePluginConfig({
        pluginConfig: { enabled: true, access: { isAdmin: () => ({ id: { equals: 1 } }) as any } },
      }),
    )
    const result: any = await hook({
      data: { items, appliedCoupon: 'c1' },
      originalDoc: { id: 1, items },
      req: makeReq({ user: { id: 'u1' } }),
    } as any)

    expect(result.appliedCoupon ?? null).toBeNull()
  })
})

describe('recalculateCart checks the code tenant', () => {
  const pluginConfig = sanitizePluginConfig({
    pluginConfig: { enabled: true, enableReferrals: true, multiTenant: { enabled: true } },
  })
  const items = [{ product: 'p1', quantity: 1 }]

  const makeReq = (docs: Record<string, any>) =>
    ({
      payload: {
        find: jest.fn((args: any) => {
          if (args.collection === 'products')
            return Promise.resolve({ docs: [{ id: 'p1', price: 100 }] })
          return Promise.resolve({ docs: docs[args.collection] ? [docs[args.collection]] : [] })
        }),
        findByID: jest.fn(),
      },
    }) as any

  it("clears a coupon that belongs to another tenant than the cart's", async () => {
    const hook = recalculateCartHook(pluginConfig)
    const result: any = await hook({
      data: { items },
      originalDoc: { id: 1, items, tenant: 't-a', appliedCoupon: 'c1', discountAmount: 10 },
      req: makeReq({ coupons: { ...coupon, tenant: { id: 't-b' } } }),
    } as any)

    expect(result.appliedCoupon).toBeNull()
    expect(result.discountAmount).toBe(0)
    expect(result.total).toBe(100)
  })

  it("keeps a coupon from the cart's tenant", async () => {
    const hook = recalculateCartHook(pluginConfig)
    const result: any = await hook({
      data: { items },
      originalDoc: { id: 1, items, tenant: { id: 't-a' }, appliedCoupon: 'c1' },
      req: makeReq({ coupons: { ...coupon, tenant: 't-a' } }),
    } as any)

    expect(result.discountAmount).toBe(10)
    expect(result.total).toBe(90)
  })

  it("clears a referral code from another tenant than the cart's", async () => {
    const hook = recalculateCartHook(pluginConfig)
    const result: any = await hook({
      data: { items },
      originalDoc: { id: 1, items, tenant: 't-a', appliedReferralCode: 'r1' },
      req: makeReq({
        'referral-codes': {
          id: 'r1',
          isActive: true,
          tenant: 't-b',
          program: { id: 'p', isActive: true, commissionRules: [] },
        },
      }),
    } as any)

    expect(result.appliedReferralCode).toBeNull()
    expect(result.customerDiscount).toBe(0)
  })
})
