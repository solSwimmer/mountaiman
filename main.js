import * as THREE from 'three';
import { Environment } from './src/Environment.js';
import { Player } from './src/Player.js';

let scene, camera, renderer;
let environment, player;
let prevTime = performance.now();

const instructions = document.getElementById('instructions');

init();
animate();

function init() {
    // Scene
    scene = new THREE.Scene();

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
    
    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    // Modules
    player = new Player(camera, document.body);
    environment = new Environment(scene);

    // Initial position to avoid clipping before start
    camera.position.set(0, 10, 20);
    camera.lookAt(0, 0, 0);

    scene.add(player.controls.getObject());

    const startGame = (e) => {
        // If already locked, trigger interaction (unless clicking HUD)
        if (player.controls.isLocked) {
            if (e.button === 0) {
                player.interact(environment);
            }
            return;
        }
        
        player.controls.lock();
        // Immediate feedback even if lock fails/is delayed
        instructions.style.opacity = '0';
        setTimeout(() => instructions.style.display = 'none', 500);
    };

    document.addEventListener('mousedown', startGame);

    player.controls.addEventListener('lock', () => {
        instructions.style.display = 'none';
        instructions.style.opacity = '0';
        document.getElementById('hud').style.display = 'flex';
    });

    player.controls.addEventListener('unlock', () => {
        instructions.style.display = 'block';
        setTimeout(() => instructions.style.opacity = '1', 10);
        document.getElementById('hud').style.display = 'none';
    });

    // HUD Listeners
    document.getElementById('btn-jump').addEventListener('mousedown', (e) => {
        e.stopPropagation();
        player.jump();
    });

    const updateUISelection = (index) => {
        document.querySelectorAll('.hud-btn').forEach(b => b.classList.remove('active-item'));
        if (index === 0) document.getElementById('btn-axe').classList.add('active-item');
        if (index === 1) document.getElementById('btn-trap').classList.add('active-item');
        if (index === 2) document.getElementById('btn-gun').classList.add('active-item');
    };

    document.getElementById('btn-axe').addEventListener('mousedown', (e) => {
        e.stopPropagation();
        player.selectItem(0);
        updateUISelection(0);
    });

    document.getElementById('btn-trap').addEventListener('mousedown', (e) => {
        e.stopPropagation();
        player.selectItem(1);
        updateUISelection(1);
    });
    
    document.getElementById('btn-gun').addEventListener('mousedown', (e) => {
        e.stopPropagation();
        player.selectItem(2);
        updateUISelection(2);
    });

    // Update UI on key press
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Digit1') updateUISelection(0);
        if (e.code === 'Digit2') updateUISelection(1);
        if (e.code === 'Digit3') updateUISelection(2);
        if (e.code === 'KeyB') player.buildCabin(environment);
    });

    window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();
    const delta = (time - prevTime) / 1000;

    player.update(delta, environment, scene);
    environment.update(delta, player.getPosition());

    renderer.render(scene, camera);
    prevTime = time;
}
