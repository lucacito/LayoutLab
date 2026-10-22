import { getTaxonomyCopy as readTaxonomyCopy } from './taxonomy';
import { cachePublicRead } from '@/lib/catalog/cache-public-read';

export const getTaxonomyCopy = cachePublicRead('taxonomy-copy', readTaxonomyCopy);
