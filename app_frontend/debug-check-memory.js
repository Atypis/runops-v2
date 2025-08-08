#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const id = process.argv[2];
(async ()=>{
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabase.from('memory_artifacts').select('*').eq('execution_id', id);
  console.log(error||data.length);
})(); 