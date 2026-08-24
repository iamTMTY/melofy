// One-shot: push the local dataset.json into a Langfuse dataset so the songs +
// human-reviewed references live in Langfuse too — ready for annotation queues
// and for `dataset.runExperiment` style runs later. Idempotent: each item uses a
// stable id (the dataset entry id), so re-running updates rather than duplicates.
//
//   pnpm --filter @melofy/eval dataset:sync
//
// No-ops with a clear message if LANGFUSE_* env vars aren't set.
import { loadDataset } from './dataset.ts';
import { datasetName, langfuseEnabled, upsertDatasetItems } from './langfuse.ts';

async function main() {
  if (!langfuseEnabled) {
    console.error('Langfuse is not configured. Set LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY (and optionally LANGFUSE_BASE_URL) in the repo-root .env.');
    process.exit(1);
  }

  const data = loadDataset();
  const items = data.map((e) => ({
    id: e.id,
    input: {
      source_lines: e.source_lines,
      language: e.language,
      code: e.code,
      artist: e.artist,
      title: e.title,
    },
    expectedOutput: e.reference_lines ? { reference_lines: e.reference_lines } : null,
    metadata: {
      reviewed: !!e.reviewed,
      reviewer: e.reviewer ?? null,
      generator_model: e.generator_model ?? null,
      brief: e.brief ?? null,
    },
  }));

  console.log(`Syncing ${items.length} items into Langfuse dataset "${datasetName}"…`);
  const res = await upsertDatasetItems(items);
  console.log(`Done. ${res.count} items upserted into "${res.dataset}".`);
  process.exit(0);
}

main().catch((err) => {
  console.error('dataset:sync failed:', err?.message || err);
  process.exit(1);
});
