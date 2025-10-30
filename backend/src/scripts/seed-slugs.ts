import 'dotenv/config';
import mongoose from 'mongoose';
import { Business, BusinessSchema } from '../schemas/business.schema';

function normalizeToSlug(input: string): string {
  return String(input)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function main() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/voxa';
  await mongoose.connect(mongoUri);

  // Loosen typing for seed script to avoid compile-time generic mismatches
  const BusinessModel = (mongoose.models[Business.name] || mongoose.model(Business.name, BusinessSchema as any, 'businesses')) as mongoose.Model<any>;

  const businesses = await BusinessModel.find({}, { _id: 1, name: 1, slug: 1 }).lean();
  const occupied = new Set<string>();

  // Preload existing slugs (non-empty)
  for (const b of businesses) {
    if (b.slug && typeof b.slug === 'string' && b.slug.trim().length > 0) {
      occupied.add(b.slug.trim().toLowerCase());
    }
  }

  let updatedCount = 0;

  for (const b of businesses) {
    const currentSlug = (b as any).slug as string | undefined;
    const desired = normalizeToSlug((b as any).name || '');
    if (!desired) {
      // Skip if name is empty or cannot derive a slug
      // eslint-disable-next-line no-console
      console.warn(`Skipping business ${b._id}: empty name`);
      continue;
    }

    if (currentSlug && currentSlug.toLowerCase() === desired) {
      // Already normalized
      continue;
    }

    // Ensure uniqueness
    let finalSlug = desired;
    let suffix = 2;
    while (occupied.has(finalSlug)) {
      finalSlug = `${desired}-${suffix++}`;
    }

    await BusinessModel.updateOne({ _id: b._id }, { $set: { slug: finalSlug } }).exec();
    occupied.add(finalSlug);
    updatedCount += 1;
    // eslint-disable-next-line no-console
    console.log(`Updated ${b._id} -> slug: ${finalSlug}`);
  }

  // eslint-disable-next-line no-console
  console.log(`Done. Updated ${updatedCount} business record(s).`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  // eslint-disable-next-line no-console
  console.error('Seed slugs failed:', err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});


