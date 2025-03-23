import { createClient } from "@supabase/supabase-js"
import type { NextApiRequest, NextApiResponse } from "next"

// Create a Supabase client for use in API routes (Pages Router)
export function createServerClientForAPI(req: NextApiRequest, res: NextApiResponse) {
  return createClient(process.env.SUPABASE_URL || "", process.env.SUPABASE_ANON_KEY || "")
}

