import * as THREE from 'three';
import * as CANNON from 'cannon-es';

class DiceSound {
  constructor() {
    this.ctx = null;
  }

  play() {
    try {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      }
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = 220 + Math.random() * 60;
      gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.3);
    } catch (err) {
      console.warn('Audio unavailable', err);
    }
  }
}

function groupFacesByNormal(geometry, tolerance = 1e-3) {
  const index = geometry.index;
  const position = geometry.attributes.position;
  const faceCount = index ? index.count / 3 : position.count / 3;
  const groups = [];
  const faceToGroup = [];

  const getVector = (i) => {
    const idx = index ? index.getX(i) : i;
    return new THREE.Vector3(
      position.getX(idx),
      position.getY(idx),
      position.getZ(idx)
    );
  };

  for (let f = 0; f < faceCount; f++) {
    const a = getVector(f * 3);
    const b = getVector(f * 3 + 1);
    const c = getVector(f * 3 + 2);
    const normal = new THREE.Vector3()
      .subVectors(b, a)
      .cross(new THREE.Vector3().subVectors(c, a))
      .normalize();

    let groupIndex = groups.findIndex((g) => g.normal.dot(normal) > 1 - tolerance);
    if (groupIndex === -1) {
      groupIndex = groups.length;
      groups.push({ normal, faces: [] });
    }
    groups[groupIndex].faces.push(f);
    faceToGroup[f] = groupIndex;
  }

  return { groups, faceToGroup };
}

function buildTrimesh(geometry) {
  const vertices = geometry.attributes.position.array;
  const indices = geometry.index
    ? geometry.index.array
    : Array.from({ length: geometry.attributes.position.count }, (_, i) => i);
  return new CANNON.Trimesh(Array.from(vertices), Array.from(indices));
}

function createBaseTextureLoader() {
  const loader = new THREE.TextureLoader();
  const baseImages = {};
  const basePaths = {
    d4: '/goblinsvillage/assets/textures/dice/d4_base.png',
    d6: '/goblinsvillage/assets/textures/dice/d6_base.png',
    d8: '/goblinsvillage/assets/textures/dice/d8_base.png',
    d10: '/goblinsvillage/assets/textures/dice/d10_base.png',
    d12: '/goblinsvillage/assets/textures/dice/d12_base.png',
    d20: '/goblinsvillage/assets/textures/dice/d20_base.png',
    d100: '/goblinsvillage/assets/textures/dice/d100_base.png',
  };

  Object.entries(basePaths).forEach(([key, url]) => {
    loader.load(url, (tex) => {
      baseImages[key] = tex.image;
    });
  });

  return (type) => baseImages[type];
}

class DiceApp {
  constructor(containerElement) {
    this.container = containerElement;
    this.canvasWrapper = containerElement;
    this.resultEl = document.getElementById('dice-result');
    this.rollMode = 'normal';
    this.diceList = [];
    this.walls = [];
    this.lastTime = 0;
    this.baseTextureFetcher = createBaseTextureLoader();
    this.sound = new DiceSound();

    this.initThree();
    this.initCannon();
    this.initWalls();
    this.initUIBindings();
    this.animate();
  }

  initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d0b0a);

    const width = this.canvasWrapper.clientWidth || window.innerWidth;
    const height = this.canvasWrapper.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 500);
    this.camera.position.set(0, 55, 0);
    this.camera.up.set(0, 0, -1);
    this.camera.lookAt(new THREE.Vector3(0, 0, 0));

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.canvasWrapper.appendChild(this.renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 0.6);
    dir.position.set(20, 50, 10);
    this.scene.add(dir);

    window.addEventListener('resize', () => this.handleResize());
  }

  initCannon() {
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -60, 0) });
    this.world.broadphase = new CANNON.NaiveBroadphase();
    this.world.solver.iterations = 16;

    const floor = new CANNON.Body({ mass: 0 });
    floor.addShape(new CANNON.Plane());
    this.world.addBody(floor);
  }

  initWalls() {
    this.wallBodies = [];
    this.updateWalls();
  }

  updateWalls() {
    const halfHeight = Math.tan((this.camera.fov * Math.PI) / 360) * this.camera.position.y;
    const halfWidth = halfHeight * this.camera.aspect;
    const padding = 2;

    this.bounds = {
      halfWidth: halfWidth - padding,
      halfDepth: halfHeight - padding,
      innerHalfWidth: halfWidth - padding * 2,
      innerHalfDepth: halfHeight - padding * 2,
    };

    const wallThickness = 2;
    const wallHeight = 8;

    this.wallBodies.forEach((body) => this.world.removeBody(body));
    this.wallBodies = [];

    const createWall = (pos, rot) => {
      const shape = new CANNON.Box(new CANNON.Vec3(wallThickness, wallHeight, this.bounds.halfDepth + wallThickness));
      const body = new CANNON.Body({ mass: 0, position: pos, shape });
      if (rot) body.quaternion.setFromEuler(0, rot, 0);
      this.world.addBody(body);
      this.wallBodies.push(body);
    };

    // Left and Right
    createWall(new CANNON.Vec3(-this.bounds.halfWidth, wallHeight, 0), 0);
    createWall(new CANNON.Vec3(this.bounds.halfWidth, wallHeight, 0), 0);

    // Front and Back (rotated)
    const shapeZ = new CANNON.Box(new CANNON.Vec3(this.bounds.halfWidth + wallThickness, wallHeight, wallThickness));
    const front = new CANNON.Body({ mass: 0, position: new CANNON.Vec3(0, wallHeight, -this.bounds.halfDepth) });
    front.addShape(shapeZ);
    const back = new CANNON.Body({ mass: 0, position: new CANNON.Vec3(0, wallHeight, this.bounds.halfDepth) });
    back.addShape(shapeZ);
    this.world.addBody(front);
    this.world.addBody(back);
    this.wallBodies.push(front, back);
  }

  createTexture(label, color, type, vertexLabels) {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const baseImage = this.baseTextureFetcher(type);
    if (baseImage) {
      ctx.drawImage(baseImage, 0, 0, size, size);
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, size, size);
    }

    ctx.fillStyle = '#1a120a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (type === 'd4' && Array.isArray(vertexLabels)) {
      ctx.font = 'bold 42px Cinzel, serif';
      const points = [
        { x: size / 2, y: size * 0.18, val: vertexLabels[0] },
        { x: size * 0.18, y: size * 0.82, val: vertexLabels[1] },
        { x: size * 0.82, y: size * 0.82, val: vertexLabels[2] },
      ];
      points.forEach((p) => {
        ctx.fillText(p.val, p.x, p.y);
      });
    } else {
      ctx.font = 'bold 120px Cinzel, serif';
      ctx.fillText(label, size / 2, size / 2);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 4;
    return texture;
  }

  getDiceData(type) {
    const baseColor = '#d9c497';
    if (type === 'd4') {
      const geometry = new THREE.TetrahedronGeometry(2.2);
      geometry.computeVertexNormals();
      const vertexValues = [1, 2, 3, 4];
      const faceMaterials = [];
      geometry.clearGroups();
      const index = geometry.index;
      const faceCount = index.count / 3;
      const faceNormals = [];
      for (let f = 0; f < faceCount; f++) {
        const a = index.getX(f * 3);
        const b = index.getX(f * 3 + 1);
        const c = index.getX(f * 3 + 2);
        const labels = [vertexValues[a], vertexValues[b], vertexValues[c]];
        const matIndex = f;
        faceMaterials.push(new THREE.MeshStandardMaterial({
          map: this.createTexture('', baseColor, 'd4', labels),
          roughness: 0.6,
          metalness: 0.1,
        }));
        geometry.addGroup(f * 3, 3, matIndex);
        const normal = new THREE.Vector3();
        const pA = new THREE.Vector3();
        const pB = new THREE.Vector3();
        const pC = new THREE.Vector3();
        pA.fromBufferAttribute(geometry.attributes.position, a);
        pB.fromBufferAttribute(geometry.attributes.position, b);
        pC.fromBufferAttribute(geometry.attributes.position, c);
        normal
          .subVectors(pB, pA)
          .cross(new THREE.Vector3().subVectors(pC, pA))
          .normalize();
        faceNormals.push(normal);
      }
      return {
        geometry,
        materials: faceMaterials,
        values: [1, 2, 3, 4],
        faceNormals,
        vertexValues,
      };
    }

    if (type === 'd6') {
      const geometry = new THREE.BoxGeometry(4, 4, 4);
      const values = [3, 4, 1, 6, 2, 5];
      geometry.clearGroups();
      const materials = values.map((val) =>
        new THREE.MeshStandardMaterial({
          map: this.createTexture(String(val), baseColor, 'd6'),
          roughness: 0.6,
          metalness: 0.1,
        })
      );

      const normals = [
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(-1, 0, 0),
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0, -1, 0),
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(0, 0, -1),
      ];

      const faceNormals = [];
      const index = geometry.index;
      const faceCount = index.count / 3;
      for (let f = 0; f < faceCount; f++) {
        const materialIndex = Math.floor(f / 2);
        geometry.addGroup(f * 3, 3, materialIndex);
        faceNormals.push(normals[materialIndex]);
      }

      return { geometry, materials, values, faceNormals };
    }

    if (type === 'd8') {
      const geometry = new THREE.OctahedronGeometry(3);
      return this.createPolyDiceData('d8', geometry, 8, baseColor);
    }

    if (type === 'd10') {
      const geometry = this.createD10Geometry();
      return this.createPolyDiceData('d10', geometry, 10, baseColor);
    }

    if (type === 'd12') {
      const geometry = new THREE.DodecahedronGeometry(3.2);
      return this.createPolyDiceData('d12', geometry, 12, baseColor);
    }

    if (type === 'd20') {
      const geometry = new THREE.IcosahedronGeometry(3.4);
      return this.createPolyDiceData('d20', geometry, 20, baseColor);
    }

    if (type === 'd100') {
      const geometry = new THREE.SphereGeometry(3.6, 24, 16);
      return this.createPolyDiceData('d100', geometry, 12, baseColor, true);
    }

    return null;
  }

  createPolyDiceData(type, geometry, faceCountExpected, baseColor, uniformFaces = false) {
    geometry.computeVertexNormals();
    const { groups, faceToGroup } = groupFacesByNormal(geometry, 1e-2);
    const values = [];
    const faceTotal = Math.max(groups.length, faceCountExpected);
    for (let i = 0; i < faceTotal; i++) {
      values.push((i % faceCountExpected) + 1);
    }

    geometry.clearGroups();
    const materials = values.slice(0, groups.length).map((val) =>
      new THREE.MeshStandardMaterial({
        map: this.createTexture(String(val), baseColor, type),
        roughness: 0.6,
        metalness: 0.15,
      })
    );

    const faceNormals = groups.map((g) => g.normal.clone());

    const index = geometry.index;
    const totalFaces = index.count / 3;
    for (let f = 0; f < totalFaces; f++) {
      const materialIndex = faceToGroup[f] ?? 0;
      geometry.addGroup(f * 3, 3, materialIndex % materials.length);
    }

    return { geometry, materials, values: values.slice(0, faceNormals.length), faceNormals };
  }

  createD10Geometry() {
    const radius = 3.2;
    const height = 2.4;
    const top = [];
    const bottom = [];
    const geom = new THREE.BufferGeometry();
    const vertices = [];
    const indices = [];
    const angleStep = (Math.PI * 2) / 5;

    for (let i = 0; i < 5; i++) {
      const angle = i * angleStep;
      top.push(new THREE.Vector3(Math.cos(angle) * radius, height, Math.sin(angle) * radius));
      const bAngle = angle + angleStep / 2;
      bottom.push(new THREE.Vector3(Math.cos(bAngle) * radius, -height, Math.sin(bAngle) * radius));
    }

    const pushVertex = (v) => {
      vertices.push(v.x, v.y, v.z);
      return vertices.length / 3 - 1;
    };

    const topIdx = top.map(pushVertex);
    const bottomIdx = bottom.map(pushVertex);

    for (let i = 0; i < 5; i++) {
      const next = (i + 1) % 5;
      const a = topIdx[i];
      const b = bottomIdx[i];
      const c = bottomIdx[next];
      const d = topIdx[next];
      indices.push(a, b, c);
      indices.push(a, c, d);
    }

    geom.setIndex(indices);
    geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geom.computeVertexNormals();
    return geom;
  }

  createConvexPolyhedron(geometry) {
    return buildTrimesh(geometry);
  }

  spawn(type) {
    if (type === 'd20' && this.rollMode !== 'normal') {
      this.clearType('d20');
      this.spawnSingle('d20');
      this.spawnSingle('d20');
      return;
    }
    this.spawnSingle(type);
  }

  spawnSingle(type) {
    const data = this.getDiceData(type);
    if (!data) return;

    const material = data.materials.length > 1 ? data.materials : data.materials[0];
    const mesh = new THREE.Mesh(data.geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    const shape = this.createConvexPolyhedron(data.geometry);
    const body = new CANNON.Body({ mass: 1, shape });

    const x = (Math.random() * 2 - 1) * (this.bounds.innerHalfWidth - 2);
    const z = (Math.random() * 2 - 1) * (this.bounds.innerHalfDepth - 2);
    body.position.set(x, 10 + Math.random() * 5, z);
    body.velocity.set((Math.random() - 0.5) * 10, 5 + Math.random() * 5, (Math.random() - 0.5) * 10);
    body.angularVelocity.set(Math.random() * 10, Math.random() * 10, Math.random() * 10);
    body.angularDamping = 0.2;
    body.linearDamping = 0.1;

    this.world.addBody(body);

    this.diceList.push({ mesh, body, type, data, atRest: false });
    this.sound.play();
  }

  clearType(type) {
    this.diceList = this.diceList.filter((die) => {
      if (die.type === type) {
        this.world.removeBody(die.body);
        this.scene.remove(die.mesh);
        return false;
      }
      return true;
    });
  }

  clear() {
    this.diceList.forEach((die) => {
      this.world.removeBody(die.body);
      this.scene.remove(die.mesh);
    });
    this.diceList = [];
    this.updateUI(true);
  }

  handleResize() {
    const width = this.canvasWrapper.clientWidth || window.innerWidth;
    const height = this.canvasWrapper.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.updateWalls();
  }

  animate(time = 0) {
    requestAnimationFrame((t) => this.animate(t));
    const dt = (time - this.lastTime) / 1000 || 0.016;
    this.lastTime = time;
    this.world.step(1 / 60, dt, 3);

    this.diceList.forEach((die) => {
      const { mesh, body } = die;
      mesh.position.copy(body.position);
      mesh.quaternion.copy(body.quaternion);

      if (body.position.y < -10) {
        body.position.set(0, 12, 0);
        body.velocity.set(0, 8, 0);
        body.angularVelocity.set(5, 5, 5);
      }

      const speed = body.velocity.length();
      const angSpeed = body.angularVelocity.length();
      die.atRest = speed < 0.2 && angSpeed < 0.2;
    });

    this.updateUI();
    this.renderer.render(this.scene, this.camera);
  }

  calculateValue(die) {
    if (die.type === 'd4') {
      const position = die.data.geometry.attributes.position;
      let maxY = -Infinity;
      let maxIndex = 0;
      const temp = new THREE.Vector3();
      for (let i = 0; i < position.count; i++) {
        temp.fromBufferAttribute(position, i);
        die.mesh.localToWorld(temp);
        if (temp.y > maxY) {
          maxY = temp.y;
          maxIndex = i;
        }
      }
      return die.data.vertexValues[maxIndex] || 1;
    }

    if (die.type === 'd100') {
      const value = Math.floor(Math.random() * 100) + 1;
      if (Array.isArray(die.mesh.material)) {
        die.mesh.material.forEach((mat) => {
          mat.map = this.createTexture(String(value), '#d0d0d0', 'd100');
          mat.needsUpdate = true;
        });
      } else {
        die.mesh.material.map = this.createTexture(String(value), '#d0d0d0', 'd100');
        die.mesh.material.needsUpdate = true;
      }
      return value;
    }

    const up = new THREE.Vector3(0, 1, 0);
    let bestDot = -Infinity;
    let bestValue = 1;

    die.data.faceNormals.forEach((normal, idx) => {
      const worldNormal = normal.clone().applyQuaternion(die.mesh.quaternion);
      const dot = worldNormal.dot(up);
      if (dot > bestDot) {
        bestDot = dot;
        bestValue = die.data.values[idx % die.data.values.length] || 1;
      }
    });

    return bestValue;
  }

  initUIBindings() {
    const buttons = document.querySelectorAll('[data-die]');
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-die');
        this.spawn(type);
      });
    });

    const clearBtn = document.getElementById('dice-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clear());
    }

    const modeInputs = document.querySelectorAll('input[name="roll-mode"]');
    modeInputs.forEach((input) => {
      input.addEventListener('change', () => {
        this.rollMode = input.value;
        this.updateUI(true);
      });
    });
  }

  updateUI(forceReady = false) {
    if (!this.resultEl) return;
    const anyRolling = this.diceList.some((die) => !die.atRest);
    if (anyRolling && !forceReady) {
      this.resultEl.textContent = 'Rolling...';
      return;
    }

    if (this.diceList.length === 0) {
      this.resultEl.textContent = 'Ready to roll.';
      return;
    }

    const results = this.diceList.map((die) => this.calculateValue(die));

    if (this.rollMode === 'normal') {
      const total = results.reduce((sum, v) => sum + v, 0);
      this.resultEl.textContent = `Total: ${total} (${results.join(' + ')})`;
      return;
    }

    const d20Results = this.diceList
      .filter((die) => die.type === 'd20')
      .map((die) => this.calculateValue(die));

    if (d20Results.length === 0) {
      this.resultEl.textContent = 'Roll two d20s for advantage/disadvantage.';
      return;
    }

    const firstTwo = d20Results.slice(0, 2);
    const low = Math.min(...firstTwo);
    const high = Math.max(...firstTwo);

    if (this.rollMode === 'advantage') {
      this.resultEl.textContent = `ADV: ${high} (rolls: ${firstTwo.join(', ')})`;
    } else {
      this.resultEl.textContent = `DIS: ${low} (rolls: ${firstTwo.join(', ')})`;
    }
  }
}

export function initDiceRoller(containerElement) {
  const app = new DiceApp(containerElement);
  window.diceApp = app;
}
