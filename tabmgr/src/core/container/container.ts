import { Container } from './ContainerClass';
import { SERVICE_KEYS } from './ServiceKeys';
import { ChromeTabRepository } from '../../infrastructure/repositories/ChromeTabRepository';
import { ChromeStorageRepository } from '../../infrastructure/repositories/ChromeStorageRepository';
import { ThumbnailRepository } from '../../infrastructure/repositories/ThumbnailRepository';
import { TabService } from '../../application/services/TabService';
import { ITabRepository } from '../repositories/ITabRepository';
import { IStorageRepository } from '../repositories/IStorageRepository';
import { IThumbnailRepository } from '../repositories/IThumbnailRepository';
import { ITabService } from '../services/ITabService';

export const container = new Container();

// Register repositories
container.singleton<ITabRepository>(SERVICE_KEYS.TAB_REPOSITORY, () => {
  return new ChromeTabRepository();
});

container.singleton<IStorageRepository>(SERVICE_KEYS.STORAGE_REPOSITORY, () => {
  return new ChromeStorageRepository();
});

container.singleton<IThumbnailRepository>(SERVICE_KEYS.THUMBNAIL_REPOSITORY, () => {
  const storageRepo = container.resolve<IStorageRepository>(SERVICE_KEYS.STORAGE_REPOSITORY);
  return new ThumbnailRepository(storageRepo);
});

// Register services
container.singleton<ITabService>(SERVICE_KEYS.TAB_SERVICE, () => {
  const tabRepo = container.resolve<ITabRepository>(SERVICE_KEYS.TAB_REPOSITORY);
  const storageRepo = container.resolve<IStorageRepository>(SERVICE_KEYS.STORAGE_REPOSITORY);
  const thumbnailRepo = container.resolve<IThumbnailRepository>(SERVICE_KEYS.THUMBNAIL_REPOSITORY);
  return new TabService(tabRepo, storageRepo, thumbnailRepo);
});

