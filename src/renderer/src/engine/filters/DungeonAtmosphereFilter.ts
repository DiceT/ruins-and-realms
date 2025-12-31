import { Filter, GlProgram } from 'pixi.js'

export interface AtmosphereOptions {
  intensity?: number
  color?: [number, number, number]
}

/**
 * Dungeon Atmosphere Filter - adds animated fog/noise overlay
 */
export class DungeonAtmosphereFilter extends Filter {
  constructor(options: AtmosphereOptions = {}) {
    // Vertex shader - PixiJS v8 uses 'in' and 'out'
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
      uniform float uTime;
      uniform float uIntensity;
      uniform vec3 uColor;

      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), f.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }

      void main(void) {
        vec4 color = texture2D(uTexture, vTextureCoord);
        
        vec2 noiseCoord = vTextureCoord * 3.0;
        float n = noise(noiseCoord + vec2(uTime * 0.1, uTime * 0.05));
        float n2 = noise(noiseCoord * 2.0 - vec2(uTime * 0.02, uTime * 0.08));
        float finalNoise = (n + n2 * 0.5) / 1.5;
        
        vec3 atmosphere = uColor * finalNoise;
        vec3 finalColor = color.rgb + (atmosphere * uIntensity);
        
        gl_FragColor = vec4(finalColor, color.a);
      }
    `

    const colorVal = options.color ?? [0.1, 0.05, 0.2]

    super({
      glProgram: new GlProgram({
        vertex,
        fragment,
        name: 'dungeon-atmosphere-filter'
      }),
      resources: {
        atmosphereUniforms: {
          uTime: { value: 0.0, type: 'f32' },
          uIntensity: { value: options.intensity ?? 0.2, type: 'f32' },
          uColor: { value: new Float32Array(colorVal), type: 'vec3<f32>' }
        }
      }
    })
  }

  get time(): number {
    return (this.resources as any).atmosphereUniforms.uniforms.uTime
  }
  set time(value: number) {
    (this.resources as any).atmosphereUniforms.uniforms.uTime = value
  }

  get intensity(): number {
    return (this.resources as any).atmosphereUniforms.uniforms.uIntensity
  }
  set intensity(value: number) {
    (this.resources as any).atmosphereUniforms.uniforms.uIntensity = value
  }
}
