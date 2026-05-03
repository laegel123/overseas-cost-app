/**
 * Schema 검증 통과 보장 밴쿠버 fixture (CAD).
 * tuition (UBC) + tax (60k CAD) + visa 모두 채움 — full-shape 검증용.
 */

import type { CityCostData } from '@/types/city';

export const vancouverValid: CityCostData = {
  id: 'vancouver',
  name: { ko: '밴쿠버', en: 'Vancouver' },
  country: 'CA',
  currency: 'CAD',
  region: 'na',
  lastUpdated: '2026-04-01',
  rent: {
    share: 950,
    studio: 1800,
    oneBed: 2300,
    twoBed: 3400,
    deposit: 1150,
  },
  food: {
    restaurantMeal: 22,
    cafe: 6,
    groceries: {
      milk1L: 3.4,
      eggs12: 7.5,
      rice1kg: 4.2,
      chicken1kg: 17.5,
      bread: 4.5,
      onion1kg: 3.0,
      apple1kg: 6.0,
      ramen: 2.4,
    },
  },
  transport: {
    monthlyPass: 105,
    singleRide: 3.15,
    taxiBase: 3.5,
  },
  tuition: [
    { school: 'UBC', level: 'undergrad', annual: 45000 },
    { school: 'SFU', level: 'undergrad', annual: 35000 },
  ],
  tax: [
    { annualSalary: 60000, takeHomePctApprox: 0.74 },
    { annualSalary: 80000, takeHomePctApprox: 0.7 },
    { annualSalary: 100000, takeHomePctApprox: 0.66 },
  ],
  visa: {
    studentApplicationFee: 150,
    workApplicationFee: 155,
    settlementApprox: 1500,
  },
  sources: [
    {
      category: 'rent',
      name: 'CMHC Rental Market Survey',
      url: 'https://www03.cmhc-schl.gc.ca/hmip-pimh/en/',
      accessedAt: '2026-04-01',
    },
    {
      category: 'food',
      name: 'Statistics Canada CPI',
      url: 'https://www150.statcan.gc.ca/',
      accessedAt: '2026-04-01',
    },
    {
      category: 'transport',
      name: 'TransLink',
      url: 'https://www.translink.ca/transit-fares',
      accessedAt: '2026-04-01',
    },
    {
      category: 'tuition',
      name: 'UBC International Tuition',
      url: 'https://you.ubc.ca/financial-planning/cost/',
      accessedAt: '2026-04-01',
    },
    {
      category: 'tax',
      name: 'Canada Revenue Agency',
      url: 'https://www.canada.ca/en/revenue-agency.html',
      accessedAt: '2026-04-01',
    },
    {
      category: 'visa',
      name: 'IRCC',
      url: 'https://www.canada.ca/en/immigration-refugees-citizenship.html',
      accessedAt: '2026-04-01',
    },
  ],
};
