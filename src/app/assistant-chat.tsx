import { Redirect, useRouter } from 'expo-router';
import { ErpAssistantScreen } from '@/features/assistant/ErpAssistantScreen';
import { useAuth } from '@/core/auth/AuthProvider';
import { canAccessModule } from '@/features/modules/moduleCatalog';

export default function AssistantQuickChatScreen() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  if (!isLoading && !canAccessModule(user, 'chat')) return <Redirect href="/(tabs)/modules" />;
  return <ErpAssistantScreen chatOnly onClose={() => router.back()} />;
}
