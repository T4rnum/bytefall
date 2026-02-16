import * as THREE from 'three'

export function createSymbolMSDFMaterial(map: THREE.Texture, pxRange = 4): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      map: { value: map },
      pxRange: { value: pxRange },
      opacity: { value: 1.0 },
      useMSDF: { value: 0 }, // 0 = bitmap alpha, 1 = MSDF
      cutoff: { value: 0.5 }, // threshold for bitmap alpha/luma
    },
    vertexShader: `
      attribute vec2 instanceUvOffset;
      attribute vec2 instanceUvScale;
      attribute vec3 instanceTint;
      attribute float instanceAlpha;
      varying vec2 vUv;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vUv = uv * instanceUvScale + instanceUvOffset;
        vColor = instanceTint;
        vAlpha = instanceAlpha;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D map;
      uniform float pxRange;
      uniform float opacity;
      uniform int useMSDF;
      uniform float cutoff;
      varying vec2 vUv;
      varying vec3 vColor;
      varying float vAlpha;

      float median3(vec3 v) { return max(min(v.r, v.g), min(max(v.r, v.g), v.b)); }

      void main() {
        vec4 tex = texture2D(map, vUv);
        float alpha;
        if (useMSDF == 1) {
          float sd = median3(tex.rgb) - 0.5;
          float w = fwidth(sd);
          alpha = smoothstep(-w, w, sd);
        } else {
          alpha = tex.a;
          if (alpha == 0.0) {
            alpha = dot(tex.rgb, vec3(0.2126, 0.7152, 0.0722));
          }
          alpha = step(cutoff, alpha);
        }
        vec4 outColor = vec4(vColor, alpha * opacity * vAlpha);
        if (outColor.a < 0.01) discard;
        gl_FragColor = outColor;
      }
    `,
    transparent: true,
    depthTest: false,
    depthWrite: false
  })
  return material
}
