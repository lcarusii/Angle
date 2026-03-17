import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

interface CameraVisualizerProps {
  horizontalAngle: number;
  verticalAngle: number;
  zoom: number;
  onUpdate: (h: number, v: number, z: number) => void;
  imageUrl?: string | null;
}

export const CameraVisualizer: React.FC<CameraVisualizerProps> = ({
  horizontalAngle,
  verticalAngle,
  zoom,
  onUpdate,
  imageUrl,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const objectsRef = useRef<{
    cameraIcon: THREE.Group;
    hTrack: THREE.Mesh;
    vTrack: THREE.Mesh;
    hHandle: THREE.Mesh;
    vHandle: THREE.Mesh;
    plane: THREE.Mesh;
    connectionLine: THREE.Line;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight || 1, 0.1, 1000);
    camera.position.set(15, 2, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Orbit Controls
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.05;
    orbit.minDistance = 5;
    orbit.maxDistance = 30;
    orbit.maxPolarAngle = Math.PI / 1.5;
    orbit.target.set(0, 2, 0);
    controlsRef.current = orbit;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(0xffffff, 1.2);
    pointLight.position.set(10, 15, 10);
    scene.add(pointLight);

    // Grid
    const grid = new THREE.GridHelper(15, 30, 0x444444, 0x222222);
    scene.add(grid);

    // Subject Plane
    const planeGeo = new THREE.PlaneGeometry(3, 4);
    const planeMat = new THREE.MeshPhongMaterial({ 
      color: 0x333333, 
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 1.0,
      emissive: 0x000000
    });
    const plane = new THREE.Mesh(planeGeo, planeMat);
    // Stand vertically on the ground (y=2 is center of 4-unit high plane)
    plane.position.y = 2;
    // Face the positive X axis
    plane.rotation.y = Math.PI / 2;
    scene.add(plane);

    // Tracks
    const hTrackGeo = new THREE.TorusGeometry(7, 0.04, 16, 100);
    const hTrackMat = new THREE.MeshBasicMaterial({ color: 0xff0066, transparent: true, opacity: 0.4 });
    const hTrack = new THREE.Mesh(hTrackGeo, hTrackMat);
    hTrack.rotation.x = Math.PI / 2;
    hTrack.position.y = 2;
    scene.add(hTrack);

    const vTrackGeo = new THREE.TorusGeometry(7, 0.04, 16, 100, Math.PI);
    const vTrackMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.4 });
    const vTrack = new THREE.Mesh(vTrackGeo, vTrackMat);
    vTrack.rotation.z = -Math.PI / 2; // Start from bottom to top
    vTrack.position.y = 2;
    scene.add(vTrack);

    // Handles
    const handleGeo = new THREE.SphereGeometry(0.3, 16, 16);
    const hHandle = new THREE.Mesh(handleGeo, new THREE.MeshBasicMaterial({ color: 0xff0066 }));
    const vHandle = new THREE.Mesh(handleGeo, new THREE.MeshBasicMaterial({ color: 0x00ffcc }));
    scene.add(hHandle);
    scene.add(vHandle);

    // Camera Icon - More realistic look
    const camIcon = new THREE.Group();
    
    // Main body
    const bodyGeo = new THREE.BoxGeometry(0.8, 0.5, 0.4);
    const bodyMat = new THREE.MeshPhongMaterial({ color: 0xcccccc });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    camIcon.add(body);

    // Top part (viewfinder/hotshoe area)
    const topGeo = new THREE.BoxGeometry(0.3, 0.15, 0.3);
    const top = new THREE.Mesh(topGeo, bodyMat);
    top.position.y = 0.3;
    camIcon.add(top);

    // Lens
    const lensGroup = new THREE.Group();
    const lensMainGeo = new THREE.CylinderGeometry(0.2, 0.22, 0.4, 16);
    const lensMat = new THREE.MeshPhongMaterial({ color: 0xaaaaaa });
    const lensMain = new THREE.Mesh(lensMainGeo, lensMat);
    lensMain.rotation.x = Math.PI / 2;
    lensMain.position.z = 0.35;
    lensGroup.add(lensMain);

    // Lens glass effect
    const glassGeo = new THREE.CircleGeometry(0.16, 16);
    const glassMat = new THREE.MeshPhongMaterial({ 
      color: 0x2244ff, 
      emissive: 0x112244,
      shininess: 100,
      transparent: true,
      opacity: 0.6
    });
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.position.z = 0.56;
    lensGroup.add(glass);
    
    camIcon.add(lensGroup);
    scene.add(camIcon);

    // Connection Line
    const lineMat = new THREE.LineBasicMaterial({ 
      color: 0xffffff, 
      transparent: true, 
      opacity: 0.3,
    });
    const linePoints = [new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, 2, 0)];
    const lineGeo = new THREE.BufferGeometry().setFromPoints(linePoints);
    const connectionLine = new THREE.Line(lineGeo, lineMat);
    scene.add(connectionLine);

    objectsRef.current = { cameraIcon: camIcon, hTrack, vTrack, hHandle, vHandle, plane, connectionLine };

    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        if (rendererRef.current && cameraRef.current) {
          rendererRef.current.setSize(width, height);
          cameraRef.current.aspect = width / height;
          cameraRef.current.updateProjectionMatrix();
        }
      }
    });
    resizeObserver.observe(container);

    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      if (controlsRef.current) controlsRef.current.update();
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
      renderer.dispose();
      orbit.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  useEffect(() => {
    if (!objectsRef.current) return;
    const { cameraIcon, hHandle, vHandle, vTrack, plane, connectionLine } = objectsRef.current;

    // Update Image Texture
    if (imageUrl) {
      const loader = new THREE.TextureLoader();
      loader.load(imageUrl, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        (plane.material as THREE.MeshPhongMaterial).map = texture;
        (plane.material as THREE.MeshPhongMaterial).color.setHex(0xffffff);
        plane.material.needsUpdate = true;
      });
    } else {
      (plane.material as THREE.MeshPhongMaterial).map = null;
      (plane.material as THREE.MeshPhongMaterial).color.setHex(0x333333);
      plane.material.needsUpdate = true;
    }

    const hRad = ((-horizontalAngle + 180) * Math.PI) / 180;
    const vRad = ((verticalAngle - 90) * Math.PI) / 180;
    const dist = zoom;

    const x = dist * Math.cos(vRad) * Math.cos(hRad);
    const y = dist * Math.sin(vRad) + 2;
    const z = dist * Math.cos(vRad) * Math.sin(hRad);

    cameraIcon.position.set(x, y, z);
    cameraIcon.lookAt(0, 2, 0);

    // Update connection line
    const positions = new Float32Array([
      0, 2, 0, // Target
      x, y, z  // Camera
    ]);
    connectionLine.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    connectionLine.geometry.attributes.position.needsUpdate = true;

    // Horizontal handle stays on the horizontal track at y=2
    hHandle.position.set(7 * Math.cos(hRad), 2, 7 * Math.sin(hRad));
    
    // Vertical handle stays on the vertical track arc
    // The vertical track is centered at (0, 2, 0) and rotated by hRad around Y axis.
    // The handle position relative to the center (0, 2, 0) is (7*cos(vRad), 7*sin(vRad), 0)
    // Then we rotate this position around Y by hRad.
    const vHandleX = 7 * Math.cos(vRad) * Math.cos(hRad);
    const vHandleY = 7 * Math.sin(vRad) + 2;
    const vHandleZ = 7 * Math.cos(vRad) * Math.sin(hRad);
    vHandle.position.set(vHandleX, vHandleY, vHandleZ);
    
    // Rotate vertical track to match horizontal angle
    vTrack.rotation.y = -hRad;

  }, [horizontalAngle, verticalAngle, zoom, imageUrl]);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full min-h-[400px] bg-[#0a0a0a] rounded-xl overflow-hidden"
    />
  );
};
