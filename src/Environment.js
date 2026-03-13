import * as THREE from 'three';

export class Environment {
    constructor(scene) {
        this.scene = scene;
        this.init();
    }

    init() {
        this.noiseScale1 = 0.005; // Plaint/Basin wide scale
        this.noiseScale2 = 0.01;  // Rolling hills
        this.noiseScale3 = 0.04;  // Mountains detail
        
        this.traps = [];
        this.animals = [];
        this.wells = [];
        
        this.waterLevel = 4;

        this.createSky();
        this.createTerrain();
        this.createWater();
        this.createLighting();
        this.createTrees();
        this.spawnAnimals();
        
        // Starting items (ensure not underwater by checking height near spawn at x=0, z=15)
        this.addCampfire(0, this.getHeightAt(0, 15), 15);
        this.addWell(5, this.getHeightAt(5, 12), 12);
    }

    createSky() {
        // Golden hour / Winter evening sky
        const vertexShader = `
            varying vec3 vWorldPosition;
            void main() {
                vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
                vWorldPosition = worldPosition.xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
            }
        `;
        const fragmentShader = `
            uniform vec3 topColor;
            uniform vec3 bottomColor;
            uniform float offset;
            uniform float exponent;
            varying vec3 vWorldPosition;
            void main() {
                float h = normalize( vWorldPosition + offset ).y;
                gl_FragColor = vec4( mix( bottomColor, topColor, max( pow( max( h, 0.0 ), exponent ), 0.0 ) ), 1.0 );
            }
        `;
        const uniforms = {
            topColor: { value: new THREE.Color(0x3388cc) }, // Bright daytime blue
            bottomColor: { value: new THREE.Color(0xffd090) }, // Warm golden horizon
            offset: { value: 33 },
            exponent: { value: 0.6 }
        };

        const skyGeo = new THREE.SphereGeometry(4000, 32, 15);
        const skyMat = new THREE.ShaderMaterial({
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            uniforms: uniforms,
            side: THREE.BackSide
        });

        const sky = new THREE.Mesh(skyGeo, skyMat);
        this.scene.add(sky);
        
        this.scene.fog = new THREE.FogExp2(0xaaddff, 0.0002); // Light blue daytime fog
    }

    createTerrain() {
        const size = 2000;
        const segments = 128;
        const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
        geometry.rotateX(-Math.PI / 2);

        const vertices = geometry.attributes.position.array;
        for (let i = 0; i < vertices.length; i += 3) {
            const x = vertices[i];
            const z = vertices[i + 2];
            vertices[i + 1] = this.getHeightAt(x, z);
        }
        geometry.computeVertexNormals();

        // Terrain color: Reddish rocky terrain (Utah Sandstone / Granite mix)
        const material = new THREE.MeshStandardMaterial({
            color: 0x9b3a1f,
            roughness: 0.9,
            metalness: 0.05
        });

        this.terrain = new THREE.Mesh(geometry, material);
        this.terrain.receiveShadow = true;
        this.scene.add(this.terrain);
    }

    createWater() {
        const waterGeo = new THREE.PlaneGeometry(2000, 2000);
        waterGeo.rotateX(-Math.PI / 2);
        const waterMat = new THREE.MeshStandardMaterial({
            color: 0x114488,
            transparent: true,
            opacity: 0.8,
            roughness: 0.1,
            metalness: 0.8
        });
        this.water = new THREE.Mesh(waterGeo, waterMat);
        this.water.position.y = 4; // Water level
        this.scene.add(this.water);
    }

    createLighting() {
        const ambientLight = new THREE.AmbientLight(0xfff5e0, 1.2); // Bright warm daylight ambient
        this.scene.add(ambientLight);

        const sunLight = new THREE.DirectionalLight(0xfff8e7, 2.5); // Bright midday sun
        sunLight.position.set(-100, 50, -100);
        sunLight.castShadow = true;
        
        // Shadow settings
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 500;
        
        this.scene.add(sunLight);
        
        // Add a moon/sky light
        const moonLight = new THREE.DirectionalLight(0x88aaff, 0.2);
        moonLight.position.set(100, 100, 100);
        this.scene.add(moonLight);
    }

    update(delta, playerPosition) {
        // Flickering effect for campfire
        if (this.fireLight) {
            this.fireLight.intensity = 2 + Math.random() * 2;
        }

        // Update Animals
        if (this.animalsGroup) {
            this.animalsGroup.children.forEach(animal => {
                const moveSpeed = 5 * delta;
                
                // Keep moving forward
                animal.translateZ(moveSpeed);
                
                // Fix height to terrain
                const ax = animal.position.x;
                const az = animal.position.z;
                let ay = this.getHeightAt(ax, az);
                
                // Avoid deep water
                if (ay < this.waterLevel) {
                    animal.rotation.y += Math.PI / 2; // Turn around
                    ay = this.waterLevel;
                }
                
                animal.position.y = ay + 1; // animal center height
                
                // Randomly change direction occasionally
                if (Math.random() < 0.01) {
                    animal.rotation.y += (Math.random() - 0.5) * 2;
                }
            });
        }

        // Update Traps
        this.traps.forEach(trap => {
            if (!trap.userData.sprung && Date.now() - trap.userData.placedTime > 15000) { // 15 seconds to spring
                if (Math.random() > 0.3) { // 70% chance to catch something
                    trap.userData.sprung = true;
                    // Visual indicator: Close the trap jaws (the Torus)
                    const jaw = trap.children[1];
                    jaw.rotation.x = 0; 
                    jaw.material.color.setHex(0xaa3333); // Bloody red to indicate food
                } else {
                    trap.userData.placedTime = Date.now(); // Reset timer if failed
                }
            }
        });
    }

    getHeightAt(x, z) {
        // Utah rocky mountains: sharp ridges, deep canyons
        let base = Math.sin(x * this.noiseScale1) + Math.cos(z * this.noiseScale1) + 
                   (Math.sin(x * this.noiseScale2) * Math.cos(z * this.noiseScale2)) * 0.5;
        let y = 0;
        if (base > 0) {
            // Jagged, high peaks of Wasatch/Uinta
            let jagged = 1.0 - Math.abs(Math.sin(x * this.noiseScale3 + z * this.noiseScale3));
            y = Math.pow(base, 2.0) * 80; 
            y += jagged * 25 * base; 
        } else {
            // Great Basin valleys and plateaus
            y = Math.sin(x * this.noiseScale2 * 2) * Math.sin(z * this.noiseScale2 * 2) * 10; 
        }
        y -= 5;
        return y;
    }

    createTrees() {
        this.treesGroup = new THREE.Group();
        this.scene.add(this.treesGroup);

        const treeCount = 200;
        for (let i = 0; i < treeCount; i++) {
            const x = (Math.random() - 0.5) * 1000;
            const z = (Math.random() - 0.5) * 1000;
            const y = this.getHeightAt(x, z);
            
            this.addPineTree(x, y, z);
        }
    }

    addPineTree(x, y, z) {
        const group = new THREE.Group();
        
        // Trunk
        const trunkGeo = new THREE.CylinderGeometry(0.2, 0.4, 3, 8);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 1.5;
        group.add(trunk);
        
        // Leaves (Cones)
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x0a2f0a });
        for (let i = 0; i < 3; i++) {
            const leafGeo = new THREE.ConeGeometry(1.5 - i * 0.3, 2, 8);
            const leaves = new THREE.Mesh(leafGeo, leafMat);
            leaves.position.y = 2.5 + i * 1.2;
            group.add(leaves);
        }
        
        group.position.set(x, y, z);
        group.scale.setScalar(1 + Math.random() * 0.5);
        this.treesGroup.add(group);
    }

    removeTree(object) {
        let tree = object;
        while (tree.parent && tree.parent !== this.treesGroup) {
            tree = tree.parent;
        }
        if (tree && tree.parent === this.treesGroup) {
            this.treesGroup.remove(tree);
            // Optional: Free up memory
            tree.traverse((child) => {
                if (child.isMesh) {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => m.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                }
            });
            return true;
        }
        return false;
    }

    addCabin(x, y, z) {
        const group = new THREE.Group();

        // Main cabin
        const cabinGeo = new THREE.BoxGeometry(6, 4, 8);
        const cabinMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });
        const cabin = new THREE.Mesh(cabinGeo, cabinMat);
        cabin.position.y = 2;
        cabin.castShadow = true;
        cabin.receiveShadow = true;
        group.add(cabin);

        // Roof
        const roofGeo = new THREE.ConeGeometry(6, 4, 4);
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x3e2723 });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.y = 5;
        roof.rotation.y = Math.PI / 4;
        roof.castShadow = true;
        group.add(roof);

        // Chimney
        const chimneyGeo = new THREE.BoxGeometry(1, 4, 1);
        const chimneyMat = new THREE.MeshStandardMaterial({ color: 0x212121 });
        const chimney = new THREE.Mesh(chimneyGeo, chimneyMat);
        chimney.position.set(2, 4, 2);
        group.add(chimney);

        group.position.set(x, y, z);
        this.scene.add(group);
    }

    addCampfire(x, y, z) {
        const group = new THREE.Group();

        // Rocks around fire
        const rockGeo = new THREE.DodecahedronGeometry(0.3, 0);
        const rockMat = new THREE.MeshStandardMaterial({ color: 0x888888 });
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const rock = new THREE.Mesh(rockGeo, rockMat);
            rock.position.set(Math.cos(angle) * 1.5, 0.1, Math.sin(angle) * 1.5);
            group.add(rock);
        }

        // Logs
        const logGeo = new THREE.CylinderGeometry(0.1, 0.1, 2, 8);
        const logMat = new THREE.MeshStandardMaterial({ color: 0x3e2723 });
        for (let i = 0; i < 3; i++) {
            const log = new THREE.Mesh(logGeo, logMat);
            log.rotation.z = Math.PI / 2;
            log.rotation.y = (i / 3) * Math.PI;
            group.add(log);
        }

        // Fire light
        this.fireLight = new THREE.PointLight(0xff5500, 2, 15);
        this.fireLight.position.set(0, 1, 0);
        this.fireLight.castShadow = true;
        group.add(this.fireLight);

        group.position.set(x, y, z);
        this.scene.add(group);
    }
    
    spawnAnimals() {
        this.animalsGroup = new THREE.Group();
        this.scene.add(this.animalsGroup);
        
        for (let i = 0; i < 30; i++) {
            const animal = new THREE.Group();
            
            // Body (e.g. Bison/Deer shape)
            const bodyGeo = new THREE.BoxGeometry(1.5, 1, 2.5);
            const bodyMat = new THREE.MeshStandardMaterial({ color: 0x4a3b2c });
            const body = new THREE.Mesh(bodyGeo, bodyMat);
            animal.add(body);
            
            // Head
            const headGeo = new THREE.BoxGeometry(0.8, 0.8, 1);
            const head = new THREE.Mesh(headGeo, bodyMat);
            head.position.set(0, 0.5, 1.5);
            animal.add(head);
            
            // Set random position avoiding water
            let x, z, y;
            do {
                x = (Math.random() - 0.5) * 800;
                z = (Math.random() - 0.5) * 800;
                y = this.getHeightAt(x, z);
            } while (y < this.waterLevel);
            
            animal.position.set(x, y + 1, z);
            animal.rotation.y = Math.random() * Math.PI * 2;
            
            animal.userData.isAnimal = true;
            this.animalsGroup.add(animal);
        }
    }

    placeTrap(x, y, z) {
        const trapGroup = new THREE.Group();
        const baseGeo = new THREE.BoxGeometry(0.6, 0.1, 0.6);
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const base = new THREE.Mesh(baseGeo, baseMat);
        trapGroup.add(base);

        const jawGeo = new THREE.TorusGeometry(0.25, 0.05, 8, 16, Math.PI);
        const jawMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
        const jaw1 = new THREE.Mesh(jawGeo, jawMat);
        jaw1.rotation.x = -Math.PI / 2;
        trapGroup.add(jaw1);
        
        trapGroup.position.set(x, y, z);
        trapGroup.userData = { isTrap: true, sprung: false, placedTime: Date.now() };
        
        this.scene.add(trapGroup);
        this.traps.push(trapGroup);
        return trapGroup;
    }
    
    removeTrap(trap) {
        const index = this.traps.indexOf(trap);
        if (index > -1) {
            this.traps.splice(index, 1);
            this.scene.remove(trap);
            return true;
        }
        return false;
    }

    addWell(x, y, z) {
        const group = new THREE.Group();
        
        // Base stones
        const baseGeo = new THREE.CylinderGeometry(1.5, 1.5, 0.8, 12);
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.9, metalness: 0.1 });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.y = 0.4;
        group.add(base);
        
        // Water inside
        const waterGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.7, 12);
        const waterMat = new THREE.MeshStandardMaterial({ color: 0x114488, transparent: true, opacity: 0.8 });
        const water = new THREE.Mesh(waterGeo, waterMat);
        water.position.y = 0.4;
        group.add(water);

        group.position.set(x, y, z);
        group.userData = { isWell: true };
        this.scene.add(group);
        this.wells.push(group);
    }
}
