import type { ComponentType } from 'react';
import type { ModuleDefinition } from '@/features/modules/moduleCatalog';

export type FeatureScreenProps = { module: ModuleDefinition };

// Import feature screens here as they are implemented; unregistered modules use the shared scaffold screen.
const featureScreens: Partial<Record<string, ComponentType<FeatureScreenProps>>> = {};

export function getFeatureScreen(slug: string) {
  return featureScreens[slug];
}
