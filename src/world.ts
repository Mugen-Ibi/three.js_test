import * as THREE from 'three';
import type { Font } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

type Solid = { position: [number, number, number]; size: [number, number, number]; rotation?: [number, number, number] };
type DriftingWindow = { group: THREE.Group; rest: THREE.Vector3; phase: number; lean: number };

/** The page's hidden architecture. All positions are in the same space as the page. */
export class World {
  public readonly root = new THREE.Group();
  public readonly monitorGroup = new THREE.Group();
  public readonly monitorCenter = new THREE.Vector3(0, 2, -175);
  public readonly monitorScreen: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;

  private readonly boxes = new THREE.BoxGeometry(1, 1, 1);
  private readonly windows: DriftingWindow[] = [];
  private readonly cursorEcho = new THREE.Group();
  private readonly cursorOutline = new THREE.Group();
  private readonly monitorShell: THREE.Mesh;
  private readonly monitorFoot: THREE.Mesh;
  private readonly monitorStatus: THREE.Mesh;
  private readonly chamberInscription: THREE.Mesh;
  private readonly materials = {
    ink: new THREE.MeshStandardMaterial({ color: 0x242624, roughness: 0.79, metalness: 0.1 }),
    charcoal: new THREE.MeshStandardMaterial({ color: 0x383a36, roughness: 0.88 }),
    paper: new THREE.MeshStandardMaterial({ color: 0xe2e1d9, roughness: 0.94 }),
    bright: new THREE.MeshStandardMaterial({ color: 0xefeee7, roughness: 0.89 }),
    concrete: new THREE.MeshStandardMaterial({ color: 0xc5c5bc, roughness: 1 }),
    accent: new THREE.MeshStandardMaterial({ color: 0xe54835, roughness: 0.66 }),
    rules: new THREE.MeshBasicMaterial({ color: 0xbdbeb4, toneMapped: false }),
  };
  private aspect: number;

  constructor(scene: THREE.Scene, font: Font, homepage: THREE.CanvasTexture, aspect: number) {
    this.aspect = aspect;
    this.root.name = 'The architecture inside the browser';
    scene.add(this.root);

    this.buildArchitecture();
    this.buildTypography(font);
    this.buildWindows(font);
    this.buildCursorEcho();
    this.buildFloor();

    this.monitorGroup.name = 'The original browser';
    this.monitorGroup.position.copy(this.monitorCenter);
    this.root.add(this.monitorGroup);

    this.monitorShell = this.box([0, 0, -0.34], [5.4 * aspect + 0.72, 6.16, 0.62], this.materials.ink, this.monitorGroup);
    this.monitorScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(5.4 * aspect, 5.4),
      new THREE.MeshBasicMaterial({ map: homepage, toneMapped: false, side: THREE.FrontSide }),
    );
    this.monitorScreen.name = 'Return to the beginning';
    this.monitorScreen.position.z = 0.004;
    this.monitorGroup.add(this.monitorScreen);

    // A physical bezel, feet and plinth make the little rectangle an object, not a portal effect.
    this.box([0, -3.84, -0.46], [0.36, 1.52, 0.38], this.materials.charcoal, this.monitorGroup);
    this.monitorFoot = this.box([0, -4.695, -0.18], [3.1, 0.18, 1.8], this.materials.ink, this.monitorGroup);
    this.monitorStatus = this.box([5.4 * aspect / 2 - 0.14, -2.91, 0.01], [0.075, 0.033, 0.025], this.materials.accent, this.monitorGroup);
    this.box([0, -2.78, 0.01], [0.44, 0.015, 0.02], this.materials.concrete, this.monitorGroup);
    this.box([0, -7.45, -175.4], [10.4, 8.9, 7.8], this.materials.paper);
    this.box([0, -2.9, -175.4], [10.65, 0.23, 8.05], this.materials.bright);

    // A recess behind the computer creates a broad, silent final chamber.
    this.box([0, 5, -192], [76, 34, 0.65], this.materials.paper);
    this.addText(font, 'YOU ARE HERE.', 1.1, new THREE.Vector3(0, -8.7, -170.99), this.materials.ink, 'center', 0.028);
    this.addText(font, '01', 5, new THREE.Vector3(-26, -10, -191.54), this.materials.concrete, 'left', 0.04);
    this.chamberInscription = this.addText(font, 'THE ORIGINAL IS INSIDE THE COPY.', 0.52, new THREE.Vector3(0, 12.2, -191.58), this.materials.charcoal, 'center', 0.018);
    this.chamberInscription.visible = aspect > .9;
  }

  private box(position: [number, number, number], size: [number, number, number], material: THREE.Material, parent: THREE.Object3D = this.root): THREE.Mesh {
    const mesh = new THREE.Mesh(this.boxes, material);
    mesh.position.set(...position);
    mesh.scale.set(...size);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  private instances(name: string, solids: Solid[], material: THREE.Material): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(this.boxes, material, solids.length);
    const transform = new THREE.Object3D();
    solids.forEach((solid, index) => {
      transform.position.set(...solid.position);
      transform.scale.set(...solid.size);
      transform.rotation.set(...(solid.rotation ?? [0, 0, 0]));
      transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);
    });
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    this.root.add(mesh);
    return mesh;
  }

  private buildArchitecture(): void {
    const pale: Solid[] = [];
    const dark: Solid[] = [];
    const concrete: Solid[] = [];

    // Page margins become impossible, interlocking lintels. Their negative space is the route.
    const thresholds = [
      { z: -34, x: -3, w: 36, h: 31, roll: -0.025 },
      { z: -59, x: 5, w: 40, h: 36, roll: 0.045 },
      { z: -89, x: -4, w: 44, h: 40, roll: -0.055 },
      { z: -125, x: 1, w: 44, h: 42, roll: 0.025 },
      { z: -155, x: 0, w: 48, h: 42, roll: 0 },
    ];
    for (const frame of thresholds) {
      const y = frame.h / 2 - 12;
      const half = frame.w / 2;
      for (const side of [-1, 1]) {
        pale.push({ position: [frame.x + side * half, y, frame.z], size: [1.6, frame.h, 3.7], rotation: [0, 0, frame.roll] });
        dark.push({ position: [frame.x + side * (half + 1.07), y, frame.z - 2.7], size: [0.13, frame.h + 1.4, 0.23] });
      }
      pale.push({ position: [frame.x, frame.h - 12, frame.z], size: [frame.w + 2.4, 1.65, 3.7], rotation: [0, 0, frame.roll] });
      dark.push({ position: [frame.x, frame.h - 10.84, frame.z - 2.7], size: [frame.w + 2.4, 0.13, 0.23] });
    }

    for (let i = 0; i < 12; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const z = -29 - i * 10.7;
      const h = 12 + (i * 7 % 17);
      concrete.push({ position: [side * (29 + i % 3 * 6), h / 2 - 12, z], size: [6 + i % 4 * 2, h, 4.6] });
      pale.push({ position: [side * (27 + i % 3 * 4), h - 12, z + 1.5], size: [17 + i % 3 * 4, 0.42, 13] });
    }

    // Floating page sheets at ceiling height; they deliberately never occupy the camera corridor.
    pale.push(
      { position: [-14, 16, -46], size: [30, 0.35, 16], rotation: [0.07, 0.12, -0.16] },
      { position: [16, 22, -74], size: [37, 0.35, 21], rotation: [-0.1, -0.16, 0.12] },
      { position: [-12, 23, -115], size: [31, 0.35, 22], rotation: [0.12, 0.1, -0.15] },
    );
    dark.push(
      { position: [-17, -10.4, -45], size: [22, 2.9, 19] },
      { position: [21, -10.2, -84], size: [23, 3.4, 19] },
      { position: [-23, -10.6, -121], size: [20, 2.7, 24] },
    );
    this.instances('Folded paper architecture', pale, this.materials.paper);
    this.instances('Typesetting furniture', dark, this.materials.ink);
    this.instances('Outside the margins', concrete, this.materials.concrete);
  }

  private addText(font: Font, word: string, size: number, position: THREE.Vector3, material: THREE.Material, alignment: 'left' | 'right' | 'center' = 'left', depth = 1.9): THREE.Mesh {
    const geometry = new TextGeometry(word, { font, size, depth, curveSegments: 5, bevelEnabled: depth > 0.1, bevelThickness: 0.035, bevelSize: 0.025, bevelSegments: 1 });
    geometry.computeBoundingBox();
    const width = geometry.boundingBox!.max.x - geometry.boundingBox!.min.x;
    if (alignment === 'right') geometry.translate(-width, 0, 0);
    if (alignment === 'center') geometry.translate(-width / 2, 0, 0);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.root.add(mesh);
    return mesh;
  }

  private buildTypography(font: Font): void {
    // Real extruded type, at building scale. Its edges persist as the camera passes behind it.
    this.addText(font, 'BROW', 12.5, new THREE.Vector3(-13, -9.8, -39), this.materials.ink, 'right', 3.3);
    this.addText(font, 'SER', 12.5, new THREE.Vector3(13.5, -9.7, -45), this.materials.ink, 'left', 3.3);
    const inside = this.addText(font, 'INSIDE', 10.8, new THREE.Vector3(-18.5, -9.8, -71), this.materials.ink, 'right', 3.7);
    inside.rotation.y = 0.16;
    const world = this.addText(font, 'WORLD', 13.5, new THREE.Vector3(17, -8.3, -100), this.materials.ink, 'left', 4);
    world.rotation.y = -0.21;
    this.addText(font, 'ENTER', 8.6, new THREE.Vector3(-13.8, 15.8, -100), this.materials.charcoal, 'right', 2.5);
    this.addText(font, 'YOU', 16, new THREE.Vector3(-17.5, -9.5, -136), this.materials.ink, 'right', 3.5);
    this.addText(font, 'ARE', 11, new THREE.Vector3(20.2, -9.8, -140), this.materials.charcoal, 'left', 3.2);

    this.addText(font, 'NO OUTSIDE', 0.8, new THREE.Vector3(13.6, 0.7, -40.5), this.materials.charcoal, 'left', 0.018);
    this.addText(font, 'VIEWPORT / 002', 0.59, new THREE.Vector3(-14.3, 13.6, -70), this.materials.charcoal, 'right', 0.018);
    this.addText(font, 'THE WINDOW WAS A ROOM.', 0.62, new THREE.Vector3(17, -9.9, -95.8), this.materials.charcoal, 'left', 0.018);
    this.addText(font, 'CURSOR, TO SCALE', 0.68, new THREE.Vector3(-17.4, -8.3, -110), this.materials.charcoal, 'right', 0.018);
  }

  private buildWindows(font: Font): void {
    const planes = [
      [-19, 6, -28, 10.4, 7, 0.16],
      [19, 10, -52, 12.2, 8.4, -0.14],
      [-18, 9, -65, 9.5, 6.7, 0.24],
      [22, 15, -80, 12.6, 8.6, -0.18],
      [-24, 17, -96, 13.8, 9.2, 0.15],
      [18.5, 7, -116, 8.4, 6, -0.13],
      [-19, 17, -135, 10.8, 7.2, 0.14],
    ];
    const ruleSolids: Solid[] = [];
    planes.forEach(([x, y, z, w, h, ry], index) => {
      const group = new THREE.Group();
      group.position.set(x, y, z);
      group.rotation.y = ry;
      group.rotation.z = (index % 2 ? 1 : -1) * 0.045;
      this.root.add(group);
      this.box([0, 0, 0], [w, h, 0.35], this.materials.ink, group);
      this.box([0, h / 2 - 0.52, 0.19], [w - 0.64, 0.035, 0.025], this.materials.rules, group);
      // Page content is etched on one mesh; UI fragments remain legible at architectural scale.
      const positions: number[] = [];
      const addRule = (x1: number, y1: number, x2: number, y2: number): void => { positions.push(x1, y1, 0.199, x2, y2, 0.199); };
      const left = -w / 2 + 0.58;
      const right = w / 2 - 0.58;
      for (let j = 0; j < 3; j++) {
        addRule(left + j * 0.18, h / 2 - 0.28, left + j * 0.18 + 0.09, h / 2 - 0.28);
      }
      addRule(left, h / 2 - 1.55, right - w * 0.25, h / 2 - 1.55);
      addRule(left, h / 2 - 1.79, right - w * 0.34, h / 2 - 1.79);
      addRule(left, -h / 2 + 1.03, right, -h / 2 + 1.03);
      addRule(left, -h / 2 + 0.64, right - w * 0.17, -h / 2 + 0.64);
      const mid = -w * 0.03;
      addRule(mid, -h / 2 + 1.5, mid, h / 2 - 2.22);
      addRule(left, -h / 2 + 1.5, left, h / 2 - 2.22);
      addRule(left, h / 2 - 2.22, mid, h / 2 - 2.22);
      addRule(left, -h / 2 + 1.5, mid, -h / 2 + 1.5);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      group.add(new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0xbfc0b7, transparent: true, opacity: 0.65 })));
      this.windows.push({ group, rest: group.position.clone(), phase: index * 1.78, lean: ry });

      // Hanging alignment wires extend past the panels and convey the scale of the typesetting grid.
      ruleSolids.push({ position: [x - w / 2 - 0.7, 12, z - 1], size: [0.025, 50, 0.025] });
    });
    this.instances('Alignment wires', ruleSolids, this.materials.concrete);
    this.addText(font, 'ESC', 3.5, new THREE.Vector3(19.7, 3.2, -124), this.materials.paper, 'center', 0.5);
  }

  private buildCursorEcho(): void {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0, 12);
    shape.lineTo(8.1, 3.8);
    shape.lineTo(4.8, 3.9);
    shape.lineTo(7.2, -1.35);
    shape.lineTo(4.95, -2.4);
    shape.lineTo(2.66, 2.76);
    shape.lineTo(0, 0);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.66, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 1, steps: 1 });
    const cursor = new THREE.Mesh(geometry, this.materials.ink);
    cursor.castShadow = true;
    cursor.receiveShadow = true;
    this.cursorEcho.add(cursor);
    this.cursorEcho.position.set(-27, -3, -112);
    this.cursorEcho.rotation.set(0.1, 0.19, -0.06);
    this.root.add(this.cursorEcho);

    // Its delayed outline gives the unsettling impression that the architecture is using the user.
    const echo = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 24), new THREE.LineBasicMaterial({ color: 0xe54835, transparent: true, opacity: 0.6 }));
    this.cursorOutline.add(echo);
    this.cursorOutline.position.copy(this.cursorEcho.position).add(new THREE.Vector3(-0.7, 0.5, -0.9));
    this.cursorOutline.rotation.copy(this.cursorEcho.rotation);
    this.root.add(this.cursorOutline);
  }

  private buildFloor(): void {
    this.box([0, -12.17, -104], [190, 0.3, 220], this.materials.bright);
    const vertices: number[] = [];
    for (let x = -84; x <= 84; x += 6) vertices.push(x, -11.998, 5, x, -11.998, -208);
    for (let z = 4; z >= -208; z -= 6) vertices.push(-84, -11.998, z, 84, -11.998, z);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    const grid = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0xb6b7ac, transparent: true, opacity: 0.57 }));
    grid.name = 'The baseline grid';
    this.root.add(grid);

    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -11.91, 2),
      new THREE.Vector3(0, -11.91, -29),
      new THREE.Vector3(7, -11.91, -57),
      new THREE.Vector3(-6, -11.91, -88),
      new THREE.Vector3(3, -11.91, -119),
      new THREE.Vector3(0, -11.91, -151),
      new THREE.Vector3(0, -11.91, -167),
    ]);
    const thread = new THREE.Mesh(new THREE.TubeGeometry(path, 150, 0.045, 5, false), this.materials.accent);
    thread.name = 'A thread back to the document';
    this.root.add(thread);

    // Measured ticks down the center give motion a readable scale even in low quality mode.
    const ticks: Solid[] = [];
    for (let z = -10; z >= -155; z -= 5) ticks.push({ position: [-1.3, -11.96, z], size: [0.4, 0.016, 0.045] });
    this.instances('Distance marks', ticks, this.materials.charcoal);
  }

  public setHomepage(texture: THREE.CanvasTexture, aspect: number): void {
    this.chamberInscription.visible = aspect > .9;
    this.monitorScreen.material.map = texture;
    this.monitorScreen.material.needsUpdate = true;
    if (Math.abs(aspect - this.aspect) > 0.0001) {
      this.aspect = aspect;
      this.monitorScreen.geometry.dispose();
      this.monitorScreen.geometry = new THREE.PlaneGeometry(5.4 * aspect, 5.4);
      this.monitorShell.scale.x = 5.4 * aspect + 0.72;
      this.monitorStatus.position.x = 5.4 * aspect / 2 - 0.14;
      this.monitorFoot.scale.x = Math.min(3.1, 5.4 * aspect * 0.8);
    }
  }

  public update(time: number, progress: number, pointer: THREE.Vector2, reducedMotion: boolean, loop: number): void {
    const amplitude = reducedMotion ? 0 : 1;
    for (const panel of this.windows) {
      panel.group.position.y = panel.rest.y + Math.sin(time * 0.3 + panel.phase) * 0.35 * amplitude;
      panel.group.rotation.y = panel.lean + Math.sin(time * 0.18 + panel.phase) * 0.023 * amplitude;
    }
    this.cursorEcho.position.x = -27 + pointer.x * 2.1 * amplitude;
    this.cursorEcho.position.y = -3 + pointer.y * 1.9 * amplitude;
    this.cursorEcho.rotation.z = -0.06 + pointer.x * -0.07 * amplitude;
    this.cursorOutline.position.x += (this.cursorEcho.position.x - 0.7 - this.cursorOutline.position.x) * 0.028;
    this.cursorOutline.position.y += (this.cursorEcho.position.y + 0.5 - this.cursorOutline.position.y) * 0.028;
    this.cursorOutline.rotation.z += (this.cursorEcho.rotation.z - this.cursorOutline.rotation.z) * 0.028;
    // On a second visit the cursor has turned toward the reader: a small, persistent memory.
    this.cursorEcho.rotation.y = 0.19 + Math.min(loop, 3) * 0.16;
    this.cursorOutline.rotation.y = this.cursorEcho.rotation.y;
    this.monitorStatus.visible = reducedMotion || Math.sin(time * 1.4) > -0.86;
    // Keeps the monitor texture unmodified: the same surface must take over the DOM exactly.
    this.monitorGroup.userData.proximity = progress;
  }

  public dispose(): void {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    this.root.traverse((object) => {
      const renderable = object as THREE.Mesh;
      if (renderable.geometry) geometries.add(renderable.geometry);
      if (renderable.material) {
        for (const material of Array.isArray(renderable.material) ? renderable.material : [renderable.material]) materials.add(material);
      }
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    this.root.removeFromParent();
    this.windows.length = 0;
  }
}
