import * as THREE from 'three';
import { toCanvas } from 'html-to-image';
import { clamp, smooth } from './timeline';

interface Panel { mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>; home: THREE.Vector3; delay: number; side: number; }

const vertexShader = /* glsl */`
  uniform float uBend;
  uniform float uTime;
  uniform vec2 uOrigin;
  varying vec2 vUv;
  varying float vShade;
  void main() {
    vUv = uv;
    vec3 p = position;
    float distanceToClick = distance(uv, uOrigin);
    float wave = sin(distanceToClick * 14.0 - uTime * 4.0);
    p.z += uBend * (p.x * p.x * 0.10 + wave * 0.18);
    vShade = clamp(1.0 - abs(uBend * p.x) * 0.07, 0.45, 1.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const fragmentShader = /* glsl */`
  uniform sampler2D uMap;
  varying vec2 vUv;
  varying float vShade;
  void main() {
    vec4 color = texture2D(uMap, vUv);
    gl_FragColor = vec4(color.rgb * vShade, 1.0);
    #include <colorspace_fragment>
  }
`;

/** One page snapshot, shared by the physical surface and the monitor. */
export class Surface {
  root = new THREE.Group();
  texture: THREE.CanvasTexture | null = null;
  private panels: Panel[] = [];
  private width = 1;
  private height = 1;
  private buildId = 0;
  constructor(private scene: THREE.Scene, private home: HTMLElement) { scene.add(this.root); this.root.visible = false; }

  async capture(camera: THREE.PerspectiveCamera): Promise<THREE.CanvasTexture> {
    const buildId = ++this.buildId;
    await document.fonts.ready;
    const width = window.innerWidth, height = window.innerHeight;
    // Freeze the hover state so the first 3D frame matches the paper surface.
    const settings = document.getElementById('controls')!.cloneNode(true) as HTMLElement;
    settings.removeAttribute('id');
    settings.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
    settings.setAttribute('aria-hidden', 'true');
    settings.classList.add('capture-settings');
    this.home.append(settings);
    let canvas: HTMLCanvasElement;
    try { canvas = await toCanvas(this.home, {
      width, height, pixelRatio: Math.min(window.devicePixelRatio || 1, 1.75),
      backgroundColor: '#e9e8e2',
      style: { visibility: 'visible', opacity: '1', transform: 'none' },
      filter: (node) => !(node instanceof HTMLElement && node.classList.contains('sr-only')),
    }); } finally { settings.remove(); }
    // foreignObject rasterizers can omit a flex-sized inline SVG. Repaint the
    // exact measured vector path so the page-to-GPU handoff retains its arrow.
    const svg = this.home.querySelector<SVGSVGElement>('.long-arrow')!;
    const path = svg.querySelector('path')!;
    const rect = svg.getBoundingClientRect();
    const scale = Math.min(rect.width / 400, rect.height / 110);
    const context = canvas.getContext('2d')!;
    context.save();
    context.scale(canvas.width / width, canvas.height / height);
    context.translate(rect.left + (rect.width - 400 * scale) / 2, rect.top + (rect.height - 110 * scale) / 2);
    context.scale(scale, scale);
    context.strokeStyle = getComputedStyle(path).stroke;
    context.lineWidth = 1.5;
    context.stroke(new Path2D(path.getAttribute('d')!));
    context.restore();
    if (buildId !== this.buildId) throw new Error('Surface capture superseded');
    const oldTexture = this.texture;
    this.texture = new THREE.CanvasTexture(canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    this.width = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 12 * camera.aspect;
    this.height = this.width / camera.aspect;
    this.clearPanels();
    const hero = this.home.querySelector('.hero')!.getBoundingClientRect();
    const entry = this.home.querySelector('.entry-row')!.getBoundingClientRect();
    const h1 = this.home.querySelector('h1')!.getBoundingClientRect();
    const gutter = parseFloat(getComputedStyle(this.home).paddingLeft);
    const split = width < 701 ? width - gutter : gutter + (width - gutter * 2) * .61;
    // The page is cut on its editorial seams, keeping recognizable lines whole.
    const cuts = [0, hero.top, Math.max(hero.top, h1.top + h1.height / 2), entry.top, entry.bottom, height];
    for (let row = 0; row < cuts.length - 1; row++) {
      const top = cuts[row], bottom = cuts[row + 1];
      if (bottom <= top) continue;
      const columns = row === 0 || row >= 3 ? [0, width] : [0, split, width];
      for (let col = 0; col < columns.length - 1; col++) {
        const left = columns[col], right = columns[col + 1];
        const w = (right - left) / width * this.width;
        const h = (bottom - top) / height * this.height;
        const geometry = new THREE.PlaneGeometry(w, h, 24, 12);
        const uv = geometry.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, (left + uv.getX(i) * (right - left)) / width, 1 - bottom / height + uv.getY(i) * (bottom - top) / height);
        const material = new THREE.ShaderMaterial({
          vertexShader, fragmentShader, side: THREE.DoubleSide,
          uniforms: { uMap: { value: this.texture }, uBend: { value: 0 }, uTime: { value: 0 }, uOrigin: { value: new THREE.Vector2(.5, .25) } },
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(((left + right) / 2 / width - .5) * this.width, (.5 - (top + bottom) / 2 / height) * this.height, 0);
        this.root.add(mesh);
        this.panels.push({ mesh, home: mesh.position.clone(), delay: row * .075 + col * .025, side: col === 1 ? 1 : row % 2 === 0 ? -1 : 1 });
      }
    }
    oldTexture?.dispose();
    return this.texture;
  }

  setOrigin(x: number, y: number) { for (const { mesh } of this.panels) mesh.material.uniforms.uOrigin.value.set(x, 1 - y); }
  update(amount: number, time: number, motion: number) {
    for (const panel of this.panels) {
      const p = smooth(clamp((amount - panel.delay) / (1 - panel.delay)));
      panel.mesh.position.copy(panel.home);
      panel.mesh.position.x += panel.side * p * (10 + motion * 3);
      panel.mesh.position.y += p * panel.home.y * .75;
      panel.mesh.position.z = -p * (8 + Math.abs(panel.home.y) * 3);
      panel.mesh.rotation.set(panel.side * p * (.04 + motion * .32), panel.side * p * (.08 + motion * 1.15), panel.side * p * motion * .12);
      panel.mesh.material.uniforms.uBend.value = Math.sin(p * Math.PI) * (.1 + motion * 1.2);
      panel.mesh.material.uniforms.uTime.value = time;
    }
  }
  private clearPanels() { for (const { mesh } of this.panels) { mesh.geometry.dispose(); mesh.material.dispose(); this.root.remove(mesh); } this.panels = []; }
  dispose() { this.buildId++; this.clearPanels(); this.texture?.dispose(); this.scene.remove(this.root); }
}
