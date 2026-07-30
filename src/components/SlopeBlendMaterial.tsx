import * as THREE from "three";
import { extend, useFrame, useLoader, useThree } from "@react-three/fiber";
import { shaderMaterial } from "@react-three/drei";
import { Texture, TextureLoader } from "three";
import { useRef } from "react";
import { lightingState } from "@/lib/client/lighting";

const SlopeBlendMaterial = shaderMaterial(
  {
    tFlat: null,
    tSlope: null,
    uLightDir: [0, 1, 0],
    uAmbientIntensity: 0,
    uDirectionalIntensity: 0,
  },
  `
  varying vec2 vUv;
  varying vec3 vNormal;

  void main() {
    vUv = uv;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
  `,
  `
  uniform sampler2D tFlat;
  uniform sampler2D tSlope;
  uniform vec3 uLightDir;
  uniform float uAmbientIntensity;
  uniform float uDirectionalIntensity;

  varying vec2 vUv;
  varying vec3 vNormal;

  void main() {
    float slope = acos(clamp(dot(vec3(0.0, 1.0, 0.0), vNormal), -1.0, 1.0));
    float blend = smoothstep(0.0, 0.8, slope / 1.5);

    vec4 flatTex = texture2D(tFlat, vUv * 16.0);
    vec4 slopeTex = texture2D(tSlope, vUv * 16.0);
    vec4 texColor = mix(flatTex, slopeTex, blend);

    float diffuse = max(dot(vNormal, uLightDir), 0.0);
    float lighting = uAmbientIntensity + uDirectionalIntensity * diffuse;

    vec3 lit = texColor.rgb * lighting;
    vec3 corrected = max(1.055 * pow(lit, vec3(1.0 / 2.4)) - 0.055, 0.0);
    gl_FragColor = vec4(corrected, texColor.a);
  }
  `
);

extend({ SlopeBlendMaterial });

declare module "@react-three/fiber" {
  interface ThreeElements {
    slopeBlendMaterial: JSX.IntrinsicElements["shaderMaterial"] & {
      tFlat?: Texture;
      tSlope?: Texture;
    };
  }
}

export default function SlopeBlendMaterialComponent() {
  const ref = useRef<any>(null);
  const { invalidate } = useThree();
  const [flatTexture, slopeTexture] = useLoader(TextureLoader, [
    "/grass.jpg",
    "/rock.jpg",
  ]);
  [flatTexture, slopeTexture].forEach(t => {
    if (t.wrapS !== THREE.RepeatWrapping) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 4;
      t.needsUpdate = true;
      invalidate();
    }
  });

  useFrame(() => {
    if (!ref.current) return;
    const y = Math.sin(lightingState.elevation);
    const sunPos = new THREE.Vector3(
      Math.sin(lightingState.azimuth) * Math.cos(lightingState.elevation),
      y,
      -Math.cos(lightingState.azimuth) * Math.cos(lightingState.elevation)
    ).normalize();
    ref.current.uLightDir = sunPos.toArray();
    ref.current.uAmbientIntensity = 0.15 + (y + 1) * 0.3;
    ref.current.uDirectionalIntensity = Math.max(0, Math.min(1, y * 6));
  });

  return <slopeBlendMaterial ref={ref} tFlat={flatTexture} tSlope={slopeTexture} />;
}
