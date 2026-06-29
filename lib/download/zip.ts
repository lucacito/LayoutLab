import JSZip from 'jszip';

export async function buildLayoutZip(layoutJson: string, slug: string, license: string): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(`${slug}.json`, layoutJson);
  zip.file('LICENSE.txt', license);
  return zip.generateAsync({ type: 'nodebuffer' });
}

export async function buildPackZip(layouts: { slug: string; json: string }[], license: string): Promise<Buffer> {
  const zip = new JSZip();
  for (const l of layouts) zip.file(`${l.slug}.json`, l.json);
  zip.file('LICENSE.txt', license);
  return zip.generateAsync({ type: 'nodebuffer' });
}
