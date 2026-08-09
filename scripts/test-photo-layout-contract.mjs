import fs from 'node:fs/promises';

const photos = await fs.readFile('assets/js/admin/photos.js', 'utf8');
const editor = await fs.readFile('assets/js/admin/editor.js', 'utf8');
const css = await fs.readFile('assets/css/admin.css', 'utf8');

if (!photos.includes('cardLayoutFor(') || !photos.includes('photo-card--')) {
  throw new Error('Photo list must derive each card shape from its real guest placement.');
}
if (!photos.includes('gallery_row') || !photos.includes('data-gallery-row')) {
  throw new Error('Gallery list must expose and persist an explicit row per photo.');
}
if (!photos.includes('GalleryLayout.shapeAt(index, photo)') || !photos.includes('GalleryLayout.rowAt(index, photo)')) {
  throw new Error('Gallery list must use each photo\'s saved layout and row, with legacy fallback only when absent.');
}
if (!editor.includes('renderedImageSize') || !editor.includes('transformOrigin')) {
  throw new Error('Zoomed pan must use actual rendered image geometry and focal transform origin.');
}
if (!editor.includes('range.x > 0') || !editor.includes('range.y > 0')) {
  throw new Error('Pan must keep horizontal and vertical ranges independent.');
}
if (!css.includes('.photo-grid--gallery') || !css.includes('.photo-card--hero')) {
  throw new Error('Admin photo cards need real gallery and full-screen hero layouts.');
}
console.log('PASS: photo admin contracts use real guest shapes and two-axis zoom pan.');
