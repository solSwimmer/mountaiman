import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

export class Player {
    constructor(camera, domElement) {
        this.camera = camera;
        this.controls = new PointerLockControls(camera, domElement);
        
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.canJump = true;
        
        this.inventory = ['axe', 'trap', 'gun'];
        this.currentSelection = 0;
        
        this.wood = 0;
        this.food = 0;
        this.hydration = 100;
        this.lastHydrationTime = Date.now();
        
        this.initListeners();
        this.initItems();
    }

    initItems() {
        this.itemsGroup = new THREE.Group();
        this.camera.add(this.itemsGroup);

        // Axe Model
        this.axe = new THREE.Group();
        const handleGeo = new THREE.CylinderGeometry(0.05, 0.05, 1, 8);
        const handleMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });
        const handle = new THREE.Mesh(handleGeo, handleMat);
        handle.rotation.z = Math.PI / 2;
        this.axe.add(handle);

        const headGeo = new THREE.BoxGeometry(0.3, 0.2, 0.1);
        const headMat = new THREE.MeshStandardMaterial({ color: 0x999999 });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.set(0.4, 0.1, 0);
        this.axe.add(head);
        
        this.axe.position.set(0.5, -0.4, -0.8);
        this.axe.rotation.y = -Math.PI / 4;
        this.axe.visible = true;
        this.itemsGroup.add(this.axe);

        // Trap Model
        this.trap = new THREE.Group();
        const baseGeo = new THREE.BoxGeometry(0.6, 0.1, 0.6);
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const base = new THREE.Mesh(baseGeo, baseMat);
        this.trap.add(base);

        const jawGeo = new THREE.TorusGeometry(0.25, 0.05, 8, 16, Math.PI);
        const jawMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
        const jaw1 = new THREE.Mesh(jawGeo, jawMat);
        jaw1.rotation.x = -Math.PI / 2;
        this.trap.add(jaw1);
        
        this.trap.position.set(0.5, -0.4, -0.8);
        this.trap.visible = false;
        this.itemsGroup.add(this.trap);

        // Gun Model (Musket)
        this.gun = new THREE.Group();
        const stockGeo = new THREE.BoxGeometry(0.1, 0.15, 0.6);
        const stockMat = new THREE.MeshStandardMaterial({ color: 0x3d2314 });
        const stock = new THREE.Mesh(stockGeo, stockMat);
        stock.position.set(0, -0.1, 0);
        this.gun.add(stock);

        const barrelGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.2, 8);
        const barrelMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.8 });
        const barrel = new THREE.Mesh(barrelGeo, barrelMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0, -0.6);
        this.gun.add(barrel);
        
        this.gun.position.set(0.4, -0.3, -0.6);
        this.gun.visible = false;
        this.itemsGroup.add(this.gun);
    }

    initListeners() {
        const onKeyDown = (event) => {
            switch (event.code) {
                case 'ArrowUp':
                case 'KeyW': this.moveForward = true; break;
                case 'ArrowLeft':
                case 'KeyA': this.moveLeft = true; break;
                case 'ArrowDown':
                case 'KeyS': this.moveBackward = true; break;
                case 'ArrowRight':
                case 'KeyD': this.moveRight = true; break;
            }
        };

        const onKeyUp = (event) => {
            switch (event.code) {
                case 'ArrowUp':
                case 'KeyW': this.moveForward = false; break;
                case 'ArrowLeft':
                case 'KeyA': this.moveLeft = false; break;
                case 'ArrowDown':
                case 'KeyS': this.moveBackward = false; break;
                case 'ArrowRight':
                case 'KeyD': this.moveRight = false; break;
                case 'Digit1': this.selectItem(0); break;
                case 'Digit2': this.selectItem(1); break;
                case 'Digit3': this.selectItem(2); break;
                case 'Space': this.jump(); break;
            }

        };

        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);
    }

    jump() {
        if (this.canJump) {
            this.velocity.y += 15.0;
            this.canJump = false;
        }
    }

    selectItem(index) {
        this.currentSelection = index;
        this.axe.visible = (index === 0);
        this.trap.visible = (index === 1);
        this.gun.visible = (index === 2);
    }

    update(delta, environment, scene) {
        if (this.controls.isLocked) {
            // Friction
            this.velocity.x -= this.velocity.x * 10.0 * delta;
            this.velocity.z -= this.velocity.z * 10.0 * delta;
            this.velocity.y -= 9.8 * 4.0 * delta; // Gravity

            this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
            this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
            this.direction.normalize();

            // Acceleration
            const speed = 600.0;
            if (this.moveForward || this.moveBackward) this.velocity.z -= this.direction.z * speed * delta;
            if (this.moveLeft || this.moveRight) this.velocity.x -= this.direction.x * speed * delta;

            this.controls.moveRight(-this.velocity.x * delta);
            this.controls.moveForward(-this.velocity.z * delta);
            
            this.controls.getObject().position.y += this.velocity.y * delta;

            // Terrain Collision / Gravity
            const pos = this.getPosition();
            const terrainHeight = environment.getHeightAt(pos.x, pos.z);
            
            if (this.controls.getObject().position.y < terrainHeight + 1.7) {
                this.velocity.y = 0;
                this.controls.getObject().position.y = terrainHeight + 1.7;
                this.canJump = true;
            }

            // Dehydration logic
            if (Date.now() - this.lastHydrationTime > 1000) {
                this.hydration -= 0.5; // Lose 0.5 hydration per second
                if (this.hydration < 0) this.hydration = 0;
                this.lastHydrationTime = Date.now();
                this.updateStatsUI();
                
                if (this.hydration <= 0) {
                    // Blur/red screen or take damage - for now just slow down
                    this.velocity.x *= 0.5;
                    this.velocity.z *= 0.5;
                }
            }

            // Sway item

            if (this.itemsGroup) {
                const speed = (this.moveForward || this.moveBackward || this.moveLeft || this.moveRight) ? 0.015 : 0.005;
                this.itemsGroup.position.y = Math.sin(Date.now() * speed) * 0.02;
            }

            this.checkInteraction(scene);
        }
    }

    interact(environment) {
        if (!this.controls.isLocked) return;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        const pos = this.getPosition();

        if (this.currentSelection === 0 && this.axe.visible) {
            // Chop tree
            this.animateAxeSwing();
            if (environment.treesGroup) {
                const intersects = raycaster.intersectObjects(environment.treesGroup.children, true);
                if (intersects.length > 0 && intersects[0].distance < 6) {
                    if (environment.removeTree(intersects[0].object)) {
                        this.wood++;
                        this.updateStatsUI();
                    }
                }
            }
        } else if (this.currentSelection === 1 && this.trap.visible) {
            // Place Trap
            // First check if interacting with an already sprung trap
            const trapIntersects = raycaster.intersectObjects(environment.traps, true);
            if (trapIntersects.length > 0 && trapIntersects[0].distance < 4) {
                let hitGroup = trapIntersects[0].object;
                while (hitGroup.parent && hitGroup.parent !== environment.scene) hitGroup = hitGroup.parent;
                
                if (hitGroup.userData && hitGroup.userData.isTrap && hitGroup.userData.sprung) {
                    environment.removeTrap(hitGroup);
                    this.food += 1;
                    this.updateStatsUI();
                    return; // Don't place a new one if we just picked one up
                }
            }
            
            // Otherwise, place a trap (UNLIMITED TRAPS)
            const direction = new THREE.Vector3();
            this.camera.getWorldDirection(direction);
            const placePos = pos.clone().add(direction.multiplyScalar(3));
            placePos.y = environment.getHeightAt(placePos.x, placePos.z);
            environment.placeTrap(placePos.x, placePos.y, placePos.z);
            
            // Visual feedback - hide trap briefly
            this.trap.visible = false;
            setTimeout(() => { if (this.currentSelection === 1) this.trap.visible = true; }, 500);
            
        } else if (this.currentSelection === 2 && this.gun.visible) {
            // Shoot Gun
            this.animateGunShoot();
            
            if (environment.animalsGroup) {
                const animalsIntersects = raycaster.intersectObjects(environment.animalsGroup.children, true);
                if (animalsIntersects.length > 0) {
                    let hitAnimal = animalsIntersects[0].object;
                    while (hitAnimal.parent && hitAnimal.parent !== environment.animalsGroup) {
                        hitAnimal = hitAnimal.parent;
                    }
                    if (hitAnimal.userData.isAnimal) {
                        environment.animalsGroup.remove(hitAnimal);
                        this.food += 2; // Hunting gives more food
                        this.updateStatsUI();
                    }
                }
            }
        }
        
        // Always check drinking water if looking down
        const dir = new THREE.Vector3();
        this.camera.getWorldDirection(dir);
        
        // 1. Natural Lakes
        if (dir.y < -0.5 && pos.y < environment.waterLevel + 3) {
            this.hydration = 100;
            this.updateStatsUI();
        }
        
        // 2. Wells (Left click on a well)
        if (environment.wells) {
            const wellIntersects = raycaster.intersectObjects(environment.wells, true);
            if (wellIntersects.length > 0 && wellIntersects[0].distance < 6) {
                this.hydration = 100;
                this.updateStatsUI();
            }
        }
    }

    buildCabin(environment) {
        if (this.wood >= 10) {
            this.wood -= 10;
            this.updateStatsUI();
            
            const pos = this.getPosition();
            
            // Calculate a spot slightly in front of the player
            const direction = new THREE.Vector3();
            this.camera.getWorldDirection(direction);
            direction.y = 0;
            direction.normalize();
            
            const placeTarget = pos.clone().add(direction.multiplyScalar(10));
            
            environment.addCabin(placeTarget.x, environment.getHeightAt(placeTarget.x, placeTarget.z), placeTarget.z);
            return true;
        }
        return false;
    }

    animateAxeSwing() {
        const initialRot = this.axe.rotation.x;
        this.axe.rotation.x -= Math.PI / 3;
        setTimeout(() => {
            this.axe.rotation.x = initialRot;
        }, 150);
    }
    
    animateGunShoot() {
        const initialZ = this.gun.position.z;
        const initialRotX = this.gun.rotation.x;
        
        // Recoil
        this.gun.position.z += 0.2;
        this.gun.rotation.x -= 0.1;
        
        // Fake flash (quick ambient light burst) would be ideal, but modifying position works for feel
        setTimeout(() => {
            this.gun.position.z = initialZ;
            this.gun.rotation.x = initialRotX;
        }, 100);
    }

    updateStatsUI() {
        const woodEl = document.getElementById('wood-counter');
        const foodEl = document.getElementById('food-counter');
        const waterEl = document.getElementById('water-counter');
        
        if (woodEl) woodEl.innerText = `Wood: ${this.wood}/10`;
        if (foodEl) foodEl.innerText = `Food: ${this.food}`;
        if (waterEl) {
            waterEl.innerText = `Water: ${Math.floor(this.hydration)}%`;
            if (this.hydration < 20) waterEl.style.color = '#ff4444';
            else waterEl.style.color = '#ffffff';
        }
    }

    checkInteraction(scene) {
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        const intersects = raycaster.intersectObjects(scene.children, true);
        
        if (intersects.length > 0 && intersects[0].distance < 3) {
            // Simple visual feedback for interaction
            // In a real game we'd check object type
            // For now, let's just log or show a hint later
        }
    }

    getPosition() {
        return this.controls.getObject().position;
    }
}
