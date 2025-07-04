import * as THREE from 'three';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.150.1/examples/jsm/loaders/GLTFLoader.js';
import { Bullet } from './Bullet.js';
import { loadingMgr } from './LoadingMgr.js';

export class Turret {
  constructor(pos, scene, spawner, bulletArray) {
    this.fireRate   = 2;   // shots/sec
    this.range      = 5000;  // firing radius
    this.turnSpeed  = 2;   // radians/sec
    this.cooldown   = 0;
    this.bulletArray = bulletArray;
    this.scene    = scene;
    this.spawner  = spawner;
    this.object   = new THREE.Group();  // will hold the loaded GLTF mesh
    this.object.position.copy(pos);
    this.scene.add(this.object);

    // Load the GLTF turret model
    const loader = new GLTFLoader(loadingMgr);
    loader.load('assets/turret/scene.gltf', gltf => {
      const model = gltf.scene;

      // this is needed to make the model cast shadows
      model.traverse(o => {
      if (o.isMesh) {
        o.castShadow    = true;    // ← THIS makes the sun paint its silhouette
        o.receiveShadow = true;    // nice contact darkening on itself (optional)
      }
      });

      // OPTIONAL: scale and rotate to fit your world
      model.scale.set(1, 1, 1);
      model.rotation.y = 2*Math.PI;
      
      /* 1. lift model so it rests on the ground ----------------------- */
      const box = new THREE.Box3().setFromObject(model);
      const heightBelowOrigin = box.min.y;   // negative
      model.position.y -= heightBelowOrigin; // now sits on y = 0

      /* 2. create a muzzle helper ------------------------------------- */
      // Pick a position relative to the model.  Here we take the
      // current bounding box and place the muzzle a bit forward (+Z)
      // and centred in X, Y.
      const muzzle = new THREE.Object3D();
      const yMid = (box.max.y + box.min.y) * 0.5;      // halfway up
      const zFront = box.max.z + 0.2;                  // 20 cm in front
      muzzle.position.set(0, yMid, zFront);
      model.add(muzzle);
      this.muzzle = muzzle;
      
      /* add model last ------------------------------------------------- */
      this.object.add(model);
    });
  }

  update(dt) {
    // Find closest enemy
    let closest = null;
    let closestDistSq = this.range;

    for (const e of this.spawner.enemies) {
      const dSq = e.mesh.position.distanceToSquared(this.object.position);
      if (dSq < closestDistSq) {
        closest = e;
        closestDistSq = dSq;
      }
    }

    if (!closest) {
      this.cooldown = Math.max(0, this.cooldown - dt);
      return;
    }

    // Aim at enemy (XZ plane only)
    const toTarget = closest.mesh.position.clone()
                       .sub(this.object.position)
                       .setY(0)
                       .normalize();

    const currentDir = new THREE.Vector3(0, 0, 1)
                         .applyQuaternion(this.object.quaternion);
    const angle = currentDir.angleTo(toTarget);
    const maxStep = this.turnSpeed * dt;

    if (angle > 0.001) {
      const axis = currentDir.clone().cross(toTarget).normalize();
      const step = Math.min(maxStep, angle);
      this.object.quaternion.multiply(
        new THREE.Quaternion().setFromAxisAngle(axis, step)
      );
    }

    // Fire
    this.cooldown -= dt;
    if (
      angle < 0.001 && 
      this.cooldown <= 0 && 
      closestDistSq < this.range
    ) {

      const muzzlePos = this.muzzle.getWorldPosition(new THREE.Vector3());
      const muzzleDir = closest.mesh.position.clone().sub(muzzlePos).normalize();

      const bullet = new Bullet(muzzlePos, muzzleDir, this.scene);
      this.bulletArray.push(bullet)
      this.cooldown = 1 / this.fireRate;
    }
  }
}
