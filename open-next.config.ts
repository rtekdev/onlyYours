import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Every route in Only Yours is dynamic (auth/cookie dependent), so no
// incremental cache backend (R2/KV) is needed. Add one here if ISR/static
// regeneration is ever introduced.
export default defineCloudflareConfig();
