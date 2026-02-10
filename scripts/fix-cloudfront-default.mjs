/**
 * Fix CloudFront: swap default behavior to shelcaster-v2-root (no /public prefix)
 * so IVS recording paths like {random}/{compId}/{destId}/composite/master.m3u8 resolve.
 * Move existing default → public/* cache behavior.
 */
import { readFileSync, writeFileSync } from "fs";

// Get fresh config
import { execSync } from "child_process";
const raw = execSync(
  'aws cloudfront get-distribution-config --id E34KC6MODUKR5U --profile shelcaster-admin --output json --no-cli-pager',
  { encoding: "utf8" }
);
const parsed = JSON.parse(raw);
const etag = parsed.ETag;
const config = parsed.DistributionConfig;

console.log(`ETag: ${etag}`);
console.log(`Current default origin: ${config.DefaultCacheBehavior.TargetOriginId}`);
console.log(`Current cache behaviors: ${config.CacheBehaviors.Quantity}`);

// 1. Save old default behavior target
const oldDefaultOrigin = config.DefaultCacheBehavior.TargetOriginId; // shelcaster-v2.s3... (with /public)

// 2. Change default behavior to shelcaster-v2-root (no /public prefix)
config.DefaultCacheBehavior.TargetOriginId = "shelcaster-v2-root";

// 3. Remove the compositions/* cache behavior (no longer needed)
const behaviors = config.CacheBehaviors.Items || [];
const filtered = behaviors.filter(b => b.PathPattern !== "compositions/*");

// 4. Add public/* cache behavior pointing to old default origin (shelcaster-v2 with /public prefix)
// Check if public/* already exists
const hasPublic = filtered.some(b => b.PathPattern === "public/*");
if (!hasPublic) {
  // Clone the old default behavior settings for public/*
  const publicBehavior = JSON.parse(JSON.stringify(config.DefaultCacheBehavior));
  publicBehavior.PathPattern = "public/*";
  publicBehavior.TargetOriginId = oldDefaultOrigin; // shelcaster-v2 with /public prefix
  filtered.push(publicBehavior);
}

config.CacheBehaviors.Items = filtered;
config.CacheBehaviors.Quantity = filtered.length;

console.log(`\nNew default origin: ${config.DefaultCacheBehavior.TargetOriginId}`);
console.log(`New cache behaviors: ${config.CacheBehaviors.Quantity}`);
for (const b of filtered) {
  console.log(`  ${b.PathPattern} → ${b.TargetOriginId}`);
}

// Write updated config
writeFileSync("scripts/cf-config-fixed.json", JSON.stringify(config, null, 2));
console.log(`\nConfig written to scripts/cf-config-fixed.json`);
console.log(`ETag: ${etag}`);
console.log(`\nApplying update...`);

try {
  const result = execSync(
    `aws cloudfront update-distribution --id E34KC6MODUKR5U --if-match ${etag} --distribution-config file://scripts/cf-config-fixed.json --profile shelcaster-admin --no-cli-pager --query "Distribution.Status" --output text`,
    { encoding: "utf8" }
  );
  console.log(`✅ Update status: ${result.trim()}`);
} catch (e) {
  console.error(`❌ Update failed: ${e.stderr || e.message}`);
}

