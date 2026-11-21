import type { ComponentType } from 'react';
import type { ModuleDefinition } from '@/features/modules/moduleCatalog';
import { EmbeddedErpAssistantScreen } from '@/features/assistant/ErpAssistantScreen';
import { EmbeddedInternalChatScreen } from '@/features/chat/InternalChatScreen';
import { CrmScreen } from '@/features/crm/CrmScreen';
import { HrModuleScreen } from '@/features/hr/HrModuleScreen';
import { KnowledgeScreen } from '@/features/knowledge/KnowledgeScreen';
import { EmbeddedOverviewScreen } from '@/features/overview/OverviewHubScreen';
import { ResourcesScreen } from '@/features/ResourcesScreen';
import { QuotationModuleScreen } from '@/features/quotation/QuotationModuleScreen';
import { InventoryModuleScreen } from '@/features/inventory/InventoryModuleScreen';

export type FeatureScreenProps = { module: ModuleDefinition };

// Import feature screens here as they are implemented; unregistered modules use the shared scaffold screen.
const featureScreens: Partial<Record<string, ComponentType<FeatureScreenProps>>> = {
  crm: CrmScreen,
  knowledge: KnowledgeScreen,
  overview: EmbeddedOverviewScreen,
  chat: EmbeddedInternalChatScreen,
  assistant: EmbeddedErpAssistantScreen,
  hr: HrModuleScreen,
  resources: ResourcesScreen,
  quotes: QuotationModuleScreen,
  inventory: InventoryModuleScreen,
};

export function getFeatureScreen(slug: string) {
  return featureScreens[slug];
}
