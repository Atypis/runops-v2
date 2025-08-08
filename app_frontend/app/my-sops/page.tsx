import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Separator } from "@/components/ui/separator"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

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
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="#">
                    RunOps
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>My SOPs</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="min-h-[100vh] flex-1 rounded-xl bg-muted/50 md:min-h-min p-8">
            <header className="mb-8">
              <h1 className="text-2xl font-bold">My SOPs</h1>
              <p className="text-gray-600">View and manage your previously generated SOPs</p>
            </header>

            {sops && sops.length > 0 ? (
              <div className="border rounded-md overflow-hidden bg-white">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="px-6 py-3 text-left">ID</th>
                      <th className="px-6 py-3 text-left">Created</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sops.map((sop) => (
                      <tr key={sop.id} className="border-b">
                        <td className="px-6 py-4 font-mono text-sm">{sop.job_id}</td>
                        <td className="px-6 py-4">
                          {new Date(sop.created_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-right">
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
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
} 