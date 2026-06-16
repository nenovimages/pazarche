import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://hlbrxndvorzbzdotdxvy.supabase.co";
const SUPABASE_KEY = "sb_publishable_RMX64W24CpM3xrRt7KWlvg_MBBZxDzK";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
