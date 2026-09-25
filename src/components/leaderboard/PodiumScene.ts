import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/** Which podium slots are filled; rank 1-3. */
export interface PodiumSlot {
  rank: 1 | 2 | 3;
  filled: boolean;
}

const RANK_STYLE = {
  1: { color: "#f5b400", height: 2.1, x: 0 },
  2: { color: "#c3cad6", height: 1.5, x: -2.7 },
  3: { color: "#d08a4c", height: 1.1, x: 2.7 },
} as const;

const PEDESTAL_WIDTH = 2.3;
const PEDESTAL_DEPTH = 2;

interface Keybot {
  rank: 1 | 2 | 3;
  root: THREE.Group;
  body: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  eyes: THREE.Mesh[];
  baseY: number;
  hop: number;
  nextBlink: number;
}

function numberTexture(text: string, color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d")!;
  context.fillStyle = color;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = "900 170px ui-sans-serif, system-ui, sans-serif";
  context.fillText(text, 128, 140);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Three.js podium with a Keybot mascot per filled rank. Purely decorative
 * plus hover/click picking; names and stats live in the HTML below it.
 */
export class PodiumScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  private container: HTMLElement;
  private resizeObserver: ResizeObserver;
  private visibilityObserver: IntersectionObserver;
  private reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  private disposables: Array<{ dispose: () => void }> = [];
  private bots: Keybot[] = [];
  private pedestals = new Map<1 | 2 | 3, THREE.Group>();
  /** Horizontal offset of the side pedestals; widened on wide frames. */
  private spread = 2.7;
  private pickTargets: Array<{ object: THREE.Object3D; rank: 1 | 2 | 3 }> = [];
  private confetti: THREE.InstancedMesh | null = null;
  private confettiState: Array<{ position: THREE.Vector3; velocity: THREE.Vector3; spin: THREE.Vector3; rotation: THREE.Euler }> = [];
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2(10, 10);
  private hovered: 1 | 2 | 3 | null = null;
  private frameId = 0;
  private visible = true;
  private start = performance.now();
  private last = performance.now();
  private onHover?: (rank: 1 | 2 | 3 | null) => void;
  private onSelect?: (rank: 1 | 2 | 3) => void;
  private onLayout?: (positions: Record<1 | 2 | 3, number>) => void;

  constructor(
    container: HTMLElement,
    slots: PodiumSlot[],
    handlers: {
      onHover?: (rank: 1 | 2 | 3 | null) => void;
      onSelect?: (rank: 1 | 2 | 3) => void;
      /** Horizontal screen position (0-1) of each pedestal's front, for aligning HTML. */
      onLayout?: (positions: Record<1 | 2 | 3, number>) => void;
    } = {},
  ) {
    this.container = container;
    this.onHover = handlers.onHover;
    this.onSelect = handlers.onSelect;
    this.onLayout = handlers.onLayout;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.domElement.className = "podium-canvas";
    container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.HemisphereLight("#ffffff", "#40455a", 1.4));
    const key = new THREE.DirectionalLight("#ffffff", 2.2);
    key.position.set(3, 8, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -6;
    key.shadow.camera.right = 6;
    key.shadow.camera.top = 6;
    key.shadow.camera.bottom = -2;
    key.shadow.radius = 4;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight("#8fb4ff", 1.2);
    rim.position.set(-5, 4, -4);
    this.scene.add(rim);

    this.buildStage(slots);
    for (const slot of slots) if (slot.filled) this.bots.push(this.buildKeybot(slot.rank));
    if (slots.some((slot) => slot.rank === 1 && slot.filled) && !this.reducedMotion) this.buildConfetti();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.visibilityObserver = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
    });
    this.visibilityObserver.observe(container);
    this.resize();

    this.renderer.domElement.addEventListener("pointermove", this.handlePointerMove);
    this.renderer.domElement.addEventListener("pointerleave", this.handlePointerLeave);
    this.renderer.domElement.addEventListener("click", this.handleClick);
    this.loop();
  }

  private track<T extends { dispose: () => void }>(item: T): T {
    this.disposables.push(item);
    return item;
  }

  private material(color: string, options: THREE.MeshStandardMaterialParameters = {}) {
    return this.track(new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.1, ...options }));
  }

  private buildStage(slots: PodiumSlot[]) {
    const floor = new THREE.Mesh(
      this.track(new THREE.CircleGeometry(7.5, 64)),
      this.track(new THREE.ShadowMaterial({ opacity: 0.22 })),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    for (const { rank, filled } of slots) {
      const style = RANK_STYLE[rank];
      const pedestal = new THREE.Group();
      const block = new THREE.Mesh(
        this.track(new RoundedBoxGeometry(PEDESTAL_WIDTH, style.height, PEDESTAL_DEPTH, 4, 0.12)),
        this.material("#1c1f2b", { roughness: 0.55, metalness: 0.25 }),
      );
      block.position.y = style.height / 2;
      block.castShadow = true;
      block.receiveShadow = true;
      pedestal.add(block);

      // Glowing rank-colored trim along the top edge.
      const trim = new THREE.Mesh(
        this.track(new RoundedBoxGeometry(PEDESTAL_WIDTH + 0.06, 0.12, PEDESTAL_DEPTH + 0.06, 2, 0.05)),
        this.material(style.color, { emissive: style.color, emissiveIntensity: filled ? 0.55 : 0.12, metalness: 0.6, roughness: 0.3 }),
      );
      trim.position.y = style.height - 0.04;
      pedestal.add(trim);

      const numberMaterial = this.track(new THREE.MeshBasicMaterial({
        map: this.track(numberTexture(String(rank), style.color)),
        transparent: true,
        opacity: filled ? 1 : 0.35,
      }));
      const label = new THREE.Mesh(this.track(new THREE.PlaneGeometry(1.1, 1.1)), numberMaterial);
      label.position.set(0, Math.min(style.height * 0.5, style.height - 0.65), PEDESTAL_DEPTH / 2 + 0.01);
      pedestal.add(label);

      pedestal.position.x = style.x;
      this.scene.add(pedestal);
      this.pedestals.set(rank, pedestal);
      if (filled) this.pickTargets.push({ object: block, rank });
    }
  }

  private buildKeybot(rank: 1 | 2 | 3): Keybot {
    const style = RANK_STYLE[rank];
    const bodyColor = "#2b2f3d";
    const accent = style.color;

    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);

    const torso = new THREE.Mesh(this.track(new THREE.CapsuleGeometry(0.42, 0.5, 6, 16)), this.material(bodyColor));
    torso.position.y = 0.95;
    body.add(torso);

    // Medal on the chest.
    const medal = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 24)),
      this.material(accent, { metalness: 0.8, roughness: 0.25, emissive: accent, emissiveIntensity: 0.25 }),
    );
    medal.rotation.x = Math.PI / 2;
    medal.position.set(0, 1.0, 0.43);
    body.add(medal);

    // Keycap head with a face screen.
    const head = new THREE.Group();
    head.position.y = 1.75;
    body.add(head);
    const cap = new THREE.Mesh(this.track(new RoundedBoxGeometry(1.05, 0.78, 0.95, 4, 0.16)), this.material("#e9ebf2", { roughness: 0.35 }));
    head.add(cap);
    const top = new THREE.Mesh(this.track(new RoundedBoxGeometry(0.85, 0.12, 0.75, 3, 0.05)), this.material(accent, { roughness: 0.35 }));
    top.position.y = 0.42;
    head.add(top);
    const screen = new THREE.Mesh(this.track(new RoundedBoxGeometry(0.8, 0.48, 0.05, 2, 0.08)), this.material("#11131a", { roughness: 0.2 }));
    screen.position.set(0, -0.02, 0.47);
    head.add(screen);
    const eyeMaterial = this.material("#7df9ff", { emissive: "#7df9ff", emissiveIntensity: 1.4 });
    const eyes = [-0.17, 0.17].map((x) => {
      const eye = new THREE.Mesh(this.track(new THREE.CapsuleGeometry(0.055, 0.1, 4, 8)), eyeMaterial);
      eye.position.set(x, 0.0, 0.5);
      head.add(eye);
      return eye;
    });

    // Arms pivot at the shoulder so they can wave and cheer.
    const makeArm = (side: -1 | 1) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.5, 1.22, 0);
      const arm = new THREE.Mesh(this.track(new THREE.CapsuleGeometry(0.11, 0.42, 4, 10)), this.material(bodyColor));
      arm.position.y = -0.28;
      const hand = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.13, 16, 12)), this.material(accent));
      hand.position.y = -0.56;
      pivot.add(arm, hand);
      pivot.rotation.z = side * 0.18;
      body.add(pivot);
      return pivot;
    };
    const leftArm = makeArm(-1);
    const rightArm = makeArm(1);

    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(this.track(new THREE.CapsuleGeometry(0.13, 0.3, 4, 10)), this.material(bodyColor));
      leg.position.set(side * 0.2, 0.3, 0);
      const foot = new THREE.Mesh(this.track(new RoundedBoxGeometry(0.28, 0.12, 0.38, 2, 0.05)), this.material(accent));
      foot.position.set(side * 0.2, 0.06, 0.05);
      body.add(leg, foot);
    }

    // Each rank gets its own accessory.
    if (rank === 1) {
      const crown = new THREE.Group();
      const gold = this.material("#ffcc33", { metalness: 0.85, roughness: 0.2, emissive: "#ffb000", emissiveIntensity: 0.35 });
      const band = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.34, 0.36, 0.18, 24, 1, true)), gold);
      crown.add(band);
      for (let i = 0; i < 5; i += 1) {
        const angle = (i / 5) * Math.PI * 2;
        const spike = new THREE.Mesh(this.track(new THREE.ConeGeometry(0.08, 0.22, 10)), gold);
        spike.position.set(Math.sin(angle) * 0.33, 0.19, Math.cos(angle) * 0.33);
        crown.add(spike);
      }
      crown.position.y = 0.6;
      crown.rotation.z = -0.12;
      head.add(crown);
    } else if (rank === 2) {
      const band = new THREE.Mesh(this.track(new THREE.TorusGeometry(0.58, 0.05, 10, 32, Math.PI)), this.material("#1b1d26", { roughness: 0.3 }));
      band.position.y = 0.05;
      head.add(band);
      for (const side of [-1, 1]) {
        const cup = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.2, 0.2, 0.14, 20)), this.material(accent, { metalness: 0.5, roughness: 0.3 }));
        cup.rotation.z = Math.PI / 2;
        cup.position.set(side * 0.58, 0, 0);
        head.add(cup);
      }
    } else {
      const visor = new THREE.Mesh(
        this.track(new RoundedBoxGeometry(0.9, 0.16, 0.08, 2, 0.04)),
        this.material("#22d3ee", { emissive: "#22d3ee", emissiveIntensity: 0.9, transparent: true, opacity: 0.85 }),
      );
      visor.position.set(0, 0.16, 0.52);
      head.add(visor);
    }

    body.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) child.castShadow = true;
    });

    const baseY = style.height;
    root.position.set(style.x, baseY, 0.1);
    // #2 and #3 turn slightly toward the champion.
    root.rotation.y = rank === 2 ? 0.28 : rank === 3 ? -0.28 : 0;
    this.scene.add(root);
    this.pickTargets.push({ object: body, rank });

    return { rank, root, body, leftArm, rightArm, eyes, baseY, hop: 0, nextBlink: 1 + Math.random() * 3 };
  }

  private buildConfetti() {
    const count = 70;
    const colors = ["#f5b400", "#ffffff", "#22d3ee", "#f472b6", "#a3e635"];
    const mesh = new THREE.InstancedMesh(
      this.track(new THREE.PlaneGeometry(0.09, 0.16)),
      this.track(new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })),
      count,
    );
    const color = new THREE.Color();
    for (let i = 0; i < count; i += 1) {
      mesh.setColorAt(i, color.set(colors[i % colors.length]));
      this.confettiState.push({
        position: new THREE.Vector3((Math.random() - 0.5) * 3.2, 3 + Math.random() * 4, (Math.random() - 0.5) * 2),
        velocity: new THREE.Vector3((Math.random() - 0.5) * 0.3, -(0.5 + Math.random() * 0.6), 0),
        spin: new THREE.Vector3(Math.random() * 4, Math.random() * 4, Math.random() * 4),
        rotation: new THREE.Euler(Math.random() * 6, Math.random() * 6, 0),
      });
    }
    this.confetti = mesh;
    this.scene.add(mesh);
  }

  private resize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (!width || !height) return;
    this.renderer.setSize(width, height, false);
    const aspect = width / height;
    this.camera.aspect = aspect;
    // Far enough that the pedestals fit the width and the crown (plus a
    // cheer hop) fits the height.
    const halfWidth = 4.3;
    const halfVerticalFov = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const tanHorizontal = Math.tan(halfVerticalFov) * aspect;
    const distance = Math.max(halfWidth / tanHorizontal, 3.6 / Math.tan(halfVerticalFov));
    this.camera.position.set(0, 2.8 + distance * 0.12, distance);
    this.camera.lookAt(0, 2.35, 0);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();

    // On wide frames spread the side pedestals so the HTML cards fit under them.
    this.spread = THREE.MathUtils.clamp(distance * tanHorizontal * 0.52, 2.7, 4.2);
    const xFor = (rank: 1 | 2 | 3) => (rank === 1 ? 0 : rank === 2 ? -this.spread : this.spread);
    for (const [rank, group] of this.pedestals) group.position.x = xFor(rank);
    for (const bot of this.bots) bot.root.position.x = xFor(bot.rank);

    const project = (x: number) => {
      const point = new THREE.Vector3(x, 0, PEDESTAL_DEPTH / 2).project(this.camera);
      return (point.x + 1) / 2;
    };
    this.onLayout?.({ 1: project(xFor(1)), 2: project(xFor(2)), 3: project(xFor(3)) });
  }

  private handlePointerMove = (event: PointerEvent) => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickTargets.map((target) => target.object), true);
    let rank: 1 | 2 | 3 | null = null;
    if (hits.length) {
      const hit = hits[0].object;
      rank = this.pickTargets.find((target) => target.object === hit || target.object.getObjectById(hit.id))?.rank ?? null;
    }
    if (rank !== this.hovered) {
      this.hovered = rank;
      this.renderer.domElement.style.cursor = rank ? "pointer" : "";
      const bot = this.bots.find((item) => item.rank === rank);
      if (bot && bot.hop <= 0) bot.hop = 1;
      this.onHover?.(rank);
    }
  };

  private handlePointerLeave = () => {
    if (this.hovered !== null) {
      this.hovered = null;
      this.onHover?.(null);
    }
    this.renderer.domElement.style.cursor = "";
  };

  private handleClick = () => {
    if (this.hovered) this.onSelect?.(this.hovered);
  };

  /** Make a bot hop, e.g. when its HTML card is hovered. */
  highlight(rank: 1 | 2 | 3 | null) {
    const bot = this.bots.find((item) => item.rank === rank);
    if (bot && bot.hop <= 0) bot.hop = 1;
  }

  private loop = () => {
    this.frameId = requestAnimationFrame(this.loop);
    if (!this.visible) {
      this.last = performance.now();
      return;
    }
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const t = (now - this.start) / 1000;
    if (!this.reducedMotion) this.animate(t, dt);
    this.renderer.render(this.scene, this.camera);
  };

  private animate(t: number, dt: number) {
    for (const bot of this.bots) {
      const phase = bot.rank * 1.7;
      const breathe = Math.sin(t * 2 + phase) * 0.04;
      let hopY = 0;
      if (bot.hop > 0) {
        bot.hop = Math.max(0, bot.hop - dt * 2.2);
        hopY = Math.sin((1 - bot.hop) * Math.PI) * 0.55;
      }

      if (bot.rank === 1) {
        // Champion: arms up, bouncing cheer.
        const cheer = Math.abs(Math.sin(t * 3.2));
        bot.body.position.y = breathe + hopY + cheer * 0.12;
        bot.leftArm.rotation.z = -2.5 - cheer * 0.35;
        bot.rightArm.rotation.z = 2.5 + cheer * 0.35;
        bot.root.rotation.y = Math.sin(t * 0.9) * 0.2;
      } else if (bot.rank === 2) {
        // Wave with the right arm.
        bot.body.position.y = breathe + hopY;
        bot.rightArm.rotation.z = 2.3 + Math.sin(t * 7) * 0.35;
        bot.leftArm.rotation.z = -0.2;
      } else {
        // Fist pump every couple of seconds.
        const pump = Math.max(0, Math.sin(t * 2.4));
        bot.body.position.y = breathe + hopY;
        bot.leftArm.rotation.z = -0.2 - pump * 2.4;
        bot.rightArm.rotation.z = 0.2;
      }

      bot.nextBlink -= dt;
      const blinking = bot.nextBlink < 0;
      for (const eye of bot.eyes) eye.scale.y = blinking ? 0.15 : 1;
      if (bot.nextBlink < -0.12) bot.nextBlink = 2 + Math.random() * 3;
    }

    if (this.confetti) {
      const matrix = new THREE.Matrix4();
      const quaternion = new THREE.Quaternion();
      const scale = new THREE.Vector3(1, 1, 1);
      this.confettiState.forEach((piece, index) => {
        piece.position.addScaledVector(piece.velocity, dt);
        piece.position.x += Math.sin(t * 2 + index) * dt * 0.3;
        piece.rotation.x += piece.spin.x * dt;
        piece.rotation.y += piece.spin.y * dt;
        if (piece.position.y < RANK_STYLE[1].height) {
          piece.position.set((Math.random() - 0.5) * 3.2, 6 + Math.random() * 2, (Math.random() - 0.5) * 2);
        }
        quaternion.setFromEuler(piece.rotation);
        matrix.compose(piece.position, quaternion, scale);
        this.confetti!.setMatrixAt(index, matrix);
      });
      this.confetti.instanceMatrix.needsUpdate = true;
    }
  }

  dispose() {
    cancelAnimationFrame(this.frameId);
    this.resizeObserver.disconnect();
    this.visibilityObserver.disconnect();
    this.renderer.domElement.removeEventListener("pointermove", this.handlePointerMove);
    this.renderer.domElement.removeEventListener("pointerleave", this.handlePointerLeave);
    this.renderer.domElement.removeEventListener("click", this.handleClick);
    for (const item of this.disposables) item.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
