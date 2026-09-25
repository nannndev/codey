import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { ArcadeEngine, ArcadeEvent, Judgment } from "@/lib/arcade-engine";

/** One lane's key: legend plus keycap colors from the player's colorway. */
export interface LaneSkin {
  label: string;
  cap: string;
  legend: string;
}

const LANE_GAP = 1.3;
const SPAWN_Z = -34;
const NOTE_Y = 0.42;
const KEY_SIZE = 1;
const KEY_HEIGHT = 0.55;
const GRAVITY = -22;

const JUDGMENT_COLORS: Record<Exclude<Judgment, "miss">, string> = {
  perfect: "#fbbf24",
  great: "#22d3ee",
  good: "#4ade80",
};

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
}

interface Tumbler {
  mesh: THREE.Group;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
  life: number;
}

function legendTexture(label: string, color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d")!;
  context.fillStyle = color;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `800 ${label.length > 1 ? 110 : 150}px ui-monospace, "JetBrains Mono", monospace`;
  context.fillText(label, 128, 138);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/**
 * Three.js renderer for Arcade: keycap notes slide down a highway into a row
 * of receptor keys. It only draws; all timing comes from ArcadeEngine.
 */
export class ArcadeScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
  private container: HTMLElement;
  private resizeObserver: ResizeObserver;
  private reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  private keyGeometry = new RoundedBoxGeometry(KEY_SIZE, KEY_HEIGHT, KEY_SIZE, 3, 0.14);
  private legendGeometry = new THREE.PlaneGeometry(0.78, 0.78);
  private particleGeometry = new THREE.BoxGeometry(0.12, 0.12, 0.12);
  private laneMaterials: Array<{ cap: THREE.MeshStandardMaterial; legend: THREE.MeshBasicMaterial }> = [];
  private disposables: Array<{ dispose: () => void }> = [];

  private world = new THREE.Group();
  private laneGroup = new THREE.Group();
  private receptors: THREE.Group[] = [];
  private receptorPress: number[] = [];
  private receptorFlash: number[] = [];
  private laneLines: THREE.MeshBasicMaterial;
  private strikeMaterial: THREE.MeshBasicMaterial;
  private strikeLight: THREE.PointLight;
  private noteMeshes = new Map<number, THREE.Group>();
  private particles: Particle[] = [];
  private particleMaterials = Object.fromEntries(
    Object.entries(JUDGMENT_COLORS).map(([judgment, color]) => [judgment, new THREE.MeshBasicMaterial({ color })]),
  ) as Record<Exclude<Judgment, "miss">, THREE.MeshBasicMaterial>;
  private tumblers: Tumbler[] = [];
  private decor: Array<{ mesh: THREE.Group; spin: THREE.Vector3 }> = [];
  private accent = new THREE.Color("#f59e0b");
  private shake = 0;
  private lastFrame = performance.now();
  private laneCount = 8;

  constructor(container: HTMLElement, lanes: LaneSkin[], accent: string) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.domElement.className = "arcade-canvas";
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color("#07080d");
    this.scene.fog = new THREE.Fog("#07080d", 22, 70);
    this.scene.add(new THREE.HemisphereLight("#b8c4ff", "#10121a", 1.1));
    const sun = new THREE.DirectionalLight("#ffffff", 1.6);
    sun.position.set(4, 10, 6);
    this.scene.add(sun);
    this.strikeLight = new THREE.PointLight(this.accent, 0, 9, 1.6);
    this.strikeLight.position.set(0, 1.6, 0.4);
    this.scene.add(this.strikeLight);

    this.laneLines = new THREE.MeshBasicMaterial({ color: this.accent, transparent: true, opacity: 0.28 });
    this.strikeMaterial = new THREE.MeshBasicMaterial({ color: this.accent, transparent: true, opacity: 0.85 });
    this.disposables.push(this.keyGeometry, this.legendGeometry, this.particleGeometry, this.laneLines, this.strikeMaterial);

    this.scene.add(this.world);
    this.world.add(this.laneGroup);
    this.buildDecor();
    this.setLanes(lanes, accent);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  private laneX(lane: number) {
    return (lane - (this.laneCount - 1) / 2) * LANE_GAP;
  }

  private makeKey(lane: number, material?: THREE.MeshStandardMaterial) {
    const group = new THREE.Group();
    const skin = this.laneMaterials[lane];
    const body = new THREE.Mesh(this.keyGeometry, material ?? skin.cap);
    const legend = new THREE.Mesh(this.legendGeometry, skin.legend);
    legend.rotation.x = -Math.PI / 2;
    legend.position.y = KEY_HEIGHT / 2 + 0.005;
    group.add(body, legend);
    return group;
  }

  /** Rebuild lane keys, track and receptors for a new key set or colorway. */
  setLanes(lanes: LaneSkin[], accent: string) {
    this.laneCount = lanes.length;
    this.accent.set(accent);
    this.laneLines.color.set(accent);
    this.strikeMaterial.color.set(accent);
    this.strikeLight.color.set(accent);

    for (const { cap, legend } of this.laneMaterials) {
      cap.dispose();
      legend.map?.dispose();
      legend.dispose();
    }
    this.laneMaterials = lanes.map((lane) => ({
      cap: new THREE.MeshStandardMaterial({ color: lane.cap, roughness: 0.42, metalness: 0.06, emissive: "#000000" }),
      legend: new THREE.MeshBasicMaterial({ map: legendTexture(lane.label, lane.legend), transparent: true, depthWrite: false }),
    }));

    this.clearNotes();
    this.laneGroup.clear();
    const width = this.laneCount * LANE_GAP + 0.5;

    const track = new THREE.Mesh(
      new THREE.PlaneGeometry(width, 42.2),
      new THREE.MeshStandardMaterial({ color: "#0d0f17", roughness: 0.9, metalness: 0 }),
    );
    track.rotation.x = -Math.PI / 2;
    track.position.set(0, 0, -19.9);
    this.laneGroup.add(track);
    this.disposables.push(track.geometry, track.material as THREE.Material);

    const lineGeometry = new THREE.BoxGeometry(0.04, 0.02, 42.2);
    this.disposables.push(lineGeometry);
    for (let i = 0; i <= this.laneCount; i += 1) {
      const line = new THREE.Mesh(lineGeometry, this.laneLines);
      line.position.set((i - this.laneCount / 2) * LANE_GAP, 0.01, -19.9);
      this.laneGroup.add(line);
    }

    const strikeGeometry = new THREE.BoxGeometry(width, 0.05, 0.08);
    this.disposables.push(strikeGeometry);
    const strike = new THREE.Mesh(strikeGeometry, this.strikeMaterial);
    strike.position.set(0, 0.04, -0.7);
    this.laneGroup.add(strike);

    const baseGeometry = new RoundedBoxGeometry(width + 0.3, 0.45, 2, 3, 0.18);
    const baseMaterial = new THREE.MeshStandardMaterial({ color: "#161925", roughness: 0.6, metalness: 0.2 });
    this.disposables.push(baseGeometry, baseMaterial);
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.set(0, -0.1, 0.1);
    this.laneGroup.add(base);

    this.receptors = lanes.map((_, lane) => {
      // Receptors own their material so a hit flash doesn't light every note.
      const material = this.laneMaterials[lane].cap.clone();
      this.disposables.push(material);
      const key = this.makeKey(lane, material);
      key.position.set(this.laneX(lane), 0.4, 0);
      this.laneGroup.add(key);
      return key;
    });
    this.receptorPress = lanes.map(() => 0);
    this.receptorFlash = lanes.map(() => 0);
  }

  private buildDecor() {
    const palette = ["#f59e0b", "#22d3ee", "#a78bfa", "#f472b6", "#4ade80", "#e5e7eb"];
    const count = 26;
    for (let i = 0; i < count; i += 1) {
      const material = new THREE.MeshStandardMaterial({ color: palette[i % palette.length], roughness: 0.5, transparent: true, opacity: 0.55 });
      this.disposables.push(material);
      const group = new THREE.Group();
      group.add(new THREE.Mesh(this.keyGeometry, material));
      const side = i % 2 === 0 ? -1 : 1;
      group.position.set(side * (9 + Math.random() * 16), 1 + Math.random() * 12, -12 - Math.random() * 48);
      group.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      const scale = 0.8 + Math.random() * 1.6;
      group.scale.setScalar(scale);
      this.scene.add(group);
      this.decor.push({ mesh: group, spin: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, 0).multiplyScalar(0.4) });
    }

    const starGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(600 * 3);
    for (let i = 0; i < 600; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * 140;
      positions[i * 3 + 1] = Math.random() * 50 - 5;
      positions[i * 3 + 2] = -20 - Math.random() * 90;
    }
    starGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const starMaterial = new THREE.PointsMaterial({ color: "#8b93b8", size: 0.18, transparent: true, opacity: 0.7 });
    this.disposables.push(starGeometry, starMaterial);
    this.scene.add(new THREE.Points(starGeometry, starMaterial));
  }

  private resize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (!width || !height) return;
    this.renderer.setSize(width, height, false);
    const aspect = width / height;
    this.camera.aspect = aspect;
    // Back the camera off until the receptor row (plus margin) fits the
    // horizontal field of view, whatever the stage's aspect ratio.
    const halfWidth = (this.laneCount * LANE_GAP) / 2 + 0.9;
    const halfHorizontalFov = Math.atan(Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * aspect);
    const distance = Math.max(9.2, halfWidth / Math.tan(halfHorizontalFov));
    this.camera.position.set(0, distance * 0.66, distance * 0.75);
    this.camera.lookAt(0, 0, -9);
    this.camera.updateProjectionMatrix();
  }

  handle(events: ArcadeEvent[]) {
    for (const event of events) {
      if (event.type === "hit") {
        const mesh = this.noteMeshes.get(event.note.id);
        if (mesh) {
          this.world.remove(mesh);
          this.noteMeshes.delete(event.note.id);
        }
        this.burst(event.lane, this.particleMaterials[event.judgment], event.judgment === "perfect" ? 16 : 10);
        this.receptorFlash[event.lane] = 1;
        this.strikeLight.intensity = event.judgment === "perfect" ? 26 : 16;
        this.strikeLight.position.x = this.laneX(event.lane);
      } else if (event.type === "miss") {
        this.tumble(event.note.id, event.lane);
        if (!this.reducedMotion) this.shake = 0.28;
      } else if (event.type === "overdrive") {
        this.laneLines.opacity = event.active ? 0.8 : 0.28;
      }
    }
  }

  /** Receptor press for any lane key, hit or not. */
  press(lane: number) {
    if (lane >= 0 && lane < this.receptorPress.length) this.receptorPress[lane] = 1;
  }

  private burst(lane: number, material: THREE.MeshBasicMaterial, count: number) {
    for (let i = 0; i < count; i += 1) {
      const mesh = new THREE.Mesh(this.particleGeometry, material);
      mesh.position.set(this.laneX(lane), 0.8, 0);
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.5 + Math.random() * 3.5;
      this.world.add(mesh);
      this.particles.push({
        mesh,
        velocity: new THREE.Vector3(Math.cos(angle) * speed, 4 + Math.random() * 4, Math.sin(angle) * speed * 0.6),
        life: 0.6,
      });
    }
  }

  /** Missed notes turn red and fall off the highway. */
  private tumble(noteId: number, lane: number) {
    let mesh = this.noteMeshes.get(noteId);
    this.noteMeshes.delete(noteId);
    if (!mesh) {
      mesh = this.makeKey(lane);
      mesh.position.set(this.laneX(lane), NOTE_Y, 0);
      this.world.add(mesh);
    }
    const red = new THREE.MeshStandardMaterial({ color: "#ef4444", emissive: "#7f1d1d", roughness: 0.4 });
    (mesh.children[0] as THREE.Mesh).material = red;
    const side = lane < this.laneCount / 2 ? -1 : 1;
    this.tumblers.push({
      mesh,
      velocity: new THREE.Vector3(side * (1 + Math.random() * 2), 3 + Math.random() * 2, 5 + Math.random() * 2),
      spin: new THREE.Vector3(Math.random() * 8 - 4, Math.random() * 6 - 3, Math.random() * 8 - 4),
      life: 1.1,
    });
  }

  private clearNotes() {
    for (const mesh of this.noteMeshes.values()) this.world.remove(mesh);
    this.noteMeshes.clear();
  }

  /** Draw one frame for the engine's current clock. */
  frame(engine: ArcadeEngine, pressed: ReadonlySet<number>) {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    const clock = engine.time;

    const live = new Set<number>();
    for (const note of engine.notes) {
      if (note.judgment !== null || note.lane >= this.laneCount) continue;
      live.add(note.id);
      let mesh = this.noteMeshes.get(note.id);
      if (!mesh) {
        mesh = this.makeKey(note.lane);
        this.noteMeshes.set(note.id, mesh);
        this.world.add(mesh);
      }
      const remaining = (note.time - clock) / note.travel;
      mesh.position.set(this.laneX(note.lane), NOTE_Y, SPAWN_Z * remaining);
      // Fade in from the fog and settle as the note approaches.
      const approach = Math.max(0, Math.min(1, 1 - remaining));
      mesh.rotation.x = (1 - approach) * 0.25;
    }
    for (const [id, mesh] of this.noteMeshes) {
      if (!live.has(id)) {
        this.world.remove(mesh);
        this.noteMeshes.delete(id);
      }
    }

    this.receptors.forEach((key, lane) => {
      const held = pressed.has(lane);
      this.receptorPress[lane] = held ? 1 : Math.max(0, this.receptorPress[lane] - dt * 9);
      this.receptorFlash[lane] = Math.max(0, this.receptorFlash[lane] - dt * 3.5);
      key.position.y = 0.4 - this.receptorPress[lane] * 0.16;
      const material = (key.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
      material.emissive.copy(this.accent).multiplyScalar(Math.max(this.receptorFlash[lane], this.receptorPress[lane] * 0.35));
    });

    this.strikeLight.intensity = Math.max(0, this.strikeLight.intensity - dt * 60);
    const overdrive = engine.overdriveProgress() > 0;
    this.strikeMaterial.opacity = overdrive ? 0.7 + Math.sin(now / 90) * 0.3 : 0.85;

    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const particle = this.particles[i];
      particle.life -= dt;
      particle.velocity.y += GRAVITY * dt;
      particle.mesh.position.addScaledVector(particle.velocity, dt);
      particle.mesh.scale.setScalar(Math.max(0.01, particle.life / 0.6));
      if (particle.life <= 0) {
        this.world.remove(particle.mesh);
        this.particles.splice(i, 1);
      }
    }

    for (let i = this.tumblers.length - 1; i >= 0; i -= 1) {
      const tumbler = this.tumblers[i];
      tumbler.life -= dt;
      tumbler.velocity.y += GRAVITY * dt;
      tumbler.mesh.position.addScaledVector(tumbler.velocity, dt);
      tumbler.mesh.rotation.x += tumbler.spin.x * dt;
      tumbler.mesh.rotation.y += tumbler.spin.y * dt;
      tumbler.mesh.rotation.z += tumbler.spin.z * dt;
      if (tumbler.life <= 0) {
        this.world.remove(tumbler.mesh);
        ((tumbler.mesh.children[0] as THREE.Mesh).material as THREE.Material).dispose();
        this.tumblers.splice(i, 1);
      }
    }

    if (!this.reducedMotion) {
      for (const item of this.decor) {
        item.mesh.rotation.x += item.spin.x * dt;
        item.mesh.rotation.y += item.spin.y * dt;
      }
    }

    this.shake = Math.max(0, this.shake - dt * 1.2);
    this.world.position.set((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake * 0.5, 0);

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.resizeObserver.disconnect();
    this.clearNotes();
    for (const { cap, legend } of this.laneMaterials) {
      cap.dispose();
      legend.map?.dispose();
      legend.dispose();
    }
    for (const item of this.disposables) item.dispose();
    for (const material of Object.values(this.particleMaterials)) material.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
