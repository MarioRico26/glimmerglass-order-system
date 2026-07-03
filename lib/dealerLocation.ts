export const DEALER_COUNTRIES = [
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
] as const

export type DealerCountryCode = (typeof DEALER_COUNTRIES)[number]['value']

export const US_REGIONS = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming',
] as const

export const CANADA_REGIONS = [
  'Alberta','British Columbia','Manitoba','New Brunswick','Newfoundland and Labrador','Northwest Territories','Nova Scotia','Nunavut','Ontario','Prince Edward Island','Quebec','Saskatchewan','Yukon',
] as const

export function normalizeDealerCountry(value?: string | null): DealerCountryCode {
  return String(value || '').trim().toUpperCase() === 'CA' ? 'CA' : 'US'
}

export function getRegionsForCountry(country?: string | null): readonly string[] {
  return normalizeDealerCountry(country) === 'CA' ? CANADA_REGIONS : US_REGIONS
}

export function getRegionLabel(country?: string | null): string {
  return normalizeDealerCountry(country) === 'CA' ? 'Province' : 'State'
}

export function getCountryLabel(country?: string | null): string {
  return normalizeDealerCountry(country) === 'CA' ? 'Canada' : 'United States'
}

export function isValidRegionForCountry(country: string | null | undefined, region: string | null | undefined): boolean {
  const normalizedRegion = String(region || '').trim()
  if (!normalizedRegion) return false
  return getRegionsForCountry(country).includes(normalizedRegion)
}
