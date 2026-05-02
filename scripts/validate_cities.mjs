#!/usr/bin/env node
/**
 * 도시 JSON 검증 CLI.
 *
 * Usage:
 *   node scripts/validate_cities.mjs
 *
 * 1. data/cities/*.json 모두 validateCity 통과 확인
 * 2. 시드만 있으면 시드 검증
 * 3. outlier 알림 (직전 commit 대비) — optional
 * 4. 종료 코드: 0 = OK, 1 = 검증 실패
 */

import { readFile, readdir, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

import { classifyChange, computePctChange } from './refresh/_outlier.mjs';
import { diffCities } from './refresh/_diff.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const CITIES_DIR = join(ROOT, 'data', 'cities');
const SEED_PATH = join(ROOT, 'data', 'seed', 'all.json');

async function main() {
  console.log('Validating city data...\n');

  /** @type {{id: string, data: unknown}[]} */
  const cities = [];
  let source = '';

  try {
    await access(CITIES_DIR);
    const files = await readdir(CITIES_DIR);
    const jsonFiles = files.filter((f) => f.endsWith('.json'));

    if (jsonFiles.length > 0) {
      source = 'data/cities/';
      for (const file of jsonFiles) {
        const id = file.replace('.json', '');
        const filePath = join(CITIES_DIR, file);
        const content = await readFile(filePath, 'utf-8');
        const data = JSON.parse(content);
        cities.push({ id, data });
      }
    }
  } catch {
    // data/cities 없으면 시드 사용
  }

  if (cities.length === 0) {
    source = 'data/seed/all.json';
    try {
      const seedContent = await readFile(SEED_PATH, 'utf-8');
      const seedData = JSON.parse(seedContent);

      if (seedData.cities && typeof seedData.cities === 'object') {
        for (const [id, data] of Object.entries(seedData.cities)) {
          cities.push({ id, data });
        }
      }
    } catch (err) {
      console.error('Failed to read seed file:', err.message);
      process.exit(1);
    }
  }

  if (cities.length === 0) {
    console.error('No city data found');
    process.exit(1);
  }

  console.log(`Source: ${source}`);
  console.log(`Cities: ${cities.length}\n`);

  const errors = [];
  const warnings = [];

  for (const { id, data } of cities) {
    try {
      validateCity(data, id);
      console.log(`  ✓ ${id}`);
    } catch (err) {
      console.log(`  ✗ ${id}: ${err.message}`);
      errors.push({ id, message: err.message });
    }

    const dataWarnings = checkDataWarnings(data, id);
    warnings.push(...dataWarnings);
  }

  console.log('');

  if (warnings.length > 0) {
    console.log('Warnings:');
    for (const w of warnings) {
      console.log(`  ⚠ ${w}`);
    }
    console.log('');
  }

  if (errors.length > 0) {
    console.log(`Validation failed: ${errors.length} error(s)`);
    process.exit(1);
  }

  console.log(`Validation passed: ${cities.length} cities OK`);
}

/**
 * 스키마 검증.
 * @param {unknown} data
 * @param {string} id
 */
function validateCity(data, id) {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error('city data must be an object');
  }

  const obj = data;

  const requiredStrings = ['id', 'country', 'currency', 'region', 'lastUpdated'];
  for (const key of requiredStrings) {
    if (typeof obj[key] !== 'string' || obj[key].length === 0) {
      throw new Error(`${key}: missing or invalid`);
    }
  }

  if (!/^[a-z][a-z0-9-]*$/.test(obj.id)) {
    throw new Error(`id: invalid format "${obj.id}"`);
  }

  if (!/^[A-Z]{2}$/.test(obj.country)) {
    throw new Error(`country: expected ISO 3166-1 alpha-2, got "${obj.country}"`);
  }

  if (!/^[A-Z]{3}$/.test(obj.currency)) {
    throw new Error(`currency: expected ISO 4217, got "${obj.currency}"`);
  }

  const validRegions = ['na', 'eu', 'asia', 'oceania', 'me'];
  if (!validRegions.includes(obj.region)) {
    throw new Error(`region: expected one of [${validRegions.join(', ')}], got "${obj.region}"`);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(obj.lastUpdated)) {
    throw new Error(`lastUpdated: expected YYYY-MM-DD, got "${obj.lastUpdated}"`);
  }

  if (typeof obj.name !== 'object' || obj.name === null) {
    throw new Error('name: missing or invalid');
  }
  if (typeof obj.name.ko !== 'string' || obj.name.ko.length === 0) {
    throw new Error('name.ko: missing or empty');
  }
  if (typeof obj.name.en !== 'string' || obj.name.en.length === 0) {
    throw new Error('name.en: missing or empty');
  }

  validateRent(obj.rent, id);
  validateFood(obj.food, id);
  validateTransport(obj.transport, id);

  if (!Array.isArray(obj.sources) || obj.sources.length === 0) {
    throw new Error('sources: must be non-empty array');
  }

  for (let i = 0; i < obj.sources.length; i++) {
    validateSource(obj.sources[i], `sources[${i}]`);
  }

  if (obj.tuition !== undefined) {
    if (!Array.isArray(obj.tuition)) {
      throw new Error('tuition: must be array');
    }
    for (let i = 0; i < obj.tuition.length; i++) {
      validateTuition(obj.tuition[i], `tuition[${i}]`);
    }
  }

  if (obj.tax !== undefined) {
    if (!Array.isArray(obj.tax)) {
      throw new Error('tax: must be array');
    }
    for (let i = 0; i < obj.tax.length; i++) {
      validateTax(obj.tax[i], `tax[${i}]`);
    }
  }

  if (obj.visa !== undefined) {
    validateVisa(obj.visa, id);
  }
}

function validateRent(rent, id) {
  if (typeof rent !== 'object' || rent === null) {
    throw new Error('rent: missing or invalid');
  }
  for (const key of ['share', 'studio', 'oneBed', 'twoBed']) {
    const val = rent[key];
    if (val !== null && (typeof val !== 'number' || val < 0)) {
      throw new Error(`rent.${key}: must be non-negative number or null`);
    }
  }
  if (rent.deposit !== undefined) {
    if (typeof rent.deposit !== 'number' || rent.deposit <= 0) {
      throw new Error('rent.deposit: must be positive number');
    }
  }
}

function validateFood(food, id) {
  if (typeof food !== 'object' || food === null) {
    throw new Error('food: missing or invalid');
  }
  for (const key of ['restaurantMeal', 'cafe']) {
    if (typeof food[key] !== 'number' || food[key] <= 0) {
      throw new Error(`food.${key}: must be positive number`);
    }
  }
  if (typeof food.groceries !== 'object' || food.groceries === null) {
    throw new Error('food.groceries: missing or invalid');
  }
  for (const key of ['milk1L', 'eggs12', 'rice1kg', 'chicken1kg', 'bread']) {
    if (typeof food.groceries[key] !== 'number' || food.groceries[key] <= 0) {
      throw new Error(`food.groceries.${key}: must be positive number`);
    }
  }
}

function validateTransport(transport, id) {
  if (typeof transport !== 'object' || transport === null) {
    throw new Error('transport: missing or invalid');
  }
  for (const key of ['monthlyPass', 'singleRide', 'taxiBase']) {
    if (typeof transport[key] !== 'number' || transport[key] <= 0) {
      throw new Error(`transport.${key}: must be positive number`);
    }
  }
}

function validateSource(source, path) {
  if (typeof source !== 'object' || source === null) {
    throw new Error(`${path}: must be object`);
  }
  const validCategories = ['rent', 'food', 'transport', 'tuition', 'tax', 'visa'];
  if (!validCategories.includes(source.category)) {
    throw new Error(`${path}.category: expected one of [${validCategories.join(', ')}]`);
  }
  if (typeof source.name !== 'string' || source.name.length === 0) {
    throw new Error(`${path}.name: missing or empty`);
  }
  if (typeof source.url !== 'string' || source.url.length === 0) {
    throw new Error(`${path}.url: missing or empty`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(source.accessedAt)) {
    throw new Error(`${path}.accessedAt: expected YYYY-MM-DD`);
  }
}

function validateTuition(entry, path) {
  if (typeof entry !== 'object' || entry === null) {
    throw new Error(`${path}: must be object`);
  }
  if (typeof entry.school !== 'string' || entry.school.length === 0) {
    throw new Error(`${path}.school: missing or empty`);
  }
  const validLevels = ['undergrad', 'graduate', 'language'];
  if (!validLevels.includes(entry.level)) {
    throw new Error(`${path}.level: expected one of [${validLevels.join(', ')}]`);
  }
  if (typeof entry.annual !== 'number' || entry.annual <= 0) {
    throw new Error(`${path}.annual: must be positive number`);
  }
}

function validateTax(entry, path) {
  if (typeof entry !== 'object' || entry === null) {
    throw new Error(`${path}: must be object`);
  }
  if (typeof entry.annualSalary !== 'number' || entry.annualSalary <= 0) {
    throw new Error(`${path}.annualSalary: must be positive number`);
  }
  if (
    typeof entry.takeHomePctApprox !== 'number' ||
    entry.takeHomePctApprox < 0 ||
    entry.takeHomePctApprox > 1
  ) {
    throw new Error(`${path}.takeHomePctApprox: must be number in [0, 1]`);
  }
}

function validateVisa(visa, id) {
  if (typeof visa !== 'object' || visa === null) {
    throw new Error('visa: must be object');
  }
  const optionalPositive = ['studentApplicationFee', 'workApplicationFee', 'settlementApprox'];
  for (const key of optionalPositive) {
    if (visa[key] !== undefined) {
      if (typeof visa[key] !== 'number' || visa[key] <= 0) {
        throw new Error(`visa.${key}: must be positive number`);
      }
    }
  }
}

/**
 * 경고 검사.
 * @param {unknown} data
 * @param {string} id
 * @returns {string[]}
 */
function checkDataWarnings(data, id) {
  const warnings = [];

  if (typeof data !== 'object' || data === null) {
    return warnings;
  }

  const lastUpdated = data.lastUpdated;
  if (typeof lastUpdated === 'string') {
    const date = new Date(lastUpdated);
    const now = new Date();
    const daysSince = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSince > 365) {
      warnings.push(`${id}: lastUpdated is over 1 year old (${lastUpdated})`);
    }

    if (date > now) {
      warnings.push(`${id}: lastUpdated is in the future (${lastUpdated})`);
    }
  }

  return warnings;
}

main().catch((err) => {
  console.error('Validation error:', err.message);
  process.exit(1);
});
