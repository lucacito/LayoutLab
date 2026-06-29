import { makeTaxonomyPage } from '@/lib/seo/taxonomy-page';
const page = makeTaxonomyPage('niche');
export const dynamic = 'force-dynamic';
export const generateMetadata = page.generateMetadata;
export default page.Page;
