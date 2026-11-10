import { createCouponsCollection } from './collections/createCouponsCollection'
import { createReferralCodesCollection } from './collections/createReferralCodesCollection'
import { createReferralProgramsCollection } from './collections/createReferralProgramsCollection'
import { payloadEcommerceCouponPlugin } from './plugin'

export {
  removeCouponCode,
  useCouponCode,
  usePartnerStats,
  validateCouponCode,
} from './client/hooks'
export { PartnerDashboard } from './components/PartnerDashboard'
export { EarningsSummary } from './components/PartnerDashboard/EarningsSummary'
export { RecentReferrals } from './components/PartnerDashboard/RecentReferrals'
export { ReferralCodes } from './components/PartnerDashboard/ReferralCodes'
export { ReferralPerformance } from './components/PartnerDashboard/ReferralPerformance'
export { ProgramOverview } from './components/PartnerDashboard/ProgramOverview'
export { CommissionBreakdown } from './components/PartnerDashboard/CommissionBreakdown'

export {
  calculateCommissionAndDiscount,
  getProgramMinimumOrderAmount,
} from './utilities/calculateValues'
export { ALLOW_CART_CODE_WRITE_CONTEXT_KEY } from './utilities/applyCouponContext'
export { getCartTotalWithDiscounts } from './utilities/getCartTotalWithDiscounts'
export { recordCouponUsageForOrder } from './utilities/recordCouponUsageForOrder'
export {
  createCouponsCollection,
  createReferralCodesCollection,
  createReferralProgramsCollection,
  payloadEcommerceCouponPlugin as payloadEcommerceCoupon,
}

export type {
  AdminGroupConfig,
  ApplyCouponHook,
  ApplyCouponResponse,
  CouponPluginAccess,
  CouponPluginCollections,
  CouponPluginOptions,
  CouponPluginPolicies,
  MultiTenantConfig,
  OrderIntegrationConfig,
  PartnerDashboardConfig,
  PartnerDashboardData,
  PartnerStats,
  PartnerStatsPolicyContext,
  PluginIntegrationCollections,
  PluginIntegrationConfig,
  PluginIntegrationFields,
  PluginIntegrationResolvers,
  PolicyContext,
  RecordOrderUsagePolicyContext,
  RemoveCouponHook,
  RemoveCouponResponse,
  ReferralProgramConfig,
  RoleConfig,
  TenantResolverArgs,
} from './types'
export type { CartLike } from './utilities/getCartTotalWithDiscounts'
