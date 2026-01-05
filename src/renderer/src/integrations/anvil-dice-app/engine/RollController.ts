import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { DiceForge } from './DiceForge'
import { PhysicsWorld } from './core/PhysicsWorld'
import { DiceParser } from './DiceParser'
import type {
  DiceTheme,
  PhysicsSettings,
  RollResult,
  DiceRollRequest,
  DiePositionRequest
} from './types'
import { DEFAULT_THEME, DEFAULT_PHYSICS } from './types'

interface ActiveDie {
  mesh: THREE.Mesh
  body: CANNON.Body
  stopped: boolean
  result: string | number | null
  groupId: number // Index in ParseResult.groups OR Request Index
  type: string // 'd6', 'd100', 'd%_tens', 'd%_ones'
  rollId: number // Unique ID for this specific die spawn
  isRepositioning?: boolean // If true, physics updates are skipped for position
  targetPosition?: THREE.Vector3
  targetQuaternion?: THREE.Quaternion
}

export class RollController {
  private diceForge: DiceForge
  private physicsWorld: PhysicsWorld
  private scene: THREE.Scene

  private activeDice: ActiveDie[] = []
  private bounds = { width: 44, depth: 28 }

  // Settings
  private currentTheme: DiceTheme = DEFAULT_THEME
  private currentPhysics: PhysicsSettings = DEFAULT_PHYSICS

  // Callback for results
  public onRollComplete: ((result: RollResult) => void) | null = null

  private isRolling = false
  private currentModifier = 0
  private currentNotation = ''
  // We might have multiple parsers now if using requests

  private spawnOrigin: 'right' | 'bottom' = 'bottom'
  private nextRollId = 1

  constructor(physicsWorld: PhysicsWorld, scene: THREE.Scene) {
    this.physicsWorld = physicsWorld
    this.scene = scene
    this.diceForge = new DiceForge()
  }

  public updateTheme(theme: DiceTheme) {
    this.currentTheme = theme
  }

  public updatePhysics(physics: PhysicsSettings) {
    this.currentPhysics = physics
  }

  public setBounds(width: number, depth: number) {
    this.bounds = { width, depth }
  }

  public setSpawnOrigin(origin: 'right' | 'bottom') {
    this.spawnOrigin = origin
  }

  public roll(request: string | DiceRollRequest[]) {
    this.clear()
    this.isRolling = true

    let requests: DiceRollRequest[] = []

    if (typeof request === 'string') {
      this.currentNotation = request
      requests.push({ notation: request, theme: this.currentTheme })
    } else {
      requests = request
      this.currentNotation = requests.map((r) => r.notation).join(' + ')
    }

    // Spawn Dice for each request
    let totalModifier = 0
    let globalGroupId = 0

    requests.forEach((req) => {
      const themeToUse = req.theme ? { ...this.currentTheme, ...req.theme } : this.currentTheme
      const parsed = DiceParser.parse(req.notation)
      totalModifier += parsed.modifier

      // Spawn Dice
      parsed.groups.forEach((group) => {
        const count = Math.abs(group.count)

        // Prepare Secondary Theme for Ones digits
        const secondaryTheme: DiceTheme = {
          ...themeToUse,
          diceColor: themeToUse.diceColorSecondary || themeToUse.diceColor,
          labelColor: themeToUse.labelColorSecondary || themeToUse.labelColor,
          outlineColor: themeToUse.outlineColorSecondary || themeToUse.outlineColor
        }

        for (let i = 0; i < count; i++) {
          const rollId = this.nextRollId++

          if (group.type === 'd%') {
            this.spawnDie('d100', rollId, globalGroupId, 'd%_tens', themeToUse)
            this.spawnDie('d10', this.nextRollId++, globalGroupId, 'd%_ones', secondaryTheme)
          } else if (group.type === 'd66') {
            this.spawnDie('d60', rollId, globalGroupId, 'd66_tens', themeToUse)
            this.spawnDie('d6', this.nextRollId++, globalGroupId, 'd66_ones', secondaryTheme)
          } else if (group.type === 'd88') {
            // Use 'd8' for the tens die instead of 'd80' for better consistency/rotation
            this.spawnDie('d8', rollId, globalGroupId, 'd88_tens', themeToUse)
            this.spawnDie('d8', this.nextRollId++, globalGroupId, 'd88_ones', secondaryTheme)
          } else {
            // 2d6/2d8 Logic: Usage of Secondary Theme on second die
            let dieTheme = themeToUse
            if ((group.type === 'd6' || group.type === 'd8') && count === 2 && i === 1) {
              dieTheme = secondaryTheme
            }
            this.spawnDie(group.type, rollId, globalGroupId, group.type, dieTheme)
          }
        }
        globalGroupId++
      })
    })

    this.currentModifier = totalModifier

    // If no dice were spawned (e.g. only modifiers or empty), finish immediately
    if (this.activeDice.length === 0) {
      this.isRolling = false
      this.finishRoll()
    }
  }

  public clear() {
    this.activeDice.forEach((die) => {
      this.scene.remove(die.mesh)
      this.physicsWorld.removeBody(die.body)
      // Dispose geometry/material not needed as Forge handles caching, but clean up references?
    })
    this.activeDice = []
    this.isRolling = false
    this.currentModifier = 0
    this.currentNotation = ''
  }

  public async repositionDice(targets: DiePositionRequest[], duration: number = 500) {
    // 1. Identify Dice
    // 2. Disable Physics (set kinematic or just stop updating visually and force body to match?)
    // Better: Set Body to Kinematic (mass 0) so it stops reacting to world, then we tween it.
    // Actually, RollController.update copies Body -> Mesh.
    // If we set 'isRepositioning' flag, we can skip that sync and do our own animation.

    const startTime = performance.now()
    const animations: {
      die: ActiveDie
      startPos: THREE.Vector3
      startQuat: THREE.Quaternion
      endPos: THREE.Vector3
      endQuat: THREE.Quaternion
    }[] = []

    targets.forEach((t) => {
      const die = this.activeDice.find((d) => d.rollId === t.id)
      if (die) {
        die.isRepositioning = true
        die.body.type = CANNON.Body.KINEMATIC // Stop physics
        die.body.velocity.set(0, 0, 0)
        die.body.angularVelocity.set(0, 0, 0)
        die.stopped = true // Ensure logic knows it is stopped

        const endQuat = t.rotation
          ? new THREE.Quaternion(t.rotation.x, t.rotation.y, t.rotation.z, t.rotation.w)
          : die.mesh.quaternion.clone() // Keep current if not provided

        animations.push({
          die,
          startPos: die.mesh.position.clone(),
          startQuat: die.mesh.quaternion.clone(),
          endPos: new THREE.Vector3(t.position.x, t.position.y, t.position.z),
          endQuat: endQuat
        })
      }
    })

    // Simple animation loop wrapper
    return new Promise<void>((resolve) => {
      const animate = () => {
        const now = performance.now()
        const progress = Math.min((now - startTime) / duration, 1.0)

        // Easing (EaseOutCubic)
        const t = 1 - Math.pow(1 - progress, 3)

        animations.forEach((anim) => {
          anim.die.mesh.position.lerpVectors(anim.startPos, anim.endPos, t)
          anim.die.mesh.quaternion.copy(anim.startQuat).slerp(anim.endQuat, t)

          // Sync body just in case (though Kinematic)
          anim.die.body.position.set(
            anim.die.mesh.position.x,
            anim.die.mesh.position.y,
            anim.die.mesh.position.z
          )
          anim.die.body.quaternion.set(
            anim.die.mesh.quaternion.x,
            anim.die.mesh.quaternion.y,
            anim.die.mesh.quaternion.z,
            anim.die.mesh.quaternion.w
          )
        })

        if (progress < 1.0) {
          requestAnimationFrame(animate)
        } else {
          resolve()
        }
      }
      animate()
    })
  }

  public update(time: number) {
    // Always update dice that are rolling
    // Settle check


    let allStopped = true

    // Liquid Core Fix: Modulo time to preserve float precision for shader noise
    const shaderTime = time % 10000.0

    this.activeDice.forEach((die) => {
      // Animate Liquid Core
      if (die.mesh.userData.isLiquid && die.mesh.userData.liquidMesh) {
        const mesh = die.mesh.userData.liquidMesh as THREE.Mesh
        const mat = mesh.material as THREE.ShaderMaterial
        if (mat.uniforms && mat.uniforms.time) {
          mat.uniforms.time.value = shaderTime
        }
      }

      if (die.isRepositioning) return // Skip physics sync for manual movers

      // Sync Physics -> Visuals
      die.mesh.position.copy(die.body.position as any)
      die.mesh.quaternion.copy(die.body.quaternion as any)

      // Bounds check (respawn if fallen far)
      if (die.body.position.y < -20) {
        die.body.position.set(0, 10, 0)
        die.body.velocity.set(0, 0, 0)
      }

      if (!die.stopped && this.isRolling) {
        const v = die.body.velocity.lengthSquared()
        const w = die.body.angularVelocity.lengthSquared()

        if (v < 0.01 && w < 0.01) {
          die.stopped = true
          die.result = this.getDieValue(die)

        } else {
          allStopped = false
        }
      }
    })

    if (allStopped && this.isRolling && this.activeDice.length > 0) {
      this.isRolling = false

      this.finishRoll()
    }
  }

  private finishRoll() {
    const breakdown: { type: string; value: number; dropped?: boolean }[] = []
    let total = 0
    const diceResults: { id: number; groupId: number; value: number; type: string }[] = []

    // Group dice by groupId
    const groups = new Map<number, ActiveDie[]>()
    this.activeDice.forEach((d) => {
      if (!groups.has(d.groupId)) groups.set(d.groupId, [])
      groups.get(d.groupId)!.push(d)

      // Collect individual results too
      let val = parseInt(String(d.result))
      if (d.type === 'd10' && String(d.result) === '0') val = 10
      if (d.type === 'd100' && String(d.result) === '00') val = 0
      if (isNaN(val)) val = 0

      diceResults.push({
        id: d.rollId,
        groupId: d.groupId,
        value: val,
        type: d.type
      })
    })

    groups.forEach((dice, _) => {
      const firstType = dice[0]?.type || ''

      if (firstType.startsWith('d%')) {
        dice.sort((a, b) => a.rollId - b.rollId)
        for (let i = 0; i < dice.length; i += 2) {
          const tenDie = dice[i]
          const oneDie = dice[i + 1]
          if (tenDie && oneDie) {
            const tensStr = String(tenDie.result)
            const onesStr = String(oneDie.result)
            let tens = parseInt(tensStr.replace('00', '0'))
            let ones = parseInt(onesStr)
            if (isNaN(tens)) tens = 0
            if (isNaN(ones)) ones = 0
            let val = tens + ones
            if (val === 0 && tensStr === '00' && onesStr === '0') val = 100

            total += val
            breakdown.push({ type: 'd%', value: val })
          }
        }
      } else if (firstType.startsWith('d66')) {
        dice.sort((a, b) => a.rollId - b.rollId)
        for (let i = 0; i < dice.length; i += 2) {
          const tenDie = dice[i]
          const oneDie = dice[i + 1]
          if (tenDie && oneDie) {
            const tens = parseInt(String(tenDie.result)) || 10
            const ones = parseInt(String(oneDie.result)) || 1
            const val = tens + ones
            total += val
            breakdown.push({ type: 'd66', value: val })
          }
        }
      } else if (firstType.startsWith('d88')) {
        dice.sort((a, b) => a.rollId - b.rollId)
        for (let i = 0; i < dice.length; i += 2) {
          const tenDie = dice[i]
          const oneDie = dice[i + 1]
          if (tenDie && oneDie) {
            // Tens die is now a d8, so result is 1-8. We need to multiply by 10.
            const tensRaw = parseInt(String(tenDie.result)) || 1
            const tens = tensRaw * 10
            const ones = parseInt(String(oneDie.result)) || 1
            const val = tens + ones
            total += val
            breakdown.push({ type: 'd88', value: val })
          }
        }
      } else {
        // Standard Dice
        // Simple Sum for now as we don't have individual group configs easily available due to array of requests.
        // Assuming standard sum unless we re-parse.
        // For simplicity in this Multi-Theme update, we support Sum. Keep/Drop logic needs per-request parser storage.

        dice.forEach((d) => {
          let val = parseInt(String(d.result))
          if (d.type === 'd10' && String(d.result) === '0') val = 10
          if (isNaN(val)) val = 0
          total += val
          breakdown.push({ type: d.type, value: val })
        })
      }
    })

    total += this.currentModifier

    const result: RollResult = {
      total: total,
      notation: this.currentNotation,
      breakdown: breakdown,
      modifier: this.currentModifier,
      dice: diceResults
    }

    if (this.onRollComplete) {
      this.onRollComplete(result)
    }

    // Always tidy up dice into the tray
    this.arrangeDiceInTray()
  }

  private arrangeDiceInTray() {
    const diceCount = this.activeDice.length
    if (diceCount === 0) return

    // Tray Configuration (Right Panel, Bottom Area)
    const trayCenter = new THREE.Vector3(0, 1.0, -11.15) // Z=-11.15 based on previous 2d8 logic
    const spacing = 3.5 // Space between dice

    const sortedDice = [...this.activeDice].sort((a, b) => a.rollId - b.rollId)

    const targets: DiePositionRequest[] = []

    if (diceCount === 1) {
      // Center single die
      targets.push({
        id: sortedDice[0].rollId,
        position: trayCenter,
        rotation: this.getOptimalRotation(sortedDice[0])
      })
    } else if (diceCount === 2) {
      // Side by side
      targets.push({
        id: sortedDice[0].rollId,
        position: new THREE.Vector3(trayCenter.x - spacing / 2, trayCenter.y, trayCenter.z),
        rotation: this.getOptimalRotation(sortedDice[0])
      })
      targets.push({
        id: sortedDice[1].rollId,
        position: new THREE.Vector3(trayCenter.x + spacing / 2, trayCenter.y, trayCenter.z),
        rotation: this.getOptimalRotation(sortedDice[1])
      })
    } else {
      // 3+ Dice: Grid or Line?
      // Let's do a simple line for now, centering them.
      // Check width available.
      // If too many, maybe 2 rows.
      const totalWidth = (diceCount - 1) * spacing
      const startX = trayCenter.x - totalWidth / 2

      sortedDice.forEach((die, index) => {
        targets.push({
          id: die.rollId,
          position: new THREE.Vector3(startX + index * spacing, trayCenter.y, trayCenter.z),
          rotation: this.getOptimalRotation(die)
        })
      })
    }

    this.repositionDice(targets, 800)
  }

  private getOptimalRotation(die: ActiveDie): THREE.Quaternion {
    const mesh = die.mesh
    const faceValues = mesh.userData.faceValues

    if (!faceValues || faceValues.length === 0) {
      return new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0))
    }

    const result = die.result
    let targetFace: any = null
    const isD4 = Array.isArray(faceValues[0].value)

    if (isD4) {
      // D4 Logic
      targetFace = faceValues.find((fv: any) => !(fv.value as string[]).includes(String(result)))

      if (targetFace) {
        const localNormal = targetFace.normal
        const targetUp = new THREE.Vector3(0, -1, 0) // Down
        return new THREE.Quaternion().setFromUnitVectors(localNormal, targetUp)
      }
    } else {
      // Standard Dice
      targetFace = faceValues.find((fv: any) => String(fv.value) === String(result))

      if (targetFace) {
        const localNormal = targetFace.normal
        const targetUp = new THREE.Vector3(0, 1, 0) // World Up
        const q = new THREE.Quaternion().setFromUnitVectors(localNormal, targetUp)

        // Fix D8 Orientation Twist
        // Applies to 'd8' and 'd88_ones' (which are effectively d8s)
        // Also 'd80' (d88_tens) might likely share the D8 geometry if it is octahedral.
        // Assuming d80 uses same UV/face orientation logic as d8.
        const isD8Shape =
          die.type === 'd8' ||
          die.type === 'd88_ones' ||
          die.type === 'd88_tens' ||
          die.type.startsWith('d8')

        if (isD8Shape) {
          let angleDeg = 0
          // d80 would have values like 10, 20... handle string matching safely
          // d80 would have values like 10, 20... handle string matching safely
          // val was unused: String(die.result).replace('0', '')
          // Wait, d80 faces: if result is '10', logic above found face with value '10'.
          // If d8 twist logic is based on Face Index (geometry), we need to map Value -> Geometry Face -> Twist.
          // The switch case below is Value -> Twist.
          // If d80 layout matches d8 (face 10 is where face 1 is), then map 10->1, 20->2 works.

          const lookupVal =
            (die.type === 'd88_tens' || die.type === 'd80') && die.result
              ? String(die.result).replace(/0$/, '')
              : String(die.result)

          switch (lookupVal) {
            case '1':
              angleDeg = 315
              break
            case '2':
              angleDeg = 135
              break
            case '3':
              angleDeg = 225
              break
            case '4':
              angleDeg = 45
              break
            case '5':
              angleDeg = 45
              break
            case '6':
              angleDeg = 225
              break
            case '7':
              angleDeg = 135
              break
            case '8':
              angleDeg = 315
              break
            default:
              angleDeg = 0
              break
          }

          if (angleDeg !== 0) {
            const twist = new THREE.Quaternion().setFromAxisAngle(
              new THREE.Vector3(0, 1, 0),
              angleDeg * (Math.PI / 180)
            )
            q.premultiply(twist)
          }
        }

        return q
      }
    }

    return new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0))
  }

  private getDieValue(die: ActiveDie): string | number {
    const mesh = die.mesh
    const faceValues = mesh.userData.faceValues
    if (!faceValues || faceValues.length === 0) return '?'

    const worldUp = new THREE.Vector3(0, 1, 0)
    const quaternion = mesh.quaternion.clone().invert()
    const localUp = worldUp.applyQuaternion(quaternion)

    const isD4 = Array.isArray(faceValues[0].value)
    if (isD4) {
      const localDown = localUp.clone().negate()
      let closestFace: any = null
      let maxDot = -Infinity
      for (const fv of faceValues) {
        const dot = localDown.dot(fv.normal)
        if (dot > maxDot) {
          maxDot = dot
          closestFace = fv
        }
      }
      if (!closestFace) return '?'
      const present = (closestFace as any).value as string[]
      const all = ['1', '2', '3', '4']
      const result = all.find((n) => !present.includes(n))
      return result || '?'
    } else {
      let closestFace: any = null
      let maxDot = -Infinity
      for (const fv of faceValues) {
        const dot = localUp.dot(fv.normal)
        if (dot > maxDot) {
          maxDot = dot
          closestFace = fv
        }
      }
      return closestFace ? closestFace.value : '?'
    }
  }

  private spawnDie(
    type: string,
    rollId: number,
    groupId: number,
    subType: string,
    theme: DiceTheme
  ) {
    try {
      let meshType = type
      if (subType === 'd%_tens') meshType = 'd100'
      if (subType === 'd%_ones') meshType = 'd10'

      const mesh = this.diceForge.createdice(meshType, theme)

      // Spawn Position logic
      let x = 0,
        y = 0,
        z = 0
      let vx = 0,
        vy = 0,
        vz = 0
      const throwForce = (this.currentPhysics.throwForce || 40) + Math.random() * 5

      if (this.spawnOrigin === 'bottom') {
        const wallZ = this.bounds.depth / 2
        const spawnZ = wallZ - 1
        const safeX = this.bounds.width / 2 - 4
        const spread = safeX > 0 ? safeX * 2 : 5

        x = (Math.random() - 0.5) * spread
        y = 5 + Math.random() * 2
        z = spawnZ + Math.random() * 2

        vx = (Math.random() - 0.5) * 5
        vy = 0
        vz = -throwForce
      } else {
        const wallX = this.bounds.width / 2
        const spawnX = wallX - 1
        const safeZ = this.bounds.depth / 2 - 3
        const spread = safeZ > 0 ? safeZ * 2 : 2

        x = spawnX + (Math.random() - 0.5) * 1
        y = 2 + Math.random() * 1
        z = (Math.random() - 0.5) * spread

        vx = -throwForce
        vy = 0
        vz = (Math.random() - 0.5) * 2
      }

      mesh.position.set(x, y, z)
      mesh.castShadow = true

      let bodyShape: CANNON.Shape | null = null
      if ((mesh as any).body_shape) {
        bodyShape = (mesh as any).body_shape
      } else {
        bodyShape = new CANNON.Box(new CANNON.Vec3(1, 1, 1))
      }

      const body = new CANNON.Body({
        mass: 1,
        shape: bodyShape!,
        position: new CANNON.Vec3(x, y, z),
        material: this.physicsWorld.diceMaterial
      })

      body.quaternion.setFromEuler(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      )

      body.velocity.set(vx, vy, vz)
      body.angularVelocity.set(
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 20
      )

      this.scene.add(mesh)
      this.physicsWorld.addBody(body)

      this.activeDice.push({
        mesh,
        body,
        stopped: false,
        result: null,
        groupId: groupId,
        type: subType,
        rollId: rollId,
        isRepositioning: false
      })
    } catch (e) {
      console.error(`Failed to spawn die: ${type}`, e)
    }
  }
}
