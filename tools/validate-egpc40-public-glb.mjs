import fs from 'node:fs';
import path from 'node:path';

const filePath = process.argv[2] ?? path.resolve('dist/assets/grippers/schunk-egpc40/egpc40-public.glb');
const buffer = fs.readFileSync(filePath);
if (buffer.toString('ascii', 0, 4) !== 'glTF') throw new Error('Not a binary glTF file.');
if (buffer.readUInt32LE(4) !== 2) throw new Error('Only glTF 2.0 is supported.');

const jsonChunkLength = buffer.readUInt32LE(12);
const jsonChunkType = buffer.toString('ascii', 16, 20);
if (jsonChunkType !== 'JSON') throw new Error('The first GLB chunk is not JSON.');
const gltf = JSON.parse(buffer.subarray(20, 20 + jsonChunkLength).toString('utf8'));

const meshNodes = (gltf.nodes ?? []).filter(node => Number.isInteger(node.mesh));
const meshNames = meshNodes.map(node => node.name ?? '');
const countContaining = value => meshNames.filter(name => name.includes(value)).length;
const forbiddenNames = (gltf.nodes ?? [])
  .map(node => node.name ?? '')
  .filter(name => /EGPC40_(STATIC|FINGER)|RUNTIME_FINGER/.test(name));
const forbiddenMaterials = (gltf.materials ?? [])
  .map(material => material.name ?? '')
  .filter(name => /^EGPC40_/.test(name));
const triangleCount = (gltf.meshes ?? []).reduce((total, mesh) => total + mesh.primitives.reduce((meshTotal, primitive) => {
  const accessor = gltf.accessors?.[primitive.indices];
  if (!accessor) throw new Error('A primitive is missing its index accessor.');
  return meshTotal + accessor.count / 3;
}, 0), 0);

const expectedCounts = new Map([
  ['Finger EGP 40', 2],
  ['Bracket MPG 40', 4],
  ['Scheibe D4_5', 3],
  ['Huelse MPG 40', 1],
]);
for (const [name, expected] of expectedCounts) {
  const actual = countContaining(name);
  if (actual !== expected) throw new Error(`${name}: expected ${expected}, got ${actual}`);
}
if (meshNodes.length !== 18) throw new Error(`Expected 18 mesh nodes, got ${meshNodes.length}`);
if (triangleCount !== 53494) throw new Error(`Expected 53494 triangles, got ${triangleCount}`);
if (forbiddenNames.length) throw new Error(`Embedded finger/static groups found: ${forbiddenNames.join(', ')}`);
if (forbiddenMaterials.length) throw new Error(`Manual project materials found: ${forbiddenMaterials.join(', ')}`);

console.log(JSON.stringify({
  file: path.basename(filePath),
  bytes: buffer.length,
  meshNodes: meshNodes.length,
  triangleCount,
  fingerMeshes: countContaining('Finger EGP 40'),
  embeddedFingerGroups: false,
  manualProjectMaterials: false,
}, null, 2));
