import { Filter, GlProgram } from 'pixi.js'

export interface VignetteFilterOptions {
  radius?: number
  softness?: number
  opacity?: number
}

/**
 * Vignette Filter - darkens edges of the screen
 */
export class VignetteFilter extends Filter {
  constructor(options: VignetteFilterOptions = {}) {
    // Vertex shader - PixiJS v8 uses 'in' and 'out' instead of 'attribute' and 'varying'
    const vertex = `
      in vec2 aPosition;
      out vec2 vTextureCoord;

      uniform vec4 uInputSize;
      uniform vec4 uOutputFrame;
      uniform vec4 uOutputTexture;

      vec4 filterVertexPosition(void) {
        vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
        position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
        position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
        return vec4(position, 0.0, 1.0);
      }

      vec2 filterTextureCoord(void) {
        return aPosition * (uOutputFrame.zw * uInputSize.zw);
      }

      void main(void) {
        gl_Position = filterVertexPosition();
        vTextureCoord = filterTextureCoord();
      }
    `

    // Fragment shader
    const fragment = `
      in vec2 vTextureCoord;
      
      uniform sampler2D uTexture;
      uniform float uRadius;
      uniform float uSoftness;
      uniform float uOpacity;

      void main(void) {
        vec4 color = texture2D(uTexture, vTextureCoord);
        
        vec2 uv = vTextureCoord;
        vec2 center = vec2(0.5, 0.5);
        float dist = distance(uv, center);
        
        float vignette = smoothstep(uRadius, uRadius - uSoftness, dist);
        vec3 darkened = color.rgb * vignette;
        vec3 finalColor = mix(color.rgb, darkened, uOpacity);

        gl_FragColor = vec4(finalColor, color.a);
      }
    `

    super({
      glProgram: new GlProgram({
        vertex,
        fragment,
        name: 'vignette-filter'
      }),
      resources: {
        vignetteUniforms: {
          uRadius: { value: options.radius ?? 0.5, type: 'f32' },
          uSoftness: { value: options.softness ?? 0.3, type: 'f32' },
          uOpacity: { value: options.opacity ?? 0.7, type: 'f32' }
        }
      }
    })
  }

  get radius(): number {
    return (this.resources as any).vignetteUniforms.uniforms.uRadius
  }
  set radius(value: number) {
    (this.resources as any).vignetteUniforms.uniforms.uRadius = value
  }

  get softness(): number {
    return (this.resources as any).vignetteUniforms.uniforms.uSoftness
  }
  set softness(value: number) {
    (this.resources as any).vignetteUniforms.uniforms.uSoftness = value
  }

  get opacity(): number {
    return (this.resources as any).vignetteUniforms.uniforms.uOpacity
  }
  set opacity(value: number) {
    (this.resources as any).vignetteUniforms.uniforms.uOpacity = value
  }
}
