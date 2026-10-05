# Third-party notices

## Doosan Robotics A0509 assets

The A0509 URDF and DAE assets originate from the Doosan Robotics ROS 2 repository.

- Copyright (c) 2024, Doosan Robotics Inc.
- License: BSD 3-Clause
- Source: https://github.com/DoosanRobotics/doosan-robot2

The full license text is provided in [`THIRD_PARTY_LICENSES/DOOSAN_BSD-3-CLAUSE.txt`](THIRD_PARTY_LICENSES/DOOSAN_BSD-3-CLAUSE.txt).

## SCHUNK Co-act EGP-C 40 CAD

The browser asset `dist/assets/grippers/schunk-egpc40/egpc40-public.glb` is a technical STEP AP214 to GLB format conversion with triangulation. The conversion manifest records the approximation tolerances and confirms that the distributed GLB does not contain the project's manual material reassignment, mesh renaming, finger regrouping, or embedded finger animation.

- Product: SCHUNK Co-act EGP-C 40-N-N-M1013, ID 1359018
- Original component rights: SCHUNK SE & Co. KG
- CAD database rights: CADENAS GmbH
- License: CC BY-ND 4.0
- Product source: https://schunk.com/in/en/gripping-systems/parallel-gripper/co-act-egp-c/co-act-egp-c-40-n-n-m1013/p/000000000001359018
- License: https://creativecommons.org/licenses/by-nd/4.0/
- CADENAS terms: https://www.cadenas.de/terms-of-use-3d-cad-models

The original supplier notice is provided beside the GLB as `license_schunk.txt`. Finger identification and motion groups are created only at runtime by the learning application using part names and geometric checks; they are not embedded in the distributed GLB.

