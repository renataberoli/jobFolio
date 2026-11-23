declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    JOBFOLIO_SESSION_SECRET?: string;
    JOBFOLIO_PIN_HASH?: string;
  }
}
