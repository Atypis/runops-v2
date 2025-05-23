"use client"

import * as React from "react"
import {
  AudioWaveform,
  BookOpen,
  Bot,
  Command,
  Frame,
  GalleryVerticalEnd,
  Map,
  PieChart,
  Settings2,
  SquareTerminal,
  Upload,
  FileText,
  Database,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"

// This is sample data.
const data = {
  user: {
    name: "Operations User",
    email: "user@operations.com",
    avatar: "/avatars/user.jpg",
  },
  teams: [
    {
      name: "RunOps",
      logo: GalleryVerticalEnd,
      plan: "Pro",
    },
  ],
  navMain: [
    {
      title: "SOPs",
      url: "#",
      icon: FileText,
      isActive: true,
      items: [
        {
          title: "Upload Video",
          url: "/",
        },
        {
          title: "My SOPs",
          url: "/my-sops",
        },
        {
          title: "Browse All",
          url: "#",
        },
      ],
    },
    {
      title: "Settings",
      url: "#",
      icon: Settings2,
      items: [
        {
          title: "Account",
          url: "#",
        },
        {
          title: "Preferences",
          url: "#",
        },
        {
          title: "API Keys",
          url: "#",
        },
      ],
    },
  ],
  projects: [
    {
      name: "Operations Team",
      url: "/my-sops",
      icon: Database,
    },
    {
      name: "Legal Team", 
      url: "/my-sops",
      icon: FileText,
    },
    {
      name: "Engineering Team",
      url: "/my-sops", 
      icon: Upload,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavProjects projects={data.projects} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
