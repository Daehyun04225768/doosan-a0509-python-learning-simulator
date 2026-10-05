import fs from 'node:fs';
import path from 'node:path';
import occtImportJs from 'occt-import-js';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

const sourcePath = process.argv[2];
const outputPath = process.argv[3] ?? path.resolve('dist/assets/grippers/schunk-egpc40/egpc40-public.glb');
if (!sourcePath) throw new Error('STEP source path is required.');

const LINEAR_DEFLECTION_METERS = 0.00035;
const ANGULAR_DEFLECTION_RADIANS = 0.35;

if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class FileReader {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then(value => {
        this.result = value;
        this.onloadend?.({ target: this });
      }).catch(error => this.onerror?.(error));
    }
    readAsDataURL(blob) {
      blob.arrayBuffer().then(value => {
        this.result = `data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(value).toString('base64')}`;
        this.onloadend?.({ target: this });
      }).catch(error => this.onerror?.(error));
    }
  };
}

const occt = await occtImportJs();
const imported = occt.ReadStepFile(fs.readFileSync(sourcePath), {
  linearUnit: 'meter',
  linearDeflectionType: 'absolute_value',
  linearDeflection: LINEAR_DEFLECTION_METERS,
  angularDeflection: ANGULAR_DEFLECTION_RADIANS,
});
if (!imported.success) throw new Error('OpenCascade could not triangulate the STEP assembly.');

const materialCache = new Map();
function sourceMaterial(color) {
  const rgb = Array.isArray(color) && color.length >= 3 ? color.slice(0, 3) : [0.72, 0.74, 0.76];
  const key = rgb.map(value => Number(value).toFixed(6)).join(':');
  if (!materialCache.has(key)) {
    materialCache.set(key, new THREE.MeshStandardMaterial({
      color: new THREE.Color(...rgb),
      roughness: 0.55,
      metalness: 0.12,
    }));
  }
  return materialCache.get(key);
}

const meshObjects = imported.meshes.map(meshData => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(meshData.attributes.position.array, 3));
  if (meshData.attributes.normal?.array?.length) {
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(meshData.attributes.normal.array, 3));
  } else {
    geometry.computeVertexNormals();
  }
  geometry.setIndex(new THREE.BufferAttribute(Uint32Array.from(meshData.index.array), 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const mesh = new THREE.Mesh(geometry, sourceMaterial(meshData.color));
  mesh.name = meshData.name;
  return mesh;
});

function recreateAssembly(sourceNode) {
  const group = new THREE.Group();
  group.name = sourceNode.name || 'STEP_ROOT';
  for (const meshIndex of sourceNode.meshes ?? []) group.add(meshObjects[meshIndex]);
  for (const child of sourceNode.children ?? []) group.add(recreateAssembly(child));
  return group;
}

const root = recreateAssembly(imported.root);
root.updateMatrixWorld(true);
const bounds = new THREE.Box3().setFromObject(root);
const size = bounds.getSize(new THREE.Vector3());
const triangleCount = imported.meshes.reduce((sum, mesh) => sum + mesh.index.array.length / 3, 0);

const exporter = new GLTFExporter();
const glb = await new Promise((resolve, reject) => {
  exporter.parse(root, resolve, reject, {
    binary: true,
    onlyVisible: true,
    truncateDrawRange: true,
  });
});

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, Buffer.from(glb));

const manifest = {
  product: 'SCHUNK Co-act EGP-C 40-N-N-M1013',
  productId: '1359018',
  sourceFormat: 'STEP AP214',
  outputFile: path.basename(outputPath),
  outputBytes: Buffer.byteLength(glb),
  meshCount: imported.meshes.length,
  triangleCount,
  boundsMeters: {
    min: bounds.min.toArray(),
    max: bounds.max.toArray(),
    size: size.toArray(),
  },
  conversion: {
    type: 'technical format conversion and triangulation',
    linearDeflectionMeters: LINEAR_DEFLECTION_METERS,
    angularDeflectionRadians: ANGULAR_DEFLECTION_RADIANS,
    manualMaterialReassignment: false,
    meshRenaming: false,
    fingerRegrouping: false,
    embeddedFingerAnimation: false,
  },
  license: {
    id: 'CC-BY-ND-4.0',
    rightsHolders: ['CADENAS GmbH', 'SCHUNK SE & Co. KG'],
    sourceProductUrl: 'https://schunk.com/in/en/gripping-systems/parallel-gripper/co-act-egp-c/co-act-egp-c-40-n-n-m1013/p/000000000001359018',
  },
};
fs.writeFileSync(outputPath.replace(/\.glb$/i, '.manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(JSON.stringify(manifest, null, 2));
