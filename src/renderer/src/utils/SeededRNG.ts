
export class SeededRNG {
  private seed: number

  constructor(seed: string | number) {
    if (typeof seed === 'string') {
      this.seed = this.hashString(seed)
    } else {
      this.seed = seed
    }
  }

  // Simple string hash (MurmurHash3-ish or similar for v0)
  private hashString(str: string): number {
    let h = 1779033703 ^ str.length
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
      h = (h << 13) | (h >>> 19)
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507)
      h = Math.imul(h ^ (h >>> 13), 3266489909)
      return (h ^ (h >>> 16)) >>> 0
    }()
  }

  // Mulberry32
  public next(): number {
    let t = (this.seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  public nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min
  }

  public nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min
  }

  public oneIn(n: number): boolean {
    return this.nextInt(1, n) === 1
  }
}
