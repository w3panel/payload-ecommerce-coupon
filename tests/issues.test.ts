import { describe, it, expect, jest, beforeEach } from 'bun:test'
import { applyCouponHandler } from '../src/endpoints/applyCoupon'
import { removeCouponHandler } from '../src/endpoints/removeCoupon'
import { validateCouponHandler } from '../src/endpoints/validateCoupon'
import { createCouponsCollection } from '../src/collections/createCouponsCollection'
import { sanitizePluginConfig } from '../src/utilities/sanitizePluginConfig'

const makePayload = () => ({
  find: jest.fn(),
  findByID: jest.fn(),
  update: jest.fn(),
})

const coupon = { id: 'c1', code: 'WELCOME10', type: 'percentage', value: 10 }

describe('#13 coupon stays removable after reload', () => {
  const pluginConfig = sanitizePluginConfig({ pluginConfig: { enabled: true } })
  let payload: ReturnType<typeof makePayload>

  beforeEach(() => {
    payload = makePayload()
  })

  it('re-applying the code already on the cart succeeds without writing', async () => {
    payload.findByID.mockResolvedValue({
      id: 'cart-1',
      subtotal: 100,
      appliedCoupon: 'c1',
      discountAmount: 10,
    })
    payload.find.mockResolvedValue({ docs: [coupon] })

    const resp = await applyCouponHandler({ pluginConfig })({
      payload,
      user: { id: 'u1' },
      data: { code: 'welcome10', cartID: 'cart-1' },
    } as any)
    const body = await resp.json()

    expect(resp.status).toBe(200)
    expect(body).toMatchObject({ success: true, alreadyApplied: true, discount: 10 })
    expect(body.coupon.code).toBe('WELCOME10')
    expect(payload.update).not.toHaveBeenCalled()
  })

  it('an expired code already on the cart is reported as expired, not applied', async () => {
    payload.findByID.mockResolvedValue({ id: 'cart-1', subtotal: 100, appliedCoupon: 'c1' })
    payload.find.mockResolvedValue({ docs: [{ ...coupon, activeUntil: '2000-01-01' }] })

    const resp = await applyCouponHandler({ pluginConfig })({
      payload,
      user: { id: 'u1' },
      data: { code: 'WELCOME10', cartID: 'cart-1' },
    } as any)

    expect(resp.status).toBe(400)
    expect((await resp.json()).error).toBe('Coupon has expired')
  })

  it('a different code is still rejected while one is applied', async () => {
    payload.findByID.mockResolvedValue({ id: 'cart-1', subtotal: 100, appliedCoupon: 'c1' })
    payload.find.mockResolvedValue({ docs: [{ ...coupon, id: 'c2', code: 'OTHER' }] })

    const resp = await applyCouponHandler({ pluginConfig })({
      payload,
      user: { id: 'u1' },
      data: { code: 'OTHER', cartID: 'cart-1' },
    } as any)

    expect(resp.status).toBe(400)
  })

  it('remove clears the code using the caller cart access', async () => {
    payload.findByID.mockResolvedValue({ id: 'cart-1', appliedCoupon: 'c1' })
    payload.update.mockResolvedValue({})

    const resp = await removeCouponHandler({ pluginConfig })({
      payload,
      data: { cartID: 'cart-1', secret: 'sek' },
    } as any)

    expect(resp.status).toBe(200)
    const call = payload.update.mock.calls[0][0]
    expect(call.data).toEqual({ appliedCoupon: null, discountAmount: 0 })
    expect(call.overrideAccess).toBe(false)
    expect(call.req.context.cartSecret).toBe('sek')
  })

  it('remove refuses anonymous callers without a cart secret', async () => {
    const resp = await removeCouponHandler({ pluginConfig })({
      payload,
      data: { cartID: 'cart-1' },
    } as any)
    expect(resp.status).toBe(404)
    expect(payload.update).not.toHaveBeenCalled()
  })

  it('remove returns 404 when the caller cannot read the cart', async () => {
    payload.findByID.mockRejectedValue(new Error('Forbidden'))
    const resp = await removeCouponHandler({ pluginConfig })({
      payload,
      user: { id: 'u1' },
      data: { cartID: 'cart-1' },
    } as any)
    expect(resp.status).toBe(404)
    expect(payload.update).not.toHaveBeenCalled()
  })
})

describe('#20 tenant-scoped code lookup', () => {
  const pluginConfig = sanitizePluginConfig({
    pluginConfig: { enabled: true, multiTenant: { enabled: true } },
  })
  let payload: ReturnType<typeof makePayload>

  beforeEach(() => {
    payload = makePayload()
  })

  it('apply filters the lookup by the cart tenant, not the cookie', async () => {
    payload.findByID.mockResolvedValue({ id: 'cart-1', subtotal: 100, tenant: { id: 't-b' } })
    payload.find.mockResolvedValue({ docs: [] })

    const resp = await applyCouponHandler({ pluginConfig })({
      payload,
      user: { id: 'u1' },
      headers: new Headers({ cookie: 'payload-tenant=t-a' }),
      data: { code: 'WELCOME10', cartID: 'cart-1' },
    } as any)

    expect(resp.status).toBe(404)
    for (const [args] of payload.find.mock.calls) {
      expect(args.where.and).toContainEqual({ tenant: { equals: 't-b' } })
    }
  })

  it('validate reads the tenant from the x-tenant header', async () => {
    payload.find.mockResolvedValue({ docs: [coupon] })

    const resp = await validateCouponHandler({ pluginConfig })({
      payload,
      headers: new Headers({ 'x-tenant': 't-a' }),
      data: { code: 'WELCOME10' },
    } as any)

    expect(resp.status).toBe(200)
    expect(payload.find.mock.calls[0][0].where.and).toContainEqual({ tenant: { equals: 't-a' } })
  })

  it('matches nothing when no tenant can be resolved', async () => {
    const resp = await validateCouponHandler({ pluginConfig })({
      payload,
      data: { code: 'WELCOME10' },
    } as any)

    expect(resp.status).toBe(404)
    expect(payload.find).not.toHaveBeenCalled()
  })

  it('uses a custom resolveTenant when given', async () => {
    const custom = sanitizePluginConfig({
      pluginConfig: {
        enabled: true,
        multiTenant: { enabled: true, tenantField: 'site', resolveTenant: () => 7 },
      },
    })
    payload.find.mockResolvedValue({ docs: [coupon] })

    await validateCouponHandler({ pluginConfig: custom })({
      payload,
      data: { code: 'WELCOME10' },
    } as any)

    expect(payload.find.mock.calls[0][0].where.and).toContainEqual({ site: { equals: 7 } })
  })

  it('leaves lookups unscoped when multiTenant is off', async () => {
    const plain = sanitizePluginConfig({ pluginConfig: { enabled: true } })
    payload.find.mockResolvedValue({ docs: [coupon] })

    await validateCouponHandler({ pluginConfig: plain })({
      payload,
      headers: new Headers({ 'x-tenant': 't-a' }),
      data: { code: 'WELCOME10' },
    } as any)

    expect(payload.find.mock.calls[0][0].where).toEqual({ normalizedCode: { equals: 'WELCOME10' } })
  })

  it('rejects moving a coupon to a tenant that already has its code', async () => {
    const collection = createCouponsCollection(pluginConfig)
    const hook = collection.hooks!.beforeValidate![0] as any
    const find = jest.fn().mockResolvedValue({ docs: [{ id: 'other' }] })

    // Partial patch: only the tenant changes, so the code comes from the stored document.
    await expect(
      hook({
        data: { tenant: 't-b' },
        originalDoc: { id: 'c1', code: 'WELCOME10', normalizedCode: 'WELCOME10', tenant: 't-a' },
        req: { payload: { find } },
      }),
    ).rejects.toThrow('already exists for this tenant')

    const { and } = find.mock.calls[0][0].where
    expect(and).toContainEqual({ normalizedCode: { equals: 'WELCOME10' } })
    expect(and).toContainEqual({ tenant: { equals: 't-b' } })
    expect(and).toContainEqual({ id: { not_equals: 'c1' } })
  })

  it('makes coupon codes unique per tenant instead of globally', async () => {
    const collection = createCouponsCollection(pluginConfig)
    const codeField = collection.fields.find((f: any) => f.name === 'code') as any
    expect(codeField.unique).toBe(false)

    const hook = collection.hooks!.beforeValidate![0] as any
    const find = jest.fn().mockResolvedValue({ docs: [{ id: 'other' }] })
    await expect(
      hook({ data: { code: 'WELCOME10', tenant: 't-a' }, req: { payload: { find } } }),
    ).rejects.toThrow('already exists for this tenant')
    expect(find.mock.calls[0][0].where.and).toContainEqual({ tenant: { equals: 't-a' } })

    find.mockResolvedValue({ docs: [] })
    await expect(
      hook({ data: { code: 'WELCOME10', tenant: 't-b' }, req: { payload: { find } } }),
    ).resolves.toMatchObject({ normalizedCode: 'WELCOME10' })
  })
})
