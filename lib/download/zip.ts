import JSZip from 'jszip';

export async function buildLayoutZip(layoutJson: string, slug: string, license: string): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(`${slug}.json`, layoutJson);
  zip.file('LICENSE.txt', license);
  return zip.generateAsync({ type: 'nodebuffer' });
}

export const PORTABLE_NOTES = `HOW TO IMPORT THIS PACK

Import each .json file with Divi's own import (Portability), the same way you import any Divi layout.

Tick "Include global presets" when you import. That brings in this pack's text and button presets,
and every page you import follows them: change a preset once and all pages change.

The pack's global colors are added to your site automatically (look for them in the Global Colors list,
named after the pack). Change a color once and every page changes.

Good to know: importing another page of the pack puts the pack's colors back to their original values,
so if you have changed them, change them again afterwards. Presets you have edited are kept.
`;

export async function buildPackZip(layouts: { slug: string; json: string }[], license: string, notes?: string): Promise<Buffer> {
  const zip = new JSZip();
  for (const l of layouts) zip.file(`${l.slug}.json`, l.json);
  zip.file('LICENSE.txt', license);
  if (notes) zip.file('HOW-TO-IMPORT.txt', notes);
  return zip.generateAsync({ type: 'nodebuffer' });
}
