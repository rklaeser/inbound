import ConfigurationsClient from '@/components/dashboard/ConfigurationsClient';
import { getAllConfigurationsServer } from '@/lib/firestore-server';

// Cache for 30 seconds
export const revalidate = 30;

export default async function ConfigurationsPage() {
  // Fetch on server - cached by Next.js
  const initialConfigurations = await getAllConfigurationsServer();

  return <ConfigurationsClient initialConfigurations={initialConfigurations} />;
}
