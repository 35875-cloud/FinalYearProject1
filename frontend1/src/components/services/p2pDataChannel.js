// ═══════════════════════════════════════════════════════════════════
//  p2pDataChannel.js
//  Location: frontend/src/services/p2pDataChannel.js
// ═══════════════════════════════════════════════════════════════════

const DC_LABEL    = 'plra-p2p-chat';
const IDB_DB      = 'plra_dc_queue_v1';
const IDB_STORE   = 'queue';

// ── IndexedDB queue (survives tab crash) ─────────────────────────
function openQueueDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(IDB_DB, 1);
    req.onupgradeneeded = e =>
      e.target.result.createObjectStore(IDB_STORE, { keyPath: 'queueId', autoIncrement: true });
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e.target.error);
  });
}
async function queuePush(item) {
  const db  = await openQueueDB();
  return new Promise((res, rej) => {
    const req = db.transaction(IDB_STORE, 'readwrite').objectStore(IDB_STORE).add(item);
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e.target.error);
  });
}
async function queueGetAll() {
  const db = await openQueueDB();
  return new Promise((res, rej) => {
    const req = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).getAll();
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e.target.error);
  });
}
async function queueDelete(queueId) {
  const db = await openQueueDB();
  return new Promise((res, rej) => {
    const req = db.transaction(IDB_STORE, 'readwrite').objectStore(IDB_STORE).delete(queueId);
    req.onsuccess = res;
    req.onerror   = e => rej(e.target.error);
  });
}

// ─────────────────────────────────────────────────────────────────
const p2pDataChannel = {
  _pc:          null,   // RTCPeerConnection (shared with call if active)
  _dc:          null,   // RTCDataChannel
  _channelId:   null,
  _recipientId: null,
  _onMessage:   null,   // callback(payload) when message arrives via DC
  _onStateChange: null, // callback(state) 'open'|'closed'
  _isCaller:    false,

  // ── init ─────────────────────────────────────────────────────────
  /**
   * Set context so DataChannel knows which channel/recipient.
   * Call this right after initCrypto resolves.
   */
  setContext(channelId, recipientId, onMessage, onStateChange) {
    this._channelId   = channelId;
    this._recipientId = recipientId;
    this._onMessage   = onMessage;
    this._onStateChange = onStateChange;
  },

  // ── establish ────────────────────────────────────────────────────
  /**
   * Establish RTCPeerConnection + DataChannel.
   * Caller side: createOffer, returns { type, sdp } to be sent via socket.
   * Called when both users are online so signaling can complete.
   *
   * @param {RTCPeerConnection|null} existingPc  Pass existing call PC to reuse it.
   *                                              If null a new one is created.
   */
  async createOffer(existingPc = null) {
    if (this._dc?.readyState === 'open') return null; // already connected

    this._pc = existingPc || this._newPC();
    this._isCaller = true;

    // Create the DataChannel on the offerer side
    this._dc = this._pc.createDataChannel(DC_LABEL, { ordered: true });
    this._bindDC(this._dc);

    const offer = await this._pc.createOffer();
    await this._pc.setLocalDescription(offer);
    return { type: offer.type, sdp: offer.sdp };
  },

  /**
   * Answerer side: receives offer from socket, creates answer.
   * @returns {{ type, sdp }} answer to send back via socket
   */
  async createAnswer(offerSdp, existingPc = null) {
    if (this._dc?.readyState === 'open') return null;

    this._pc = existingPc || this._newPC();
    this._isCaller = false;

    // Answerer gets the DataChannel via ondatachannel
    this._pc.ondatachannel = (e) => {
      if (e.channel.label === DC_LABEL) {
        this._dc = e.channel;
        this._bindDC(this._dc);
      }
    };

    await this._pc.setRemoteDescription({ type: 'offer', sdp: offerSdp });
    const answer = await this._pc.createAnswer();
    await this._pc.setLocalDescription(answer);
    return { type: answer.type, sdp: answer.sdp };
  },

  /** Complete handshake on caller side with the answer from the peer */
  async setAnswer(answerSdp) {
    if (this._pc && this._pc.signalingState !== 'closed') {
      await this._pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
    }
  },

  /** Add ICE candidate from signaling */
  async addIceCandidate(candidate) {
    if (this._pc && candidate) {
      try { await this._pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
    }
  },

  // ── send ─────────────────────────────────────────────────────────
  /**
   * Send an already-encrypted packet directly via DataChannel.
   * Packet shape same as p2p_msg socket event so receiver handles it identically.
   * If DataChannel not open → queues to IndexedDB.
   *
   * @returns {'sent'|'queued'}
   */
  async send(encryptedPacket) {
    if (this._dc?.readyState === 'open') {
      try {
        this._dc.send(JSON.stringify({ ...encryptedPacket, _dc: true }));
        return 'sent';
      } catch (e) {
        console.warn('DataChannel send failed, queuing:', e.message);
      }
    }
    // Queue for later flush when server comes back
    await queuePush({
      channelId:   this._channelId,
      recipientId: this._recipientId,
      packet:      encryptedPacket,
      ts:          Date.now(),
    });
    return 'queued';
  },

  // ── isOpen ───────────────────────────────────────────────────────
  isOpen() {
    return this._dc?.readyState === 'open';
  },

  // ── flushQueue ───────────────────────────────────────────────────
  /**
   * Called when Socket.IO reconnects.
   * Sends all queued messages to server via REST POST /api/p2p/store.
   * Deletes each item from IndexedDB after successful POST.
   *
   * @param {Function} apiFetch  The component's apiFetch helper
   */
  async flushQueue(apiFetch) {
    const items = await queueGetAll();
    if (!items.length) return;

    console.log(`📤 Flushing ${items.length} queued DC message(s) to server…`);
    for (const item of items) {
      try {
        const r = await apiFetch('/api/p2p/store', {
          method: 'POST',
          body:   JSON.stringify(item.packet),
        });
        const d = await r.json();
        if (d.success) {
          await queueDelete(item.queueId);
          console.log(`✅ Flushed queued message ${item.queueId}`);
        }
      } catch (e) {
        console.warn('Flush failed for item', item.queueId, e.message);
        break; // Stop flush if server still unreachable
      }
    }
  },

  // ── queueLength ──────────────────────────────────────────────────
  async queueLength() {
    const items = await queueGetAll();
    return items.length;
  },

  // ── close ────────────────────────────────────────────────────────
  close() {
    try { this._dc?.close(); } catch {}
    this._dc = null;
    // Don't close _pc here — it might be shared with an active call
  },

  // ── _newPC (internal) ────────────────────────────────────────────
  _newPC() {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });
    pc.onconnectionstatechange = () => {
      if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
        this._onStateChange?.('closed');
        this._dc = null;
      }
    };
    return pc;
  },

  // ── _bindDC (internal) ───────────────────────────────────────────
  _bindDC(dc) {
    dc.onopen = () => {
      console.log('✅ DataChannel open — direct P2P chat active');
      this._onStateChange?.('open');
    };
    dc.onclose = () => {
      console.log('🔌 DataChannel closed');
      this._onStateChange?.('closed');
    };
    dc.onerror = (e) => {
      console.warn('DataChannel error:', e.message);
    };
    dc.onmessage = (e) => {
      try {
        const pkt = JSON.parse(e.data);
        this._onMessage?.(pkt);
      } catch {}
    };
  },
};

export default p2pDataChannel;