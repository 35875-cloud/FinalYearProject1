/**
 * TRANSFER NEGOTIATION - CLIENT-SIDE JAVASCRIPT
 * 
 * Handles:
 * - WebSocket connection
 * - Real-time messaging
 * - Price negotiation
 * - Agreement handling
 * - Screenshot upload
 */


// Global variables
let socket = null;
let channelId = null;
let userId = null;
let userRole = null;
let typingTimeout = null;

// API Configuration
const API_BASE = 'http://localhost:5000/api';
const WS_URL = 'http://localhost:5000';

/**
 * Initialize page on load
 */
document.addEventListener('DOMContentLoaded', () => {
    initializePage();
});

/**
 * Initialize the negotiation page
 */
async function initializePage() {
    try {
        // Get channel ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        channelId = urlParams.get('channelId');
        
        if (!channelId) {
            alert('Channel ID not found');
            window.location.href = 'buyer.html';
            return;
        }
        
        // Get user info from localStorage
        // const userStr = localStorage.getItem('user');
        // if (!userStr) {
        //     alert('Please login first');
        //     window.location.href = '../auth/login.html';
        //     return;
        // }
        
        const user = JSON.parse(userStr);
        userId = user.userId || user.user_id;
        
        // Display channel ID
        document.getElementById('channelIdDisplay').textContent = `Channel: ${channelId}`;
        
        // Load channel details
        await loadChannelDetails();
        
        // Connect to WebSocket
        connectWebSocket();
        
        // Set up event listeners
        setupEventListeners();
        
    } catch (error) {
        console.error('Initialization error:', error);
        alert('Failed to initialize negotiation page');
    }
}

/**
 * Load channel details from API
 */
async function loadChannelDetails() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/channels/${channelId}/details?userId=${userId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error);
        }
        
        const { channel, participants } = data;
        
        // Find user's role
        const userParticipant = participants.find(p => p.user_id === userId);
        userRole = userParticipant?.role;
        
        // Display property info
        displayPropertyInfo(channel);
        
        // Update agreement status
        updateAgreementStatus(channel);
        
        // Update channel status badge
        updateChannelStatusBadge(channel.channel_status);
        
        // Load chat history
        await loadChatHistory();
        
    } catch (error) {
        console.error('Error loading channel details:', error);
        document.getElementById('propertyInfo').innerHTML = 
            '<div class="error">Failed to load channel details</div>';
    }
}

/**
 * Display property information
 */
function displayPropertyInfo(channel) {
    const html = `
        <div class="property-info-grid">
            <div class="info-item">
                <span class="info-label">Property ID:</span>
                <span class="info-value">${channel.property_id}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Location:</span>
                <span class="info-value">${channel.property_location || 'N/A'}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Size:</span>
                <span class="info-value">${channel.property_size || 'N/A'} sq. ft.</span>
            </div>
            <div class="info-item">
                <span class="info-label">Transfer ID:</span>
                <span class="info-value">${channel.transfer_id}</span>
            </div>
        </div>
    `;
    
    document.getElementById('propertyInfo').innerHTML = html;
}

/**
 * Connect to WebSocket server
 */
function connectWebSocket() {
    const token = localStorage.getItem('token');
    
    if (!token) {
        alert('Authentication required');
        return;
    }
    
    // Connect to Socket.IO
    socket = io(WS_URL, {
        auth: {
            token: token
        }
    });
    
    // Connection events
    socket.on('connect', () => {
        console.log('✅ Connected to WebSocket');
        updateOnlineStatus(true);
        
        // Join the channel
        socket.emit('join_channel', { channelId });
    });
    
    socket.on('disconnect', () => {
        console.log('❌ Disconnected from WebSocket');
        updateOnlineStatus(false);
    });
    
    socket.on('error', (error) => {
        console.error('Socket error:', error);
        alert(error.message || 'Connection error');
    });
    
    // Message events
    socket.on('new_message', (data) => {
        renderMessage(data);
        scrollToBottom();
    });
    
    socket.on('user_joined', (data) => {
        console.log('User joined:', data);
        showSystemMessage(`${data.role} joined the chat`);
    });
    
    socket.on('user_left', (data) => {
        console.log('User left:', data);
        showSystemMessage(`User left the chat`);
    });
    
    socket.on('typing', (data) => {
        showTypingIndicator();
    });
    
    socket.on('agreement_updated', (data) => {
        console.log('Agreement updated:', data);
        updateAgreementUI(data);
    });
    
    socket.on('both_agreed', (data) => {
        console.log('Both parties agreed!', data);
        showBothAgreedMessage();
    });
}

/**
 * Load chat history
 */
async function loadChatHistory() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(
            `${API_BASE}/channels/${channelId}/messages?userId=${userId}&limit=100`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error);
        }
        
        // Clear loading message
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.innerHTML = '';
        
        // Render messages
        data.messages.forEach(msg => {
            renderMessage({
                messageId: msg.message_id,
                senderId: msg.sender_id,
                senderRole: msg.sender_role,
                messageType: msg.message_type,
                messageContent: msg.message_content,
                priceOffer: msg.price_offer,
                timestamp: msg.timestamp,
                isSystemMessage: msg.is_system_message
            }, false); // Don't scroll for each message
        });
        
        scrollToBottom();
        
    } catch (error) {
        console.error('Error loading chat history:', error);
    }
}

/**
 * Render a message in the chat
 */
function renderMessage(data, shouldScroll = true) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    
    const isOwnMessage = data.senderId === userId;
    const alignment = isOwnMessage ? 'right' : 'left';
    
    if (data.isSystemMessage) {
        messageDiv.className = 'message system-message';
        messageDiv.innerHTML = `
            <div class="message-content">
                <span class="system-icon">ℹ️</span>
                ${escapeHtml(data.messageContent)}
            </div>
            <div class="message-time">${formatTimestamp(data.timestamp)}</div>
        `;
    } else {
        messageDiv.className = `message message-${alignment}`;
        
        let content = '';
        
        if (data.messageType === 'PRICE_OFFER') {
            content = `
                <div class="price-offer-badge">
                    💰 Price Offer: PKR ${(data.priceOffer || 0).toLocaleString()}
                </div>
                <div class="message-text">${escapeHtml(data.messageContent)}</div>
            `;
        } else {
            content = `
                <div class="message-text">${escapeHtml(data.messageContent)}</div>
            `;
        }
        
        messageDiv.innerHTML = `
            <div class="message-bubble">
                <div class="message-sender">${data.senderRole}</div>
                ${content}
                <div class="message-time">${formatTimestamp(data.timestamp)}</div>
            </div>
        `;
    }
    
    chatMessages.appendChild(messageDiv);
    
    if (shouldScroll) {
        scrollToBottom();
    }
}

/**
 * Send a text message
 */
function sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    if (!socket || !socket.connected) {
        alert('Not connected to chat server');
        return;
    }
    
    socket.emit('send_message', {
        channelId,
        message,
        messageType: 'TEXT'
    });
    
    input.value = '';
    updateCharCount();
}

/**
 * Send price offer
 */
function sendPriceOffer() {
    const priceInput = document.getElementById('offerPrice');
    const price = parseFloat(priceInput.value);
    
    if (!price || price <= 0) {
        alert('Please enter a valid price');
        return;
    }
    
    if (!socket || !socket.connected) {
        alert('Not connected to chat server');
        return;
    }
    
    socket.emit('send_price_offer', {
        channelId,
        offeredPrice: price
    });
    
    closePriceModal();
    priceInput.value = '';
}

/**
 * Record user agreement
 */
async function agreeToTerms() {
    const agreedTerms = prompt('Please confirm the terms you are agreeing to:');
    
    if (!agreedTerms) {
        return;
    }
    
    if (!socket || !socket.connected) {
        alert('Not connected to chat server');
        return;
    }
    
    socket.emit('agree_to_deal', {
        channelId,
        agreedTerms
    });
    
    // Disable agree button
    const agreeBtn = document.getElementById('agreeBtn');
    agreeBtn.disabled = true;
    agreeBtn.textContent = '✓ You Have Agreed';
}

/**
 * Upload screenshot
 */
async function uploadScreenshot() {
    const fileInput = document.getElementById('screenshotFile');
    const priceInput = document.getElementById('finalPrice');
    
    const file = fileInput.files[0];
    const price = parseFloat(priceInput.value);
    
    if (!file) {
        alert('Please select a file');
        return;
    }
    
    if (!price || price <= 0) {
        alert('Please enter the final agreed price');
        return;
    }
    
    showLoading(true);
    
    try {
        const formData = new FormData();
        formData.append('screenshot', file);
        formData.append('agreedPrice', price);
        formData.append('agreedTerms', 'Property transfer agreement');
        
        const token = localStorage.getItem('token');
        const response = await fetch(
            `${API_BASE}/channels/${channelId}/upload-screenshot`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            }
        );
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error);
        }
        
        alert('Screenshot uploaded successfully! Awaiting LRO approval.');
        
        // Show LRO status
        document.getElementById('screenshotSection').style.display = 'none';
        document.getElementById('lroStatus').style.display = 'block';
        
    } catch (error) {
        console.error('Error uploading screenshot:', error);
        alert('Failed to upload screenshot: ' + error.message);
    } finally {
        showLoading(false);
    }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Send message button
    document.getElementById('sendBtn').addEventListener('click', sendMessage);
    
    // Message input - Enter to send
    const messageInput = document.getElementById('messageInput');
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Typing indicator
    messageInput.addEventListener('input', () => {
        updateCharCount();
        
        if (socket && socket.connected) {
            socket.emit('typing', { channelId });
        }
    });
    
    // Price offer button
    document.getElementById('priceOfferBtn').addEventListener('click', () => {
        document.getElementById('priceOfferModal').style.display = 'flex';
    });
    
    // Send price offer
    document.getElementById('sendPriceOfferBtn').addEventListener('click', sendPriceOffer);
    
    // Agree button
    document.getElementById('agreeBtn').addEventListener('click', agreeToTerms);
    
    // Screenshot file selection
    document.getElementById('screenshotFile').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            document.getElementById('fileInfo').textContent = `Selected: ${file.name}`;
            document.getElementById('uploadScreenshotBtn').disabled = false;
        }
    });
    
    // Upload screenshot button
    document.getElementById('uploadScreenshotBtn').addEventListener('click', uploadScreenshot);
}

/**
 * Update agreement status UI
 */
function updateAgreementStatus(channel) {
    // Update seller status
    const sellerStatus = document.getElementById('sellerAgreedStatus');
    if (channel.seller_agreed) {
        sellerStatus.innerHTML = '<span class="status-icon">✓</span> Agreed';
        sellerStatus.classList.add('agreed');
    }
    
    // Update buyer status
    const buyerStatus = document.getElementById('buyerAgreedStatus');
    if (channel.buyer_agreed) {
        buyerStatus.innerHTML = '<span class="status-icon">✓</span> Agreed';
        buyerStatus.classList.add('agreed');
    }
    
    // If both agreed, show screenshot section
    if (channel.seller_agreed && channel.buyer_agreed) {
        document.getElementById('agreeActions').style.display = 'none';
        document.getElementById('screenshotSection').style.display = 'block';
    }
}

/**
 * Update agreement UI after agreement event
 */
function updateAgreementUI(data) {
    const { role, agreed, bothAgreed } = data;
    
    if (role === 'SELLER') {
        const sellerStatus = document.getElementById('sellerAgreedStatus');
        sellerStatus.innerHTML = '<span class="status-icon">✓</span> Agreed';
        sellerStatus.classList.add('agreed');
    } else if (role === 'BUYER') {
        const buyerStatus = document.getElementById('buyerAgreedStatus');
        buyerStatus.innerHTML = '<span class="status-icon">✓</span> Agreed';
        buyerStatus.classList.add('agreed');
    }
    
    if (bothAgreed) {
        showBothAgreedMessage();
    }
}

/**
 * Show message when both parties agree
 */
function showBothAgreedMessage() {
    document.getElementById('agreeActions').style.display = 'none';
    document.getElementById('screenshotSection').style.display = 'block';
    showSystemMessage('🎉 Both parties have agreed! Please upload a screenshot.');
}

/**
 * Show system message
 */
function showSystemMessage(text) {
    renderMessage({
        messageContent: text,
        timestamp: new Date(),
        isSystemMessage: true
    });
}

/**
 * Update online status indicator
 */
function updateOnlineStatus(isOnline) {
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.querySelector('.status-text');
    
    if (isOnline) {
        statusDot.classList.remove('offline');
        statusDot.classList.add('online');
        statusText.textContent = 'Connected';
    } else {
        statusDot.classList.remove('online');
        statusDot.classList.add('offline');
        statusText.textContent = 'Disconnected';
    }
}

/**
 * Update channel status badge
 */
function updateChannelStatusBadge(status) {
    const badge = document.getElementById('channelStatusBadge');
    badge.textContent = status;
    badge.className = `channel-status-badge status-${status.toLowerCase()}`;
}

/**
 * Show typing indicator
 */
function showTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    indicator.style.display = 'flex';
    
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        indicator.style.display = 'none';
    }, 3000);
}

/**
 * Scroll chat to bottom
 */
function scrollToBottom() {
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Update character counter
 */
function updateCharCount() {
    const input = document.getElementById('messageInput');
    const counter = document.getElementById('charCount');
    counter.textContent = input.value.length;
}

/**
 * Format timestamp
 */
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    // If today, show time only
    if (diff < 86400000 && date.getDate() === now.getDate()) {
        return date.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }
    
    // Otherwise show date and time
    return date.toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
    });
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Show/hide loading overlay
 */
function showLoading(show) {
    document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
}

/**
 * Close price offer modal
 */
function closePriceModal() {
    document.getElementById('priceOfferModal').style.display = 'none';
}

/**
 * Go back to transfers page
 */
function goBack() {
    if (socket) {
        socket.disconnect();
    }
    window.location.href = 'buyer.html';
}

// Close modal when clicking outside
window.addEventListener('click', (e) => {
    const modal = document.getElementById('priceOfferModal');
    if (e.target === modal) {
        closePriceModal();
    }
});
