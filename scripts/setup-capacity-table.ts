#!/usr/bin/env tsx

/**
 * One-time script to create the capacity_targets table
 * Run with: npx tsx scripts/setup-capacity-table.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vnexjslcyvsjqllttwpi.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY not found in environment');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: 'public' },
  auth: { persistSession: false }
});

async function setup() {
  console.log('Setting up capacity_targets table...\n');

  // Create the table
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS capacity_targets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      service TEXT UNIQUE NOT NULL,
      monthly_target NUMERIC NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  // Since we can't execute raw DDL via the REST API directly,
  // we'll use upsert to create initial data
  // The table should be created manually via Supabase Studio SQL Editor
  
  console.log('Inserting default capacity targets...');
  
  const defaultTargets = [
    { service: 'paid-advertising', monthly_target: 15000 },
    { service: 'seo', monthly_target: 10000 },
    { service: 'social-media', monthly_target: 12000 },
    { service: 'creative', monthly_target: 5000 },
    { service: '__team_total__', monthly_target: 45000 }
  ];

  const { data, error } = await supabase
    .from('capacity_targets')
    .upsert(defaultTargets, { onConflict: 'service' })
    .select();

  if (error) {
    console.error('Error:', error);
    console.log('\nPlease run this SQL in Supabase Studio SQL Editor:');
    console.log('\n' + createTableSQL);
    console.log('\nThen run this script again.');
    process.exit(1);
  }

  console.log('✓ Capacity targets created successfully!');
  console.log('Data:', data);
}

setup().catch(console.error);
