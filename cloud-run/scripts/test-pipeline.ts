import "dotenv/config";
import { runFullPipeline } from "../src/pipeline/runFullPipeline";

runFullPipeline({ fast: true, skipCache: true })
  .then((r) => {
    console.log("success:", r.success);
    console.log("dossiers:", r.meta?.all_dossiers?.length ?? 0);
    console.log("firestore:", (r.meta as Record<string, unknown>)?.firestore_saved);
    console.log("degraded:", (r.meta as Record<string, unknown>)?.degraded_agents);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
