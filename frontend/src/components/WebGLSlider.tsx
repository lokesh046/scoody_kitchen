import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { ArrowLeft, ArrowRight, ShoppingBag } from 'lucide-react';
import type { ProductResponse } from '../types/product';

interface WebGLSliderProps {
  products: ProductResponse[];
}

export const WebGLSlider: React.FC<WebGLSliderProps> = ({ products }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const navigate = useNavigate();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // References for Three.js objects to manipulate across slide changes
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const texturesRef = useRef<THREE.Texture[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  // Helper to generate a procedural noise displacement texture on a 2D canvas
  const createNoiseDisplacementTexture = (): THREE.Texture => {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      // Draw organic gradient wave patterns to act as liquid displacement offsets
      const imgData = ctx.createImageData(size, size);
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const idx = (x + y * size) * 4;
          // Generate wave combinations
          const nx = x / size;
          const ny = y / size;
          
          const val1 = Math.sin(nx * Math.PI * 4) * Math.cos(ny * Math.PI * 4);
          const val2 = Math.sin((nx + ny) * Math.PI * 6);
          const raw = (val1 + val2 + 2) / 4; // Normalize 0 - 1
          
          const val = Math.floor(raw * 255);
          
          imgData.data[idx] = val; // R channel displacement
          imgData.data[idx + 1] = Math.floor(((Math.sin(nx * 10) + 1) / 2) * 255); // G channel displacement
          imgData.data[idx + 2] = 128; // B
          imgData.data[idx + 3] = 255; // Alpha
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  };

  // Helper to create a fallback brand texture using gradient canvases
  const createFallbackTexture = (name: string): THREE.Texture => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      // Brand gradient backgrounds (Scooby Cream to Tumeric/Forest Green highlight accents)
      const grad = ctx.createLinearGradient(0, 0, 800, 600);
      grad.addColorStop(0, '#faf6ee'); // Cream Paper
      grad.addColorStop(1, '#e3d2bf'); // Biscuit Cardboard
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 800, 600);

      // Add stylish ledger rules/borders
      ctx.strokeStyle = '#2d4a22'; // Forest Green
      ctx.lineWidth = 15;
      ctx.strokeRect(30, 30, 740, 540);

      ctx.fillStyle = '#2d4a22';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(name.substring(0, 24), 400, 300);
    }

    return new THREE.CanvasTexture(canvas);
  };

  useEffect(() => {
    if (!containerRef.current || !canvasRef.current || products.length === 0) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // 1. Setup Three.js Orthographic Scene for flat 2D slides
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 1, 1000);
    camera.position.z = 10;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;

    // 2. Load product textures
    const textureLoader = new THREE.TextureLoader();
    const loadedTextures: THREE.Texture[] = products.map((prod) => {
      if (prod.image_url) {
        const tex = textureLoader.load(
          prod.image_url,
          (t) => {
            t.minFilter = THREE.LinearFilter;
            t.generateMipmaps = false;
          },
          undefined,
          () => {
            // Fallback on load failure
            console.warn(`Failed loading image for ${prod.name}`);
          }
        );
        // Enable cross-origin image retrieval
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
      } else {
        return createFallbackTexture(prod.name);
      }
    });
    texturesRef.current = loadedTextures;

    const dispTexture = createNoiseDisplacementTexture();

    // 3. Setup shaders & uniforms
    // Shaders handle cover scaling ratio, ripple displacement offset, and cross-fade blending
    const uniforms = {
      texture1: { value: loadedTextures[0] },
      texture2: { value: loadedTextures[0] },
      dispTexture: { value: dispTexture },
      progress: { value: 0.0 },
      intensity: { value: new THREE.Vector2(0.2, 0.2) },
      uImageSize1: { value: new THREE.Vector2(800, 600) },
      uImageSize2: { value: new THREE.Vector2(800, 600) },
      uCanvasSize: { value: new THREE.Vector2(width, height) },
    };

    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      varying vec2 vUv;
      uniform sampler2D texture1;
      uniform sampler2D texture2;
      uniform sampler2D dispTexture;
      uniform float progress;
      uniform vec2 intensity;
      uniform vec2 uImageSize1;
      uniform vec2 uImageSize2;
      uniform vec2 uCanvasSize;

      vec2 getCoverUv(vec2 uv, vec2 imgSize, vec2 canvasSize) {
        float canvasAspect = canvasSize.x / canvasSize.y;
        float imgAspect = imgSize.x / imgSize.y;
        vec2 newUv = uv;
        if (canvasAspect > imgAspect) {
          float scale = canvasAspect / imgAspect;
          newUv.y = (uv.y - 0.5) / scale + 0.5;
        } else {
          float scale = imgAspect / canvasAspect;
          newUv.x = (uv.x - 0.5) / scale + 0.5;
        }
        return newUv;
      }

      void main() {
        vec4 disp = texture2D(dispTexture, vUv);
        
        // Dynamic ripple warping calculations based on noise texture coordinates
        vec2 dispUv = vec2(
          vUv.x + progress * (disp.r * intensity.x),
          vUv.y + progress * (disp.g * intensity.y)
        );

        vec2 dispUv2 = vec2(
          vUv.x - (1.0 - progress) * (disp.r * intensity.x),
          vUv.y - (1.0 - progress) * (disp.g * intensity.y)
        );

        // Aspect fit texture coordinates
        vec2 uv1 = getCoverUv(dispUv, uImageSize1, uCanvasSize);
        vec2 uv2 = getCoverUv(dispUv2, uImageSize2, uCanvasSize);

        // Safety clamp coordinates to prevent repeat artifacts at viewport edge
        uv1 = clamp(uv1, 0.0, 1.0);
        uv2 = clamp(uv2, 0.0, 1.0);

        vec4 t1 = texture2D(texture1, uv1);
        vec4 t2 = texture2D(texture2, uv2);

        gl_FragColor = mix(t1, t2, progress);
      }
    `;

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      transparent: true,
    });
    materialRef.current = material;

    // Plane covering full viewport screen
    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // 4. Render initial static frame
    renderer.render(scene, camera);

    // 5. Handle Resize Actions
    const handleResize = () => {
      if (!containerRef.current || !renderer || !material) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      renderer.setSize(w, h);
      material.uniforms.uCanvasSize.value.set(w, h);
      renderer.render(scene, camera);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup Resources on unmount
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      geometry.dispose();
      material.dispose();
      dispTexture.dispose();
      loadedTextures.forEach((tex) => tex.dispose());
      renderer.dispose();
    };
  }, [products]);

  // Handle slide transitions trigger
  const goToSlide = (nextIndex: number) => {
    if (isTransitioning || products.length <= 1 || !materialRef.current || !texturesRef.current || !rendererRef.current || !sceneRef.current || !cameraRef.current) return;

    const currentTexture = texturesRef.current[currentIndex];
    const nextTexture = texturesRef.current[nextIndex];

    // Configure texture dimensions uniforms (for aspect-ratio cover crop)
    const img1 = currentTexture.image as HTMLImageElement;
    const img2 = nextTexture.image as HTMLImageElement;

    const size1 = img1 ? new THREE.Vector2(img1.naturalWidth || 800, img1.naturalHeight || 600) : new THREE.Vector2(800, 600);
    const size2 = img2 ? new THREE.Vector2(img2.naturalWidth || 800, img2.naturalHeight || 600) : new THREE.Vector2(800, 600);

    materialRef.current.uniforms.uImageSize1.value = size1;
    materialRef.current.uniforms.uImageSize2.value = size2;

    // Load active texture values
    materialRef.current.uniforms.texture1.value = currentTexture;
    materialRef.current.uniforms.texture2.value = nextTexture;
    
    setIsTransitioning(true);

    // Run local animation render loop only during the active transition window
    let progress = 0.0;
    const animate = () => {
      if (!materialRef.current || !rendererRef.current || !sceneRef.current || !cameraRef.current || !texturesRef.current) return;

      progress += 0.035; // speed of the liquid warp transition
      if (progress >= 1.0) {
        materialRef.current.uniforms.progress.value = 1.0;
        rendererRef.current.render(sceneRef.current, cameraRef.current);

        // Complete transition: make texture1 the active texture
        materialRef.current.uniforms.texture1.value = texturesRef.current[nextIndex];
        materialRef.current.uniforms.progress.value = 0.0;
        rendererRef.current.render(sceneRef.current, cameraRef.current);

        setIsTransitioning(false);
        setCurrentIndex(nextIndex);
      } else {
        materialRef.current.uniforms.progress.value = progress;
        rendererRef.current.render(sceneRef.current, cameraRef.current);
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  };

  const handleNext = () => {
    const next = (currentIndex + 1) % products.length;
    goToSlide(next);
  };

  const handlePrev = () => {
    const prev = (currentIndex - 1 + products.length) % products.length;
    goToSlide(prev);
  };

  // Auto-scroll loop every 5.5 seconds
  useEffect(() => {
    if (products.length <= 1 || isTransitioning) return;
    const timer = setTimeout(() => {
      handleNext();
    }, 5500);

    return () => clearTimeout(timer);
  }, [currentIndex, products, isTransitioning]);

  const currentProduct = products[currentIndex];
  if (!currentProduct) return null;

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-[320px] sm:h-[380px] md:h-[450px] bg-paper border border-cardboard overflow-hidden select-none"
    >
      {/* Three.js Canvas Element */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />

      {/* Styled Ledger Paper Overlay Panel Card */}
      <div 
        className="absolute left-4 sm:left-8 md:left-12 bottom-4 sm:bottom-8 md:bottom-12 max-w-[280px] sm:max-w-sm md:max-w-md bg-paper bg-opacity-95 border border-cardboard p-4 sm:p-6 text-left shadow-xs z-10 rounded-none transition-all duration-300"
      >
        <span className="font-mono text-[9px] uppercase tracking-wider text-herb font-bold mb-1 block">
          {currentProduct.category?.name || 'Recipe Sensation'} | SKU: {currentProduct.sku}
        </span>
        
        <h2 className="font-display text-base sm:text-lg md:text-xl font-bold text-ink mb-1.5 md:mb-2 line-clamp-1">
          {currentProduct.name}
        </h2>
        
        <p className="font-body text-[11px] md:text-xs text-ink opacity-80 mb-3 md:mb-4 line-clamp-2 leading-relaxed">
          {currentProduct.description || 'Sourced with premium, organic components tailored for pet nutrition.'}
        </p>

        <div className="flex items-center justify-between border-t border-cardboard border-dashed pt-3 mt-1">
          <div className="flex flex-col">
            <span className="font-mono text-[8px] uppercase text-ink opacity-60">Price Sourced</span>
            <span className="font-mono text-xs sm:text-sm font-bold text-ink">₹{Number(currentProduct.price).toFixed(2)}</span>
          </div>
          
          <button
            onClick={() => navigate(`/product/${currentProduct.id}`)}
            className="inline-flex items-center space-x-1.5 bg-turmeric text-ink font-mono text-[9px] uppercase font-bold px-3 py-2 border border-cardboard shadow-xs hover:bg-opacity-90 hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Order Sensation</span>
          </button>
        </div>
      </div>

      {/* Slide Navigation Buttons */}
      {products.length > 1 && (
        <div className="absolute right-4 sm:right-8 md:right-12 bottom-4 sm:bottom-8 md:bottom-12 flex space-x-2 z-10">
          <button
            onClick={handlePrev}
            disabled={isTransitioning}
            className="bg-paper border border-cardboard p-2 sm:p-2.5 text-ink hover:bg-paperLight hover:-translate-y-0.5 disabled:opacity-50 transition-all cursor-pointer rounded-none"
            title="Previous Recipe"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          
          <button
            onClick={handleNext}
            disabled={isTransitioning}
            className="bg-turmeric border border-cardboard p-2 sm:p-2.5 text-ink hover:bg-opacity-90 hover:-translate-y-0.5 disabled:opacity-50 transition-all cursor-pointer rounded-none"
            title="Next Recipe"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Dots Indicator bars */}
      {products.length > 1 && (
        <div className="absolute top-4 left-4 sm:left-8 md:left-12 flex space-x-1.5 z-10">
          {products.map((_, idx) => (
            <button
              key={idx}
              onClick={() => goToSlide(idx)}
              disabled={isTransitioning}
              className={`h-1.5 transition-all duration-300 ${
                idx === currentIndex 
                  ? 'w-6 bg-turmeric border border-cardboard' 
                  : 'w-2 bg-paper bg-opacity-70 border border-cardboard border-opacity-50 hover:bg-opacity-90'
              } rounded-none cursor-pointer`}
              title={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
