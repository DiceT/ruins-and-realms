import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

export class SceneManager {
  private scene: THREE.Scene
  private camera: THREE.OrthographicCamera
  private controls: OrbitControls
  private ambientLight: THREE.AmbientLight
  private directionalLight: THREE.DirectionalLight

  // Visible world units (controls zoom level - smaller = bigger dice)
  private viewHeight: number = 26

  constructor(domElement: HTMLElement) {
    this.scene = new THREE.Scene()

    // Get container dimensions
    const containerWidth = domElement.clientWidth || window.innerWidth
    const containerHeight = domElement.clientHeight || window.innerHeight
    const aspect = containerWidth / containerHeight

    // Setup Orthographic Camera (no perspective distortion)
    // viewHeight controls how much of the world is visible vertically
    const halfH = this.viewHeight / 2
    const halfW = halfH * aspect

    this.camera = new THREE.OrthographicCamera(
      -halfW,
      halfW, // left, right
      halfH,
      -halfH, // top, bottom (Y is flipped for top-down)
      0.1,
      1000 // near, far
    )
    this.camera.position.set(0, 50, 0) // Looking down
    this.camera.lookAt(0, 0, 0)

    // Setup Controls
    this.controls = new OrbitControls(this.camera, domElement)
    this.controls.enableDamping = true
    this.controls.enableRotate = false // Locked top-down
    this.controls.enableZoom = false // Locked zoom
    this.controls.enablePan = false // Locked pan

    // Setup Lights
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.7)
    this.scene.add(this.ambientLight)

    this.directionalLight = new THREE.DirectionalLight(0xffffff, 1.2)
    this.directionalLight.position.set(5, 50, 5) // Overhead light
    this.directionalLight.castShadow = true
    this.directionalLight.shadow.mapSize.width = 2048
    this.directionalLight.shadow.mapSize.height = 2048
    this.scene.add(this.directionalLight)

    // Fill Light to brighten shadows
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.5)
    fillLight.position.set(-5, 20, -5)
    this.scene.add(fillLight)

    // Setup Basic Tray (Floor + Walls)
    this.createTray()
  }

  private createTray() {
    // Floor - Transparent but receives shadows
    const floorGeo = new THREE.PlaneGeometry(100, 100)
    const floorMat = new THREE.ShadowMaterial({ opacity: 0.5 })
    const floor = new THREE.Mesh(floorGeo, floorMat)
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    this.scene.add(floor)

    // Debug Walls
    this.updateDebugBounds(44, 28)
  }

  private debugWalls: THREE.Mesh[] = []

  public updateDebugBounds(width: number, depth: number) {
    // Remove old walls
    this.debugWalls.forEach((wall) => {
      this.scene.remove(wall)
      if (wall.geometry) wall.geometry.dispose()
    })
    this.debugWalls = []

    const material = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      opacity: 0.3,
      transparent: true
    })

    const halfWidth = width / 2
    const halfDepth = depth / 2
    const thickness = 10
    const height = 20

    const offsetX = halfWidth + thickness / 2
    const offsetZ = halfDepth + thickness / 2

    // Geometries
    const topBotWidth = width + thickness * 2 + 20
    const horizWallGeo = new THREE.BoxGeometry(topBotWidth, height, thickness)

    const sideLen = depth + thickness * 2
    const vertWallGeo = new THREE.BoxGeometry(thickness, height, sideLen)

    // Top (-Z)
    const topWall = new THREE.Mesh(horizWallGeo, material)
    topWall.position.set(0, 0, -offsetZ)
    topWall.visible = false // Default Hidden
    this.scene.add(topWall)
    this.debugWalls.push(topWall)

    // Bottom (+Z)
    const botWall = new THREE.Mesh(horizWallGeo, material)
    botWall.position.set(0, 0, offsetZ)
    botWall.visible = false // Default Hidden
    this.scene.add(botWall)
    this.debugWalls.push(botWall)

    // Left (-X)
    const leftWall = new THREE.Mesh(vertWallGeo, material)
    leftWall.position.set(-offsetX, 0, 0)
    leftWall.visible = false // Default Hidden
    this.scene.add(leftWall)
    this.debugWalls.push(leftWall)

    // Right (+X)
    const rightWall = new THREE.Mesh(vertWallGeo, material)
    rightWall.position.set(offsetX, 0, 0)
    rightWall.visible = false // Default Hidden
    this.scene.add(rightWall)
    this.debugWalls.push(rightWall)
  }

  public getVisibleBounds() {
    // For orthographic camera, visible bounds are directly from frustum
    const halfH = (this.camera.top - this.camera.bottom) / 2
    const halfW = (this.camera.right - this.camera.left) / 2

    return { width: halfW * 2, depth: halfH * 2 }
  }

  public setDebugVisibility(visible: boolean) {
    this.debugWalls.forEach((wall) => {
      wall.visible = visible
    })
  }

  public getScene(): THREE.Scene {
    return this.scene
  }

  public getCamera(): THREE.OrthographicCamera {
    return this.camera
  }

  public updateCamera(width: number, height: number) {
    const aspect = width / height
    const halfH = this.viewHeight / 2
    const halfW = halfH * aspect

    this.camera.left = -halfW
    this.camera.right = halfW
    this.camera.top = halfH
    this.camera.bottom = -halfH

    this.camera.updateProjectionMatrix()
  }

  /**
   * Set the zoom level (how many world units are visible vertically)
   */
  public setViewHeight(newViewHeight: number) {
    this.viewHeight = newViewHeight
  }

  public getWorldPosition(ndcX: number, ndcY: number): THREE.Vector3 {
    // ndcX/Y are -1 to 1
    const vec = new THREE.Vector3(ndcX, ndcY, 0.5)
    vec.unproject(this.camera)
    // For Orthographic Top-Down (Y-up in world is Camera Z-back? No, Camera is at (0,50,0) looking at (0,0,0))
    // Camera Up is typically (0,1,0) but looking down -Y.
    // Let's assume standard top-down: Camera at (0, 50, 0), Up is (0,0,-1) maybe?
    // Regardless, unproject will give us a point on the ray.
    // Since it's ortho, X and Z (in world space, if Y is up) should be consistent.
    // Wait, SceneManager sets camera position (0, 50, 0) and lookAt(0,0,0).
    // This implies Y is UP in world space.
    return vec
  }
}
