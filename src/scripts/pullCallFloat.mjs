// scripts/pullCallFloat.mjs
import 'dotenv/config';
import { pullCallFloatFromSupabase } from '../src/utils/scheduleSupabaseSync.js';

(async () => {
  const res = await pullCallFloatFromSupabase({ institutionId: process.env.INSTITUTION_ID });
  console.log(JSON.stringify(res, null, 2));
})();