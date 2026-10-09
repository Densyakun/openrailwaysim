// ポストプロセッシング（ブルーム） (#25)
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useSnapshot } from 'valtio';
import { EffectComposer, RenderPass, UnrealBloomPass } from 'three-stdlib';
import { clientState } from '@/lib/client/client';

export default function PostProcessing() {
  const { gl, scene, camera, size } = useThree();
  const { bloomStrength, bloomRadius, bloomThreshold } = useSnapshot(clientState);

  const composer = useMemo(() => {
    const effectComposer = new EffectComposer(gl);
    effectComposer.addPass(new RenderPass(scene, camera));

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.width, size.height),
      bloomStrength,
      bloomRadius,
      bloomThreshold,
    );
    effectComposer.addPass(bloomPass);
    return effectComposer;
  }, [gl, scene, camera]); // eslint-disable-line react-hooks/exhaustive-deps

  // パラメータの変更を反映する
  useEffect(() => {
    const bloomPass = composer.passes.find(pass => pass instanceof UnrealBloomPass) as UnrealBloomPass | undefined;
    if (bloomPass) {
      bloomPass.strength = bloomStrength;
      bloomPass.radius = bloomRadius;
      bloomPass.threshold = bloomThreshold;
    }
  }, [composer, bloomStrength, bloomRadius, bloomThreshold]);

  useEffect(() => {
    composer.setSize(size.width, size.height);
  }, [composer, size.width, size.height]);

  useEffect(() => () => composer.dispose(), [composer]);

  // priority > 0 でR3Fの自動レンダリングを無効化し、composerで描画する
  useFrame(() => {
    composer.render();
  }, 1);

  return null;
}
