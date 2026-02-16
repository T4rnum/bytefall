import * as THREE from 'three'

export const SelectionFillShader = {
  vertexShader: `
    void main() {
      #ifdef USE_INSTANCING
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      #else
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      #endif
    }
  `,
  fragmentShader: `
    uniform vec3 uColor;
    uniform vec3 uSecondaryColor;
    uniform float uTime;
    uniform float uOpacity;
    
    void main() {
      // Diagonal stripes in screen space
      float size = 20.0;
      float speed = 40.0;
      float p = gl_FragCoord.x + gl_FragCoord.y + uTime * speed;
      float stripe = mod(p, size);
      
      if (stripe < size * 0.25) {
        gl_FragColor = vec4(uColor, uOpacity);
      } else {
        gl_FragColor = vec4(uSecondaryColor, uOpacity);
      }
    }
  `
}

export const SelectionBorderShader = {
  vertexShader: `
    void main() {
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 uColor;
    uniform float uTime;
    
    void main() {
      // Marching ants in screen space
      float size = 15.0;
      float speed = 30.0;
      float p = gl_FragCoord.x - gl_FragCoord.y + uTime * speed;
      float dash = mod(p, size);
      
      if (dash < size * 0.5) {
        gl_FragColor = vec4(uColor, 1.0);
      } else {
        discard; // Transparent gap
      }
    }
  `
}

export function createSelectionMaterials() {
  const fillMat = new THREE.ShaderMaterial({
    vertexShader: SelectionFillShader.vertexShader,
    fragmentShader: SelectionFillShader.fragmentShader,
    uniforms: {
      uColor: { value: new THREE.Color(0xffd54a) }, // Yellow
      uSecondaryColor: { value: new THREE.Color(0x333333) }, // Dark Grey
      uTime: { value: 0 },
      uOpacity: { value: 0.5 }
    },
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: false
  })

  const borderMat = new THREE.LineDashedMaterial({
    color: new THREE.Color(0xffd54a),
    dashSize: 0.6,
    gapSize: 0.4,
    transparent: true,
    opacity: 1.0
  })

  return { fillMat, borderMat }
}
