import dynamic from "next/dynamic";

const CampaignMapPage = dynamic(
  () => import("@/components/CampaignMapPage").then((mod) => mod.CampaignMapPage),
  { ssr: false }
);

export default function MapPage() {
  return <CampaignMapPage />;
}
