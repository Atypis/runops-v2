import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function MySopsPage() {
  const supabase = createSupabaseServerClient()

  // Get the current user
  const { data: { user } } = await supabase.auth.getUser()

  // Get the user's SOPs
  const { data: sops, error } = await supabase
    .from('sops')
    .select('id, job_id, created_at')
    .eq('user_id', user?.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error("Error fetching SOPs:", error)
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold">My SOPs</h1>
        <p className="text-gray-600">View and manage your previously generated SOPs</p>
      </header>

      {sops && sops.length > 0 ? (
        <div className="border rounded-md overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-2 text-left">ID</th>
                <th className="px-4 py-2 text-left">Created</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sops.map((sop) => (
                <tr key={sop.id} className="border-b">
                  <td className="px-4 py-2 font-mono text-sm">{sop.job_id}</td>
                  <td className="px-4 py-2">
                    {new Date(sop.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link href={`/sop/${sop.job_id}`}>
                      <Button variant="outline" size="sm">View</Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 border rounded-md bg-gray-50">
          <h3 className="text-lg font-medium mb-2">No SOPs found</h3>
          <p className="text-gray-600 mb-6">Upload a video to generate your first SOP</p>
          <Link href="/">
            <Button>Upload video</Button>
          </Link>
        </div>
      )}
    </div>
  )
} 