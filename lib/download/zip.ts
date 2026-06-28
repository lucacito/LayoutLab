import JSZip from 'jszip';

export async function buildLayoutZip(layoutJson: string, slug: string, license: string): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(`${slug}.json`, layoutJson);
  zip.file('LICENSE.txt', license);
  return zip.generateAsync({ type: 'nodebuffer' });
}
