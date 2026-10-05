import fs from 'node:fs';
import occtImportJs from 'occt-import-js';

const stepPath = process.argv[2];
if (!stepPath) throw new Error('STEP file path is required.');

const occt = await occtImportJs();
const result = occt.ReadStepFile(fs.readFileSync(stepPath), {
  linearUnit: 'meter',
  linearDeflectionType: 'absolute_value',
  linearDeflection: 0.00035,
  angularDeflection: 0.35,
});

const meshSummary = (result.meshes ?? []).map((mesh, index) => {
  const positions = mesh.attributes?.position?.array ?? [];
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], positions[i + axis]);
      max[axis] = Math.max(max[axis], positions[i + axis]);
    }
  }
  return {
    index,
    name: mesh.name,
    color: mesh.color,
    attributeKeys: Object.keys(mesh.attributes ?? {}),
    positionCount: positions.length,
    normalCount: mesh.attributes?.normal?.array?.length ?? 0,
    indexCount: mesh.index?.array?.length ?? 0,
    brepFaceCount: mesh.brep_faces?.length ?? 0,
    brepFaceSample: (mesh.brep_faces ?? []).slice(0, 8),
    bounds: { min, max, size: max.map((value, axis) => value - min[axis]) },
  };
});

console.log(JSON.stringify({
  success: result.success,
  root: result.root,
  meshCount: meshSummary.length,
  meshes: meshSummary,
}, null, 2));
