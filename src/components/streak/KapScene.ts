import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { FlameTier } from "@/utils/flame-tiers";
import { colorway, KAP_INK, type KapLook } from "@/utils/kap-art";
import type { StreakMood } from "@/lib/streak";

/**
 * Kap in 3D: an SA keycap (a tapered, dished rounded box) on MX-stem feet,
 * with the streak flame on top. Drag to spin, click to make him hop; his eyes
 * follow the pointer and he bounces along while you type.
 */

export interface KapSceneOptions {
  mood: StreakMood;
  tier: FlameTier | null;
  look: KapLook;
  /** React to keystrokes anywhere on the page. */
  typing?: boolean;
}

const SLEEP_CAP: [string, string, string] = ["#e4e4e7", "#c4c4cc", "#9f9fa9"];
const RISK_CAP: [string, string, string] = ["#fff7e6", "#f4dfb6", "#d9bd86"];
const ICE_CAP: [string, string, string] = ["#f0f9ff", "#bae6fd", "#7dd3fc"];

// Keycap proportions (world units).
const BASE = 1.8;
const TOP = 1.36;
const HEIGHT = 1.45;
const LIFT = 0.42;
const CENTER_Y = LIFT + HEIGHT / 2;

const halfWidthAt = (y: number) => THREE.MathUtils.lerp(BASE / 2, TOP / 2, THREE.MathUtils.clamp((y - LIFT) / HEIGHT, 0, 1));
const SLOPE = Math.atan((BASE - TOP) / 2 / HEIGHT);

export class KapScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  private container: HTMLElement;
  private resizeObserver: ResizeObserver;
  private visibilityObserver: IntersectionObserver;
  private reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  private disposables: Array<{ dispose: () => void }> = [];
  private frameId = 0;
  private visible = true;
  private last = performance.now();
  private time = 0;

  private root = new THREE.Group();
  private body = new THREE.Group();
  private face = new THREE.Group();
  private eyes: THREE.Object3D[] = [];
  private pupils = new THREE.Group();
  private arms: THREE.Group[] = [];
  private flame: THREE.Group | null = null;
  private flameLight: THREE.PointLight | null = null;
  private shadow!: THREE.Mesh;

  private options: KapSceneOptions;
  private pointer = new THREE.Vector2(0, 0);
  private spin = 0.35;
  private spinVelocity = 0;
  private dragging: { x: number; spin: number; moved: boolean } | null = null;
  private hop = 0;
  private nod = 0;
  private heat = 0;
  private nextBlink = 2;
  private blink = 0;

  constructor(container: HTMLElement, options: KapSceneOptions) {
    this.container = container;
    this.options = options;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.domElement.className = "kap-canvas";
    this.renderer.domElement.style.touchAction = "pan-y";
    this.renderer.domElement.style.cursor = "grab";
    container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.HemisphereLight("#ffffff", "#5b5f73", 1.7));
    const key = new THREE.DirectionalLight("#ffffff", 2.1);
    key.position.set(2.5, 6, 5);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight("#9ec5ff", 0.9);
    rim.position.set(-4, 3, -3);
    this.scene.add(rim);

    this.scene.add(this.root);
    this.root.add(this.body);
    this.build();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.visibilityObserver = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
    });
    this.visibilityObserver.observe(container);
    this.resize();

    const canvas = this.renderer.domElement;
    canvas.addEventListener("pointerdown", this.handlePointerDown);
    window.addEventListener("pointermove", this.handlePointerMove);
    window.addEventListener("pointerup", this.handlePointerUp);
    if (options.typing) window.addEventListener("keydown", this.handleKey);
    this.loop();
  }

  /* ---- Building ---- */

  private track<T extends { dispose: () => void }>(item: T): T {
    this.disposables.push(item);
    return item;
  }

  private material(color: string, options: THREE.MeshStandardMaterialParameters = {}) {
    return this.track(new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.05, ...options }));
  }

  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D = this.body) {
    const mesh = new THREE.Mesh(this.track(geometry), material);
    parent.add(mesh);
    return mesh;
  }

  private capColors(): [string, string, string] {
    const { mood, tier, look } = this.options;
    if (mood === "sleep") return SLEEP_CAP;
    if (mood === "risk") return RISK_CAP;
    if (mood === "frozen") return ICE_CAP;
    return colorway(look.color).cap ?? tier?.cap ?? SLEEP_CAP;
  }

  private ink() {
    return this.options.mood === "lit" ? colorway(this.options.look.color).ink ?? KAP_INK : KAP_INK;
  }

  /** A rounded box tapered to an SA profile, with a shallow dish on top, coloured by face. */
  private keycapGeometry(top: string, front: string, side: string) {
    const geometry = new RoundedBoxGeometry(BASE, HEIGHT, BASE, 6, 0.2);
    const position = geometry.attributes.position as THREE.BufferAttribute;
    const colors: number[] = [];
    const topColor = new THREE.Color(top);
    const frontColor = new THREE.Color(front);
    const sideColor = new THREE.Color(side);
    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index);
      const y = position.getY(index);
      const z = position.getZ(index);
      const t = (y + HEIGHT / 2) / HEIGHT;
      const scale = THREE.MathUtils.lerp(1, TOP / BASE, t);
      let ny = y;
      // Dish: the top face sinks towards the middle.
      if (y > HEIGHT / 2 - 0.02) {
        const r = Math.min(1, Math.hypot(x, z) / (BASE / 2));
        ny -= 0.09 * (1 - r * r);
      }
      position.setXYZ(index, x * scale, ny, z * scale);
      const color = y > HEIGHT / 2 - 0.12 ? topColor : Math.abs(z) >= Math.abs(x) ? frontColor : sideColor;
      colors.push(color.r, color.g, color.b);
    }
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    return geometry;
  }

  private build() {
    const [top, front, side] = this.capColors();
    const { mood, tier, look } = this.options;
    const ink = this.material(this.ink(), { roughness: 0.35 });

    // Feet: two MX stems with little shoes.
    const stem = this.material("#3f3f46");
    const shoe = this.material("#27272a");
    for (const x of [-0.36, 0.36]) {
      const leg = this.mesh(new THREE.CylinderGeometry(0.1, 0.12, LIFT, 16), stem, this.root);
      leg.position.set(x, LIFT / 2, 0);
      const foot = this.mesh(new RoundedBoxGeometry(0.42, 0.14, 0.5, 3, 0.06), shoe, this.root);
      foot.position.set(x, 0.07, 0.06);
    }

    const shadowMaterial = this.track(new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.22, depthWrite: false }));
    this.shadow = this.mesh(new THREE.CircleGeometry(1.25, 48), shadowMaterial, this.scene);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.005;
    this.shadow.scale.set(1, 0.55, 1);

    const cap = this.mesh(this.keycapGeometry(top, front, side), this.material("#ffffff", { vertexColors: true, roughness: 0.42 }));
    cap.position.y = CENTER_Y;

    // Arms: capsules hinged at the shoulders.
    const armMaterial = this.material(side);
    for (const direction of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(direction * (halfWidthAt(CENTER_Y) - 0.02), CENTER_Y - 0.05, 0.05);
      const arm = this.mesh(new THREE.CapsuleGeometry(0.085, 0.4, 4, 12), armMaterial, pivot);
      arm.position.y = 0.27;
      // Up and out when happy, hanging down otherwise.
      pivot.userData.base = -direction * (mood === "lit" ? 0.75 : Math.PI - 0.5);
      pivot.rotation.z = pivot.userData.base;
      this.body.add(pivot);
      this.arms.push(pivot);
    }

    this.buildFace(ink, mood);
    if (tier && mood !== "sleep") this.buildFlame(tier, mood === "lit" ? tier.scale : Math.min(0.55, tier.scale * 0.6));
    this.buildLook(look, ink);
  }

  private buildFace(ink: THREE.Material, mood: StreakMood) {
    const faceY = CENTER_Y - 0.08;
    this.face.position.set(0, faceY, halfWidthAt(faceY) + 0.005);
    this.face.rotation.x = -SLOPE;
    this.body.add(this.face);
    this.face.add(this.pupils);

    for (const x of [-0.3, 0.3]) {
      if (mood === "sleep") {
        const lid = this.mesh(new THREE.TorusGeometry(0.1, 0.022, 8, 16, Math.PI), ink, this.face);
        lid.position.set(x, 0.1, 0);
        lid.rotation.z = Math.PI;
        this.eyes.push(lid);
      } else {
        const eye = this.mesh(new THREE.SphereGeometry(0.085, 20, 16), ink, this.pupils);
        eye.position.set(x, 0.1, 0.02);
        eye.scale.set(1, 1.25, 0.45);
        const glint = this.mesh(new THREE.SphereGeometry(0.026, 10, 8), this.material("#ffffff", { emissive: "#ffffff", emissiveIntensity: 0.6 }), eye);
        glint.position.set(0.03, 0.035, 0.07);
        this.eyes.push(eye);
      }
    }

    const cheek = this.material("#fb7185", { transparent: true, opacity: 0.55, roughness: 0.8 });
    if (mood !== "sleep") {
      for (const x of [-0.52, 0.52]) {
        const blush = this.mesh(new THREE.CircleGeometry(0.075, 20), cheek, this.face);
        blush.position.set(x, -0.08, 0.012);
        blush.scale.set(1.3, 0.8, 1);
      }
    }
    if (mood === "lit" || mood === "frozen") {
      const smile = this.mesh(new THREE.TorusGeometry(0.13, 0.03, 10, 24, Math.PI), ink, this.face);
      smile.position.set(0, -0.06, 0.012);
      smile.rotation.z = Math.PI;
    } else if (mood === "risk") {
      const frown = this.mesh(new THREE.TorusGeometry(0.1, 0.026, 10, 24, Math.PI), ink, this.face);
      frown.position.set(0, -0.16, 0.012);
    } else {
      const mouth = this.mesh(new THREE.SphereGeometry(0.045, 12, 10), ink, this.face);
      mouth.position.set(0, -0.08, 0.01);
      mouth.scale.set(1, 0.8, 0.4);
    }
  }

  /** Two nested, glowing lathe flames and a warm point light. */
  private buildFlame(tier: FlameTier, scale: number) {
    const profile = (width: number, height: number) => {
      const points: THREE.Vector2[] = [];
      for (let step = 0; step <= 16; step += 1) {
        const t = step / 16;
        // Round at the bottom, pointed at the tip.
        const radius = width * Math.sin(Math.PI * Math.min(1, t * 1.6) * 0.5) * (1 - t) ** 0.8;
        points.push(new THREE.Vector2(Math.max(0.001, radius), t * height));
      }
      return points;
    };
    const group = new THREE.Group();
    const outer = this.mesh(new THREE.LatheGeometry(profile(0.44, 1.0), 24), this.track(new THREE.MeshBasicMaterial({ color: tier.flame })), group);
    const inner = this.mesh(new THREE.LatheGeometry(profile(0.24, 0.58), 20), this.track(new THREE.MeshBasicMaterial({ color: tier.core })), group);
    outer.position.y = 0;
    inner.position.set(0, 0.02, 0.12);
    group.position.y = LIFT + HEIGHT - 0.1;
    group.scale.setScalar(scale);
    this.body.add(group);
    this.flame = group;

    this.flameLight = new THREE.PointLight(tier.flame, 2.2 * scale, 4, 2);
    this.flameLight.position.set(0, LIFT + HEIGHT + 0.35, 0.3);
    this.body.add(this.flameLight);

    if (tier.crown) {
      const crown = this.mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.2, 5, 1, true), this.material("#facc15", { metalness: 0.7, roughness: 0.3, side: THREE.DoubleSide }), group);
      crown.position.y = 1.12;
    }
  }

  private buildLook(look: KapLook, ink: THREE.Material) {
    const faceZ = (y: number) => halfWidthAt(y) + 0.03;
    const topY = LIFT + HEIGHT;

    if (look.head === "halo") {
      const halo = this.mesh(new THREE.TorusGeometry(0.55, 0.045, 12, 40), this.material("#fde047", { emissive: "#facc15", emissiveIntensity: 0.9, metalness: 0.5 }));
      halo.position.y = topY + 1.05;
      halo.rotation.x = Math.PI / 2 - 0.2;
    }
    if (look.head === "party") {
      const hat = new THREE.Group();
      this.mesh(new THREE.ConeGeometry(0.26, 0.75, 24), this.material("#f472b6"), hat).position.y = 0.37;
      this.mesh(new THREE.TorusGeometry(0.22, 0.035, 8, 24), this.material("#fde047"), hat).rotation.x = Math.PI / 2;
      this.mesh(new THREE.SphereGeometry(0.08, 12, 10), this.material("#fde047"), hat).position.y = 0.78;
      hat.position.set(-0.42, topY - 0.02, 0.1);
      hat.rotation.z = 0.35;
      this.body.add(hat);
    }
    if (look.head === "headphones") {
      const dark = this.material("#18181b", { roughness: 0.35 });
      const band = this.mesh(new THREE.TorusGeometry(halfWidthAt(topY) + 0.22, 0.06, 10, 40, Math.PI), dark);
      band.position.set(0, CENTER_Y + 0.15, 0);
      const cupY = CENTER_Y + 0.15;
      for (const direction of [-1, 1]) {
        const cup = this.mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.16, 24), dark);
        cup.rotation.z = Math.PI / 2;
        cup.position.set(direction * (halfWidthAt(cupY) + 0.12), cupY, 0);
        const pad = this.mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 24), this.material("#f59e0b", { emissive: "#f59e0b", emissiveIntensity: 0.3 }), cup);
        pad.position.y = direction * 0.09;
      }
    }
    if (look.eyes === "shades") {
      const black = this.material("#0a0a0a", { roughness: 0.15, metalness: 0.3 });
      const bar = this.mesh(new THREE.BoxGeometry(0.92, 0.06, 0.03), black, this.face);
      bar.position.set(0, 0.17, 0.05);
      for (const x of [-0.3, 0.3]) {
        const lens = this.mesh(new THREE.BoxGeometry(0.34, 0.2, 0.03), black, this.face);
        lens.position.set(x, 0.08, 0.05);
      }
    }
    if (look.eyes === "nerd" || look.eyes === "monocle") {
      const frame = look.eyes === "nerd" ? ink : this.material("#ca8a04", { metalness: 0.8, roughness: 0.25 });
      const xs = look.eyes === "nerd" ? [-0.3, 0.3] : [0.3];
      for (const x of xs) {
        const ring = this.mesh(new THREE.TorusGeometry(0.17, 0.025, 10, 32), frame, this.face);
        ring.position.set(x, 0.1, 0.06);
      }
      if (look.eyes === "nerd") {
        const bridge = this.mesh(new THREE.TorusGeometry(0.1, 0.02, 8, 16, Math.PI), frame, this.face);
        bridge.position.set(0, 0.12, 0.06);
      }
    }
    if (look.wear === "scarf" || look.wear === "headband") {
      const scarf = look.wear === "scarf";
      const y = scarf ? CENTER_Y + HEIGHT / 2 - 0.2 : CENTER_Y + 0.33;
      const width = halfWidthAt(y) * 2 + 0.06;
      const band = this.mesh(new RoundedBoxGeometry(width, scarf ? 0.2 : 0.14, width, 3, 0.07), this.material(scarf ? "#dc2626" : "#ef4444", { roughness: 0.8 }));
      band.position.y = y;
      const tail = this.mesh(new RoundedBoxGeometry(0.18, 0.55, 0.06, 2, 0.03), this.material("#b91c1c", { roughness: 0.8 }));
      tail.position.set(width / 2 - 0.1, y - 0.3, faceZ(y) + 0.02);
      tail.rotation.z = 0.25;
    }
    if (look.wear === "cape") {
      const cape = this.mesh(new THREE.PlaneGeometry(1.9, 1.7, 1, 6), this.material("#dc2626", { side: THREE.DoubleSide, roughness: 0.7 }));
      cape.position.set(0, CENTER_Y - 0.15, -halfWidthAt(CENTER_Y) - 0.12);
      cape.rotation.x = 0.18;
    }
  }

  /* ---- Interaction ---- */

  private handlePointerDown = (event: PointerEvent) => {
    this.dragging = { x: event.clientX, spin: this.spin, moved: false };
    this.renderer.domElement.style.cursor = "grabbing";
  };

  private handlePointerMove = (event: PointerEvent) => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    // Where the pointer is relative to Kap, clamped so the eyes do not roll away.
    this.pointer.set(
      THREE.MathUtils.clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -2, 2),
      THREE.MathUtils.clamp(-(((event.clientY - rect.top) / rect.height) * 2 - 1), -2, 2),
    );
    if (!this.dragging) return;
    const dx = event.clientX - this.dragging.x;
    if (Math.abs(dx) > 3) this.dragging.moved = true;
    const next = this.dragging.spin + dx * 0.012;
    this.spinVelocity = next - this.spin;
    this.spin = next;
  };

  private handlePointerUp = () => {
    if (!this.dragging) return;
    if (!this.dragging.moved) this.jump();
    this.dragging = null;
    this.renderer.domElement.style.cursor = "grab";
  };

  private handleKey = (event: KeyboardEvent) => {
    if (event.repeat || event.metaKey || event.ctrlKey || event.key.length > 1 && event.key !== "Backspace" && event.key !== "Enter") return;
    this.nod = 1;
    this.heat = Math.min(1, this.heat + 0.08);
  };

  /** A happy hop, e.g. when the streak goes up. */
  jump() {
    if (this.hop <= 0) this.hop = 1;
  }

  /* ---- Frame ---- */

  private resize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (!width || !height) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    const fit = 2.2 / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const distance = Math.max(fit, fit / this.camera.aspect * 0.9);
    this.camera.position.set(0, 1.9, distance);
    this.camera.lookAt(0, 1.45, 0);
    this.camera.updateProjectionMatrix();
  }

  private loop = () => {
    this.frameId = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (!this.visible) return;
    this.time += dt;
    const calm = this.reducedMotion;

    // Spin: drag sets it, then it eases back to a three-quarter view.
    if (!this.dragging) {
      this.spin += this.spinVelocity;
      this.spinVelocity *= 0.9;
      if (Math.abs(this.spinVelocity) < 0.002) this.spin += (0.35 - this.spin) * Math.min(1, dt * 1.6);
    }
    this.root.rotation.y = this.spin + (calm ? 0 : this.pointer.x * 0.12);

    // Hop with squash and stretch.
    let lift = 0;
    let squash = 1;
    if (this.hop > 0) {
      this.hop = Math.max(0, this.hop - dt * 1.9);
      const t = 1 - this.hop;
      lift = Math.sin(Math.PI * Math.min(1, t * 1.15)) * 0.7;
      squash = t < 0.12 ? 1 - Math.sin((t / 0.12) * Math.PI) * 0.16 : t > 0.88 ? 1 - Math.sin(((t - 0.88) / 0.12) * Math.PI) * 0.12 : 1 + lift * 0.08;
    }
    const breathe = calm ? 0 : Math.sin(this.time * 2.2) * 0.015;
    this.nod = Math.max(0, this.nod - dt * 7);
    this.heat = Math.max(0, this.heat - dt * 0.12);
    this.body.position.y = lift - this.nod * 0.05;
    this.body.scale.set(1 / Math.sqrt(squash), squash + breathe, 1 / Math.sqrt(squash));
    this.body.rotation.x = -this.pointer.y * 0.08 + this.nod * 0.1;
    this.shadow.scale.set(1 - lift * 0.35, 0.55 * (1 - lift * 0.35), 1);

    // Arms wave when happy, swing when hopping.
    this.arms.forEach((arm, index) => {
      const side = index === 0 ? 1 : -1;
      arm.rotation.z = (arm.userData.base as number) + (calm ? 0 : Math.sin(this.time * 3 + index) * 0.12 * side) + side * lift * 0.5;
    });

    // Eyes follow the pointer; a blink every few seconds.
    this.pupils.position.set(this.pointer.x * 0.05, this.pointer.y * 0.035, 0);
    this.nextBlink -= dt;
    if (this.nextBlink <= 0) {
      this.blink = 1;
      this.nextBlink = 2.5 + Math.random() * 3;
    }
    this.blink = Math.max(0, this.blink - dt * 7);
    const open = this.options.mood === "sleep" ? 1 : 1 - Math.sin(this.blink * Math.PI) * 0.9;
    for (const eye of this.eyes) if (this.options.mood !== "sleep") eye.scale.y = 1.25 * open;

    // The flame flickers, and burns brighter while you type.
    if (this.flame) {
      const flicker = calm ? 1 : 1 + Math.sin(this.time * 13) * 0.04 + Math.sin(this.time * 7.3) * 0.05;
      const boost = 1 + this.heat * 0.45;
      this.flame.scale.y = this.flame.scale.x * flicker * boost;
      this.flame.rotation.z = calm ? 0 : Math.sin(this.time * 5) * 0.05;
      if (this.flameLight) this.flameLight.intensity = (1.6 + this.heat * 2.4) * flicker;
    }

    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    cancelAnimationFrame(this.frameId);
    this.resizeObserver.disconnect();
    this.visibilityObserver.disconnect();
    this.renderer.domElement.removeEventListener("pointerdown", this.handlePointerDown);
    window.removeEventListener("pointermove", this.handlePointerMove);
    window.removeEventListener("pointerup", this.handlePointerUp);
    window.removeEventListener("keydown", this.handleKey);
    for (const item of this.disposables) item.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
