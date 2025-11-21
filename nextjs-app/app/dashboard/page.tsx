import AllLeads from '@/components/dashboard/AllLeads';
import LeadsPageClient from '@/components/dashboard/LeadsPageClient';
import { getAllLeadsServer } from '@/lib/firestore-server';

// Cache for 30 seconds - balance between freshness and performance
export const revalidate = 30;

export default async function DashboardPage() {
  // Fetch on server - cached by Next.js
  const initialLeads = await getAllLeadsServer();

  return (
    <LeadsPageClient initialLeads={initialLeads}>
      <AllLeads initialLeads={initialLeads} />
    </LeadsPageClient>
  );
}
