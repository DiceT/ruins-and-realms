import { Filter, GlProgram, Texture } from 'pixi.js'

/**
 * Custom Divide Blend Filter
 *
 * Implements the "Divide" blend mode from Affinity Photo:
 * result = base / blend
 */
export class DivideBlendFilter extends Filter {
  constructor(blendTexture: Texture) {
    // Vertex shader
    const vertex = `
      attribute vec2 aPosition;
      varying vec2 vTextureCoord;
      varying vec2 vBlendCoord;

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
        // Calculate 0-1 UV for blend texture based on aPosition
        vBlendCoord = aPosition;
      }
    `

    // Fragment shader
    const fragment = `
      precision mediump float;
      
      varying vec2 vTextureCoord;
      varying vec2 vBlendCoord;

      uniform sampler2D uTexture;
      uniform sampler2D uBlendTexture;

      void main(void) {
        vec4 base = texture2D(uTexture, vTextureCoord);
        
        // Use vBlendCoord which is 0-1 range based on quad position
        vec4 blend = texture2D(uBlendTexture, vBlendCoord);
        
        vec3 result = min(base.rgb / max(blend.rgb, 0.001), 1.0);
        
        gl_FragColor = vec4(result, base.a);
      }
    `

    const glProgram = new GlProgram({
      vertex,
      fragment,
      name: 'divide-blend-filter'
    })

    super({
      glProgram,
      resources: {
        uBlendTexture: blendTexture.source
      }
    })
  }
}
