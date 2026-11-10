# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.79.6] - 2026-11-10

### Added

- `POST /coupons/remove` endpoint and `removeCouponCode()` client helper to clear the applied code from a cart, so it stays removable after leaving or reloading checkout (#13)
- `multiTenant` option: tenant-scoped code lookup in validate/apply, and per-tenant code uniqueness (#20)

### Changed

- Re-applying the code already on the cart now returns `200` with `alreadyApplied: true` instead of a `400` error (#13)
- With `singleCodePerCart`, an unknown code now returns "Invalid code" (404) rather than the one-code-per-order error
- Re-applying a code that has since expired or hit its usage limit reports that error instead of `alreadyApplied`

### Fixed

- Apply/validate read coupon/referral codes, limit orders and referral programs with `overrideAccess` in apply/validate, so shoppers no longer get 500s

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
