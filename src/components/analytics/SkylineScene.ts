import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { KEYBOARD_ROWS } from "@/lib/keyboard-layout";
import type { KeyColumn } from "@/lib/key-metrics";

const GAP = 0.12;
const ROW_PITCH = 1.12;
const BASE_HEIGHT = 0.22;
const MAX_EXTRA = 3.4;

interface KeyNode {
  id: string;
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  legend: THREE.Mesh;
  current: number;
  target: number;
  delay: number;
  color: THREE.Color;
  targetColor: THREE.Color;
}

function legendTexture(label: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#ffffff";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `800 ${label.length > 2 ? 34 : 64}px ui-monospace, "JetBrains Mono", monospace`;
  context.fillText(label, 64, 68);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * "Keyboard skyline": every key is a column whose height and color encode
 * the chosen metric. Draws and animates only; values come from key-metrics.
 */
export class SkylineScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
  private controls: OrbitControls;
  private container: HTMLElement;
  private resizeObserver: ResizeObserver;
  private visibilityObserver: IntersectionObserver;
  private reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  private nodes = new Map<string, KeyNode>();
  private disposables: Array<{ dispose: () => void }> = [];
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private hovered: string | null = null;
  private selected: string | null = null;
  private visible = true;
  private frameId = 0;
  private lastFrame = performance.now();
  private startedAt = performance.now();
  private boardWidth = 16;
  private downAt: { x: number; y: number } | null = null;
  private onHover?: (id: string | null, x: number, y: number) => void;
  private onSelect?: (id: string | null) => void;

  constructor(container: HTMLElement, handlers: {
    onHover?: (id: string | null, x: number, y: number) => void;
    onSelect?: (id: string | null) => void;
  } = {}) {
    this.container = container;
    this.onHover = handlers.onHover;
    this.onSelect = handlers.onSelect;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.domElement.className = "skyline-canvas";
    container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.HemisphereLight("#dfe6ff", "#1a1d29", 1.3));
    const sun = new THREE.DirectionalLight("#ffffff", 2.4);
    sun.position.set(-6, 14, 9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 1024);
    Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 6, bottom: -6 });
    sun.shadow.radius = 3;
    this.scene.add(sun);
    const rim = new THREE.DirectionalLight("#7aa2ff", 1.1);
    rim.position.set(8, 6, -8);
    this.scene.add(rim);

    this.buildBoard();

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableZoom = false; // never hijack page scroll
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minPolarAngle = 0.35;
    this.controls.maxPolarAngle = 1.2;
    this.controls.minAzimuthAngle = -0.9;
    this.controls.maxAzimuthAngle = 0.9;
    this.controls.target.set(0, 1.4, 0);
    // On touch screens a drag should scroll the page, not spin the board;
    // taps still select keys.
    if (window.matchMedia("(pointer: coarse)").matches) {
      this.controls.enableRotate = false;
      this.renderer.domElement.style.touchAction = "pan-y";
    }

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.visibilityObserver = new IntersectionObserver(([entry]) => { this.visible = entry.isIntersecting; });
    this.visibilityObserver.observe(container);
    this.resize();

    const canvas = this.renderer.domElement;
    canvas.addEventListener("pointermove", this.handlePointerMove);
    canvas.addEventListener("pointerleave", this.handlePointerLeave);
    canvas.addEventListener("pointerdown", this.handlePointerDown);
    canvas.addEventListener("pointerup", this.handlePointerUp);
    this.loop();
  }

  private track<T extends { dispose: () => void }>(item: T): T {
    this.disposables.push(item);
    return item;
  }

  private buildBoard() {
    const widths = new Map<number, THREE.BufferGeometry>();
    const geometryFor = (w: number) => {
      if (!widths.has(w)) {
        const geometry = new RoundedBoxGeometry(w - GAP, 1, 1 - GAP, 2, 0.07);
        geometry.translate(0, 0.5, 0); // grow upward from the base
        widths.set(w, this.track(geometry));
      }
      return widths.get(w)!;
    };
    const legendGeometry = this.track(new THREE.PlaneGeometry(0.62, 0.62));

    const rowWidth = (row: typeof KEYBOARD_ROWS[number]) => row.reduce((sum, key) => sum + (key.w ?? 1), 0);
    this.boardWidth = Math.max(...KEYBOARD_ROWS.map(rowWidth));
    const depth = KEYBOARD_ROWS.length * ROW_PITCH;

    const plate = new THREE.Mesh(
      this.track(new RoundedBoxGeometry(this.boardWidth + 0.8, 0.3, depth + 0.6, 3, 0.15)),
      this.track(new THREE.MeshStandardMaterial({ color: "#151823", roughness: 0.7, metalness: 0.2 })),
    );
    plate.position.y = -0.15;
    plate.receiveShadow = true;
    this.scene.add(plate);

    const floor = new THREE.Mesh(this.track(new THREE.PlaneGeometry(60, 40)), this.track(new THREE.ShadowMaterial({ opacity: 0.25 })));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.3;
    floor.receiveShadow = true;
    this.scene.add(floor);

    KEYBOARD_ROWS.forEach((row, rowIndex) => {
      let x = -this.boardWidth / 2;
      const z = (rowIndex - (KEYBOARD_ROWS.length - 1) / 2) * ROW_PITCH;
      for (const key of row) {
        const w = key.w ?? 1;
        const material = this.track(new THREE.MeshStandardMaterial({ color: "#2a2d38", roughness: 0.4, metalness: 0.08 }));
        const mesh = new THREE.Mesh(geometryFor(w), material);
        mesh.position.set(x + w / 2, 0, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.keyId = key.id;
        this.scene.add(mesh);

        const legend = new THREE.Mesh(
          legendGeometry,
          this.track(new THREE.MeshBasicMaterial({ map: this.track(legendTexture(key.label || "␣")), transparent: true, depthWrite: false, opacity: 0.9 })),
        );
        legend.rotation.x = -Math.PI / 2;
        legend.position.set(x + w / 2, BASE_HEIGHT + 0.005, z);
        this.scene.add(legend);

        const color = new THREE.Color("#2a2d38");
        this.nodes.set(key.id, {
          id: key.id,
          mesh,
          material,
          legend,
          current: BASE_HEIGHT,
          target: BASE_HEIGHT,
          // Staggered rise from left to right on first reveal.
          delay: (x + this.boardWidth / 2) / this.boardWidth * 0.6 + rowIndex * 0.05,
          color,
          targetColor: color.clone(),
        });
        x += w;
      }
    });
  }

  /** Apply new heights (0-1) and colors; columns animate toward them. */
  setColumns(columns: KeyColumn[]) {
    for (const column of columns) {
      const node = this.nodes.get(column.id);
      if (!node) continue;
      node.target = column.tracked ? BASE_HEIGHT + 0.12 + column.height * MAX_EXTRA : BASE_HEIGHT;
      node.targetColor.set(column.color);
      node.material.transparent = !column.tracked;
      node.material.opacity = column.tracked ? 1 : 0.55;
      if (this.reducedMotion) {
        node.current = node.target;
        node.color.copy(node.targetColor);
      }
    }
  }

  setSelected(id: string | null) {
    this.selected = id;
  }

  private resize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (!width || !height) return;
    this.renderer.setSize(width, height, false);
    const aspect = width / height;
    this.camera.aspect = aspect;
    // Fit the whole board horizontally with a margin.
    // Extra margin: the front row sits closer to the camera and looks wider.
    const halfWidth = this.boardWidth / 2 + 2.6;
    const tanH = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * aspect;
    const distance = Math.max(halfWidth / tanH, 14);
    // About 48 degrees above the board so tall front columns don't hide the back rows.
    const direction = new THREE.Vector3(0, 1.1, 1).normalize();
    this.camera.position.copy(direction.multiplyScalar(distance)).add(new THREE.Vector3(0, 1.4, 0));
    this.camera.updateProjectionMatrix();
    this.controls?.update();
  }

  private pick(event: PointerEvent): string | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects([...this.nodes.values()].map((node) => node.mesh), false)[0];
    return (hit?.object.userData.keyId as string | undefined) ?? null;
  }

  private handlePointerMove = (event: PointerEvent) => {
    const id = this.pick(event);
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (id !== this.hovered) {
      this.hovered = id;
      this.renderer.domElement.style.cursor = id ? "pointer" : "grab";
    }
    this.onHover?.(id, event.clientX - rect.left, event.clientY - rect.top);
  };

  private handlePointerLeave = () => {
    this.hovered = null;
    this.onHover?.(null, 0, 0);
  };

  private handlePointerDown = (event: PointerEvent) => {
    this.downAt = { x: event.clientX, y: event.clientY };
  };

  // A click, not the end of a drag-to-rotate, selects a key.
  private handlePointerUp = (event: PointerEvent) => {
    if (!this.downAt) return;
    const moved = Math.hypot(event.clientX - this.downAt.x, event.clientY - this.downAt.y);
    this.downAt = null;
    if (moved > 5) return;
    const id = this.pick(event);
    this.onSelect?.(id === this.selected ? null : id);
  };

  private loop = () => {
    this.frameId = requestAnimationFrame(this.loop);
    if (!this.visible) {
      this.lastFrame = performance.now();
      return;
    }
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    const elapsed = (now - this.startedAt) / 1000;

    for (const node of this.nodes.values()) {
      if (!this.reducedMotion && elapsed > node.delay) {
        node.current += (node.target - node.current) * Math.min(1, dt * 6);
        node.color.lerp(node.targetColor, Math.min(1, dt * 5));
      }
      node.mesh.scale.y = node.current;
      node.legend.position.y = node.current + 0.005;
      node.material.color.copy(node.color);
      const highlight = node.id === this.selected ? 0.55 : node.id === this.hovered ? 0.25 : 0;
      node.material.emissive.copy(node.color).multiplyScalar(highlight);
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    cancelAnimationFrame(this.frameId);
    this.resizeObserver.disconnect();
    this.visibilityObserver.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("pointermove", this.handlePointerMove);
    canvas.removeEventListener("pointerleave", this.handlePointerLeave);
    canvas.removeEventListener("pointerdown", this.handlePointerDown);
    canvas.removeEventListener("pointerup", this.handlePointerUp);
    this.controls.dispose();
    for (const item of this.disposables) item.dispose();
    this.renderer.dispose();
    canvas.remove();
  }
}
