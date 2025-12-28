import { desktopCapturer } from 'electron';
import { EventEmitter } from 'events';

/**
 * WebRTC Remote Desktop - Client Side
 *
 * Gestisce:
 * - Cattura schermo con desktopCapturer → MediaStream
 * - WebRTC PeerConnection per streaming P2P
 * - Data Channel per ricevere comandi input
 */
export class WebRTCRemote extends EventEmitter {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private mediaStream: MediaStream | null = null;
  private isActive = false;

  constructor() {
    super();
  }

  /**
   * Inizializza WebRTC e cattura lo schermo
   */
  async start(): Promise<void> {
    if (this.isActive) {
      console.log('[WebRTC] Already active');
      return;
    }

    try {
      console.log('[WebRTC] Starting screen capture...');

      // 1. Cattura schermo con desktopCapturer
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1920, height: 1080 } // Full resolution per H.264
      });

      if (sources.length === 0) {
        throw new Error('No screen source available');
      }

      // 2. Crea MediaStream da desktopCapturer
      const constraints: any = {
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sources[0].id,
            minWidth: 1280,
            maxWidth: 1920,
            minHeight: 720,
            maxHeight: 1080,
            minFrameRate: 15,
            maxFrameRate: 30
          }
        }
      };

      this.mediaStream = await (navigator.mediaDevices as any).getUserMedia(constraints);
      console.log('[WebRTC] Screen captured successfully');

      // 3. Crea RTCPeerConnection
      this.createPeerConnection();

      // 4. Aggiungi track video alla connection
      this.mediaStream.getTracks().forEach(track => {
        console.log('[WebRTC] Adding track:', track.kind, track.label);
        this.peerConnection!.addTrack(track, this.mediaStream!);
      });

      this.isActive = true;
      this.emit('started');

      console.log('[WebRTC] Remote desktop started');
    } catch (error) {
      console.error('[WebRTC] Error starting:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Ferma la sessione WebRTC
   */
  stop(): void {
    console.log('[WebRTC] Stopping remote desktop...');

    // Chiudi data channel
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }

    // Chiudi peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Ferma media stream
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    this.isActive = false;
    this.emit('stopped');

    console.log('[WebRTC] Remote desktop stopped');
  }

  /**
   * Crea RTCPeerConnection con configurazione STUN
   */
  private createPeerConnection(): void {
    const config: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    this.peerConnection = new RTCPeerConnection(config);

    // ICE candidate event
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[WebRTC] New ICE candidate');
        this.emit('icecandidate', event.candidate);
      }
    };

    // Connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection!.connectionState;
      console.log('[WebRTC] Connection state:', state);
      this.emit('connectionstatechange', state);

      if (state === 'failed' || state === 'disconnected' || state === 'closed') {
        this.stop();
      }
    };

    // Data channel per ricevere input commands
    this.peerConnection.ondatachannel = (event) => {
      console.log('[WebRTC] Data channel received');
      this.dataChannel = event.channel;
      this.setupDataChannel();
    };

    console.log('[WebRTC] PeerConnection created');
  }

  /**
   * Setup data channel per input remoto
   */
  private setupDataChannel(): void {
    if (!this.dataChannel) return;

    this.dataChannel.onopen = () => {
      console.log('[WebRTC] Data channel opened');
    };

    this.dataChannel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('[WebRTC] Received input:', message.type);
        this.emit('input', message);
      } catch (error) {
        console.error('[WebRTC] Error parsing input message:', error);
      }
    };

    this.dataChannel.onclose = () => {
      console.log('[WebRTC] Data channel closed');
    };
  }

  /**
   * Crea SDP offer da inviare al peer remoto
   */
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('PeerConnection not initialized');
    }

    const offer = await this.peerConnection.createOffer({
      offerToReceiveVideo: false,
      offerToReceiveAudio: false
    });

    await this.peerConnection.setLocalDescription(offer);
    console.log('[WebRTC] Created offer');

    return offer;
  }

  /**
   * Gestisce answer ricevuto dal peer remoto
   */
  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('PeerConnection not initialized');
    }

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    console.log('[WebRTC] Set remote description (answer)');
  }

  /**
   * Aggiunge ICE candidate ricevuto dal peer
   */
  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('PeerConnection not initialized');
    }

    await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    console.log('[WebRTC] Added ICE candidate');
  }

  /**
   * Ritorna lo stato attuale
   */
  isActiveSession(): boolean {
    return this.isActive;
  }
}
