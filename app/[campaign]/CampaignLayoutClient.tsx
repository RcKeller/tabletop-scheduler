"use client";

import { Navbar } from "@/components/layout/Navbar";

interface CampaignLayoutClientProps {
  children: React.ReactNode;
  campaignSlug: string;
  campaignTitle: string;
  eventId: string;
}

export function CampaignLayoutClient({ children, campaignSlug, campaignTitle, eventId }: CampaignLayoutClientProps) {
  return (
    <div className="min-h-screen">
      <Navbar campaignSlug={campaignSlug} campaignTitle={campaignTitle} eventId={eventId} />
      {children}
    </div>
  );
}
