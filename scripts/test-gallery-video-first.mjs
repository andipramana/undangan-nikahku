import fs from 'node:fs/promises';

const source = await fs.readFile('assets/js/gallery.js', 'utf8');
if (!source.includes('const galleryRow = row + videoRowOffset')) throw new Error('Gallery photos must offset their rendered row when a video occupies row 1.');
if (!source.includes('slot.style.gridRow = "1"')) throw new Error('Gallery video must reserve explicit grid row 1.');
if (!source.includes('buildVideoSlot(videoId)')) throw new Error('Gallery video rendering unexpectedly missing.');
console.log('PASS: YouTube gallery slot explicitly owns row 1 and photos retain saved rows below it.');
