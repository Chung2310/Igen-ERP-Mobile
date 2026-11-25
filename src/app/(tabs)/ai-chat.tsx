import { Redirect } from 'expo-router';
import { ErpAssistantScreen } from '@/features/assistant/ErpAssistantScreen';
import { useAuth } from '@/core/auth/AuthProvider';
import { canAccessModule } from '@/features/modules/moduleCatalog';

export default function AiChatScreen() {
  const { user, isLoading } = useAuth();
  if (!isLoading && !canAccessModule(user, 'chat')) return <Redirect href="/(tabs)/modules" />;
  return <ErpAssistantScreen />;
}
