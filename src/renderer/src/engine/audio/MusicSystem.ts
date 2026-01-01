export class MusicSystemClass {
  private currentTrack: HTMLAudioElement | null = null
  private currentTrackId: string | null = null
  private musicVolume = 0
  private masterVolume = 1.0
  private isMuted = false
  private tracks: Map<string, string> = new Map() // ID -> URL
  private fadeInterval: NodeJS.Timeout | null = null

  // Defaults
  private FADE_DURATION = 2000 // ms

  constructor() {
    // Load volume from storage if available (later)
    this.musicVolume = 0
  }

  private playlist: string[] = []
  private playlistIndex = 0
  private isPlaylistMode = false
  private isShuffle = false

  public getTrackIds(): string[] {
    return Array.from(this.tracks.keys())
  }

  public registerTrack(id: string, url: string): void {
    this.tracks.set(id, url)
  }

  public async play(id: string, fade = true): Promise<void> {
    this.isPlaylistMode = false
    await this.playTrack(id, fade, true)
  }

  public async playPlaylist(ids: string[], shuffle = false): Promise<void> {
    if (ids.length === 0) return

    this.playlist = [...ids]
    this.isShuffle = shuffle
    this.isPlaylistMode = true

    if (this.isShuffle) {
      this.shufflePlaylist()
    }

    // If "the_vast" is in the list, and we want to start with it (user request), 
    // we should probably allow passing a start index or ID.
    // For now, let's just start at 0.
    this.playlistIndex = 0
    await this.playTrack(this.playlist[this.playlistIndex], true, false)
  }

  private shufflePlaylist(): void {
    // Fisher-Yates shuffle
    for (let i = this.playlist.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.playlist[i], this.playlist[j]] = [this.playlist[j], this.playlist[i]]
    }
  }

  public startSpecificTrackInPlaylist(id: string): void {
    const index = this.playlist.indexOf(id)
    if (index !== -1) {
      this.playlistIndex = index
      this.playTrack(id, true, false)
    }
  }

  private async playTrack(id: string, fade: boolean, loop: boolean): Promise<void> {
    // If requesting the same track that is already playing, do nothing
    if (this.currentTrackId === id && this.currentTrack && !this.currentTrack.paused) {
      return 
    }

    const url = this.tracks.get(id)
    if (!url) {
      console.warn(`[MusicSystem] Track not found: ${id}`)
      return
    }

    // Stop existing fade
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval)
      this.fadeInterval = null
    }

    // Fade out current if playing
    if (this.currentTrack && !this.currentTrack.paused) {
      if (fade) {
        this.fadeOutAndStop(this.currentTrack)
      } else {
        this.currentTrack.pause()
        this.currentTrack.currentTime = 0
        this.currentTrack.onended = null // Remove listener
      }
    }

    // Start new track
    const audio = new Audio(url)
    audio.loop = loop // Loop only if single track mode
    audio.volume = fade ? 0 : this.getEffectiveVolume()

    // Playlist event listener
    if (!loop) {
      audio.onended = () => {
        this.onTrackEnded()
      }
    }

    try {
      await audio.play()
      this.currentTrack = audio
      this.currentTrackId = id

      if (fade) {
        this.fadeIn(audio)
      }
    } catch (e) {
      console.error('[MusicSystem] Playback failed:', e)
    }
  }

  private onTrackEnded(): void {
    if (this.isPlaylistMode && this.playlist.length > 0) {
      this.playlistIndex = (this.playlistIndex + 1) % this.playlist.length
      const nextId = this.playlist[this.playlistIndex]
      console.log(`[MusicSystem] Track ended. Playing next: ${nextId}`)
      this.playTrack(nextId, true, false)
    }
  }

  public stop(fade = true): void {
    this.isPlaylistMode = false
    if (this.currentTrack && !this.currentTrack.paused) {
      if (fade) {
        this.fadeOutAndStop(this.currentTrack)
      } else {
        this.currentTrack.pause()
        this.currentTrack = null
        this.currentTrackId = null
      }
    }
  }

  public setVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume))
    if (this.currentTrack) {
      this.currentTrack.volume = this.getEffectiveVolume()
    }
  }

  public setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume))
    if (this.currentTrack) {
      this.currentTrack.volume = this.getEffectiveVolume()
    }
  }

  public getVolume(): number {
    return this.musicVolume
  }

  private getEffectiveVolume(): number {
    return this.isMuted ? 0 : this.musicVolume * this.masterVolume
  }

  private fadeIn(audio: HTMLAudioElement): void {
    const targetVol = this.getEffectiveVolume()
    const step = targetVol / (this.FADE_DURATION / 50)
    let vol = 0

    const interval = setInterval(() => {
      // Check if this audio element is still the active one or completely separate?
      // For fadeIn, it MUST be the current one.
      if (!this.currentTrack || this.currentTrack !== audio) {
        clearInterval(interval)
        return
      }

      vol = Math.min(targetVol, vol + step)
      audio.volume = vol

      if (vol >= targetVol) {
        clearInterval(interval)
      }
    }, 50)

    this.fadeInterval = interval
  }

  private fadeOutAndStop(audio: HTMLAudioElement): void {
    const startVol = audio.volume
    const step = startVol / (this.FADE_DURATION / 50)
    let vol = startVol

    // This runs independently of the main class state, effectively "fire and forget"
    // to cleanly cleanup the previous track.
    const interval = setInterval(() => {
      vol = Math.max(0, vol - step)
      audio.volume = vol

      if (vol <= 0) {
        audio.pause()
        audio.currentTime = 0
        clearInterval(interval)
      }
    }, 50)
  }
  public getCurrentTrackId(): string | null {
    return this.currentTrackId
  }
}

export const MusicSystem = new MusicSystemClass()
