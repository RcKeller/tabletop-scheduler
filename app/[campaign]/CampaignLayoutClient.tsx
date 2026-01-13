"use client";

import { Navbar } from "@/components/layout/Navbar";

interface CampaignLayoutClientProps {
  children: React.ReactNode;
  campaignSlug: string;
  campaignTitle: string;
}

export function CampaignLayoutClient({ children, campaignSlug, campaignTitle }: CampaignLayoutClientProps) {
  return (
    <div className="min-h-screen">
      <Navbar campaignSlug={campaignSlug} campaignTitle={campaignTitle} />
      {children}
    </div>
  );
}
