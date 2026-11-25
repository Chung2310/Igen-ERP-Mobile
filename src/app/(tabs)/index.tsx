import { Redirect } from 'expo-router';
import { useAuth } from '@/core/auth/AuthProvider';
import { canAccessOverview } from '@/features/overview/overviewCatalog';
import { OverviewHubScreen } from '@/features/overview/OverviewHubScreen';

export default function OverviewTabScreen() {
  const { user, isLoading } = useAuth();
  if (!isLoading && user && !canAccessOverview(user)) {
    return <Redirect href="/(tabs)/modules" />;
  }
  return <OverviewHubScreen />;
}
