import { extend, useLoader } from "@react-three/fiber";
import { shaderMaterial } from "@react-three/drei";
import { Texture, TextureLoader } from "three";

const SlopeBlendMaterial = shaderMaterial(
  {
    tFlat: null,
    tSlope: null,
  },
  `
  varying vec2 vUv;
  varying vec3 vNormal;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
  `,
  `
  uniform sampler2D tFlat;
  uniform sampler2D tSlope;

  varying vec2 vUv;
  varying vec3 vNormal;

  void main() {
    vec4 flatTex = texture2D(tFlat, vUv * 10.0);
    vec4 slopeTex = texture2D(tSlope, vUv * 10.0);

    float slope = acos(clamp(dot(vec3(0.0, 1.0, 0.0), vNormal), -1.0, 1.0));
    float blend = smoothstep(0.0, 0.8, slope / 1.5);

    gl_FragColor = mix(flatTex, slopeTex, blend);
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
  const [flatTexture, slopeTexture] = useLoader(TextureLoader, [
    "/grass.jpg",
    "/rock.jpg",
  ]);

  return <slopeBlendMaterial tFlat={flatTexture} tSlope={slopeTexture} />;
}
