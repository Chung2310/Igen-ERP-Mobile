import { Redirect } from 'expo-router';
import { InternalChatScreen } from '@/features/chat/InternalChatScreen';
import { useAuth } from '@/core/auth/AuthProvider';
import { canAccessModule } from '@/features/modules/moduleCatalog';

export default function InboxScreen() {
  const { user, isLoading } = useAuth();
  if (!isLoading && !canAccessModule(user, 'chat')) return <Redirect href="/(tabs)/modules" />;
  return <InternalChatScreen />;
}
