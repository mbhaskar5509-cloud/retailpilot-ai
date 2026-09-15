import { createClient } from '@/lib/supabase/server'

export default async function SupabaseTestPage() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .limit(1)

  return (
    <main style={{ padding: '40px' }}>
      <h1>Supabase Connection Test</h1>

      {error ? (
        <p>Supabase connected, but products table is not created yet.</p>
      ) : (
        <p>Supabase connection successful! 🎉</p>
      )}

      <pre>{JSON.stringify({ data, error }, null, 2)}</pre>
    </main>
  )
}