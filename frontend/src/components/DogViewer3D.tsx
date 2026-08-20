import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Loader2 } from 'lucide-react';

export const DogViewer3D: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [activeAnim, setActiveAnim] = useState<string>('Walk');
  
  // Keep mutable references for three.js objects
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<Record<string, THREE.AnimationAction>>({});
  const activeActionRef = useRef<THREE.AnimationAction | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    setLoading(true);

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Create Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xfaf8f5); // Matches background color perfectly

    // 2. Camera Setup
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 1.2, 3.2);

    // 3. Renderer Setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    
    // Clear previous elements
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05; // Lock camera from dipping below ground
    controls.minDistance = 1.5;
    controls.maxDistance = 8;
    controls.target.set(0, 0.3, 0);

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x555555, 0.3);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
    dirLight.position.set(4, 7, 3);
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 2;
    dirLight.shadow.camera.bottom = -2;
    dirLight.shadow.camera.left = -2;
    dirLight.shadow.camera.right = 2;
    dirLight.shadow.camera.near = 0.1;
    dirLight.shadow.camera.far = 25;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    // 6. Invisible ground plane to receive shadows seamlessly
    const floorGeo = new THREE.PlaneGeometry(50, 50);
    const floorMat = new THREE.ShadowMaterial({ opacity: 0.15 }); // Shadow-only overlay
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // 7. Load GLTF model
    const loader = new GLTFLoader();
    let mixer: THREE.AnimationMixer | null = null;
    let actions: Record<string, THREE.AnimationAction> = {};

    loader.load(
      '/shiba_inu.glb',
      (gltf) => {
        const model = gltf.scene;
        modelRef.current = model;
        
        // Auto center and scale model
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        // Place model on floor
        model.position.x += (model.position.x - center.x);
        model.position.y += (model.position.y - box.min.y); 
        model.position.z += (model.position.z - center.z);

        // Adjust scale
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 0) {
          const targetScale = 1.3 / maxDim;
          model.scale.setScalar(targetScale);
        }

        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        scene.add(model);

        // Map animations
        if (gltf.animations && gltf.animations.length > 0) {
          mixer = new THREE.AnimationMixer(model);
          mixerRef.current = mixer;

          // Find specific clips keyword matches
          const findClip = (kw: string) => 
            gltf.animations.find(c => c.name.toLowerCase().includes(kw));

          const clipsMap = {
            'Idle': findClip('idle') || gltf.animations[0],
            'Walk': findClip('walk') || findClip('run') || gltf.animations[0],
            'Jump': findClip('jump') || findClip('hop') || findClip('run') || gltf.animations[0],
            'Eat': findClip('eat') || findClip('sit') || findClip('lick') || gltf.animations[0]
          };

          Object.entries(clipsMap).forEach(([key, clip]) => {
            if (mixer && clip) {
              actions[key] = mixer.clipAction(clip);
            }
          });

          actionsRef.current = actions;

          // Play default Walk animation
          if (actions['Walk']) {
            actions['Walk'].play();
            activeActionRef.current = actions['Walk'];
          }
        }

        setLoading(false);
      },
      undefined,
      (error) => {
        console.error('Failed to load GLTF model:', error);
        setLoading(false);
      }
    );

    // 8. Animation Loop
    let lastTime = performance.now();
    let animationFrameId: number;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const currentTime = performance.now();
      const delta = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      if (mixerRef.current) {
        mixerRef.current.update(delta);
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // 9. Window Resize Handling
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(container);

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      if (container) {
        container.innerHTML = '';
      }
      renderer.dispose();
    };
  }, []);

  // Handle playing custom animations
  const triggerAnimation = (name: string) => {
    const action = actionsRef.current[name];
    const activeAction = activeActionRef.current;

    if (!action) return;

    if (activeAction && activeAction !== action) {
      action.reset();
      action.setEffectiveTimeScale(1);
      action.setEffectiveWeight(1);
      action.crossFadeFrom(activeAction, 0.4, true);
      action.play();
    } else {
      action.play();
    }

    activeActionRef.current = action;
    setActiveAnim(name);
  };

  return (
    <div className="w-full h-full flex flex-col relative bg-paper overflow-hidden">
      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-paper bg-opacity-70 backdrop-blur-sm z-10 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 text-turmeric animate-spin" />
          <span className="font-mono text-[9px] uppercase tracking-wider text-herb font-bold">
            Beckoning Shiba Inu...
          </span>
        </div>
      )}

      {/* ThreeJS Container Canvas */}
      <div ref={containerRef} className="flex-grow w-full min-h-[350px] h-full" />

      {/* Interactive Actions Overlay */}
      {!loading && (
        <div className="absolute bottom-6 left-6 right-6 z-20 bg-paperLight bg-opacity-80 backdrop-blur-sm border border-cardboard rounded-sm p-3 shadow-md">
          <span className="font-mono text-[8px] uppercase tracking-wider text-herb font-bold block mb-2 text-left">
            🐕 Action Playbook (Drag to rotate, Scroll to zoom)
          </span>
          <div className="flex gap-2 justify-start">
            {['Walk', 'Jump'].map((name) => (
              <button
                key={name}
                onClick={() => triggerAnimation(name)}
                className={`flex-1 font-mono text-[9px] uppercase font-bold tracking-wider py-2 border rounded-sm transition-all ${
                  activeAnim === name
                    ? 'bg-turmeric text-paperLight border-turmeric'
                    : 'bg-paperLight text-ink border-cardboard hover:bg-paper'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
