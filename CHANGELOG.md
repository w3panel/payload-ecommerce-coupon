# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security

- `POST /coupons/apply` now reads and updates the cart with the caller's own access (`overrideAccess: false`, guest `secret` forwarded as `req.context.cartSecret`), like `/coupons/remove`. Previously anyone with a cart ID could attach a code to another user's cart, and the `alreadyApplied` response revealed that cart's discount.
- The cart `recalculateCart` hook no longer re-prices a code written straight to the cart (e.g. `PATCH /api/carts/:id`), which skipped the endpoint's tenant, min-order and per-customer checks. With `multiTenant.enabled`, it also clears a coupon or referral code from another tenant than the cart's.

### Changed

- **Behaviour change:** `/coupons/apply` returns `404 Cart not found` when the caller is anonymous without a cart `secret`, or cannot read the cart (was: applied the code).
- **Behaviour change:** setting `appliedCoupon` / `appliedReferralCode` to a new code outside the plugin endpoints is reverted (the field keeps its previous value). Clearing a code still works. Admins (`access.isAdmin` returns `true`) are exempt; trusted server code can set `req.context[ALLOW_CART_CODE_WRITE_CONTEXT_KEY] = true`.

### Fixed

- With `multiTenant.enabled`, moving a coupon or referral code to another tenant (a patch that changes only the tenant) now checks that tenant for the same code. Before, it skipped the check and could create duplicate codes in one tenant.

### Added

- `ALLOW_CART_CODE_WRITE_CONTEXT_KEY` export for server code that attaches codes to carts directly.

## [4.0.0-beta.8] - 2026-11-10

### Added

- `POST /coupons/remove` endpoint and `removeCouponCode()` client helper to clear the applied code from a cart, so it stays removable after leaving or reloading checkout (#13)
- `multiTenant` option: tenant-scoped code lookup in validate/apply, and per-tenant code uniqueness (#20)

### Changed

- Re-applying the code already on the cart now returns `200` with `alreadyApplied: true` instead of a `400` error (#13)
- With `singleCodePerCart`, an unknown code now returns "Invalid code" (404) rather than the one-code-per-order error
- Re-applying a code that has since expired or hit its usage limit reports that error instead of `alreadyApplied`

## [4.0.0-beta.7] - 2026-10-26

### Changed

- Target Payload CMS Ecommerce Plugin v4 (`payload` / `@payloadcms/plugin-ecommerce` `>=4.0.0-beta.7 <5`)
- Disable document versions and authorship on coupon and referral collections for streamlined admin management

## [1.0.0] - 2026-01-23

### Added

- Initial release of @wtree/payload-ecommerce-coupon
- Comprehensive coupon management system with percentage and fixed-amount discounts
- Referral program support with partner commission tracking
- Referral code generation and management
- Full REST API endpoints for coupon validation and application
- Frontend hooks (`useCouponCode`, `validateCouponCode`) for easy integration
- Auto-integration with ecommerce collections (carts, orders)
- Admin panel configuration with validation and constraints
- Support for conditional discounts (product-specific, category-specific)
- Usage tracking and limits (per code, per customer)
- Production-ready plugin structure following Payload CMS best practices
- Comprehensive unit and integration tests with 80%+ coverage
- GitHub Actions CI/CD workflows for automated testing and publishing
- Full TypeScript support with strict type checking
- Complete documentation and examples
