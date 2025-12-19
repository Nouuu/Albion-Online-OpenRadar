// WebSocketManager.js - WebSocket connection with auto-reconnect
// Extracted from Utils.js during Phase 1B refactor

import {CATEGORIES} from '../constants/LoggerConstants.js';

const WS_URL = 'ws://localhost:5001/ws';
const MAX_RECONNECT_DELAY = 30000;
const INITIAL_RECONNECT_DELAY = 1000;

// Module state
let socket = null;
let reconnectTimeoutId = null;
let reconnectAttempts = 0;
let messageCallback = null;
let isActive = false;  // Guard for cleanup during destroy
let isGracefulDisconnect = false;  // Distinguish intentional disconnect from connection loss

// Connection status tracking
window.wsConnectionStatus = 'disconnected';

function updateConnectionStatus(status) {
    const previousStatus = window.wsConnectionStatus;
    window.wsConnectionStatus = status;
    document.dispatchEvent(new CustomEvent('wsStatusChange', {detail: {status}}));

    if (window.toast && previousStatus !== status) {
        if (status === 'connected') {
            window.toast.success('Connected to radar backend');
        } else if (status === 'disconnected' && previousStatus === 'connected' && !isGracefulDisconnect) {
            // Only show "Connection lost" for unexpected disconnects, not graceful navigation
            window.toast.error('Connection lost');
        }
    }
}

function onSocketOpen() {
    reconnectAttempts = 0;
    updateConnectionStatus('connected');
    window.logger?.info(CATEGORIES.DEBUG, 'WebSocketConnected', {});
}

function onSocketClose() {
    // Guard: Don't handle close events after destroy
    if (!isActive) return;

    updateConnectionStatus('disconnected');
    window.logger?.warn(CATEGORIES.DEBUG, 'WebSocketDisconnected', {});
    scheduleReconnect();
}

function onSocketError(error) {
    window.logger?.error(CATEGORIES.DEBUG, 'WebSocketError', {error: error?.message});
}

function onSocketMessage(event) {
    messageCallback?.(event.data);
}

function scheduleReconnect() {
    // Guard: Don't schedule reconnect if destroyed
    if (!isActive) return;

    reconnectAttempts++;
    const delay = Math.min(
        INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1),
        MAX_RECONNECT_DELAY
    );
    window.logger?.debug(CATEGORIES.DEBUG, 'WebSocketReconnecting', {
        delay: delay / 1000,
        attempt: reconnectAttempts
    });
    reconnectTimeoutId = setTimeout(connect, delay);
}

function cleanupSocket() {
    // Clear reconnect timeout FIRST to prevent ghost reconnects
    if (reconnectTimeoutId) {
        clearTimeout(reconnectTimeoutId);
        reconnectTimeoutId = null;
    }
    reconnectAttempts = 0;

    if (socket) {
        // Remove listeners BEFORE closing to prevent callbacks
        socket.removeEventListener('open', onSocketOpen);
        socket.removeEventListener('close', onSocketClose);
        socket.removeEventListener('error', onSocketError);
        socket.removeEventListener('message', onSocketMessage);

        // Close socket if not already closed
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
            socket.close();
        }
        socket = null;
    }
}

export function connect() {
    isActive = true;
    isGracefulDisconnect = false;  // Reset on new connection
    updateConnectionStatus('connecting');
    cleanupSocket();

    window.logger?.debug(CATEGORIES.DEBUG, 'WebSocketConnecting', {});
    socket = new WebSocket(WS_URL);
    socket.addEventListener('open', onSocketOpen);
    socket.addEventListener('close', onSocketClose);
    socket.addEventListener('error', onSocketError);
    socket.addEventListener('message', onSocketMessage);
}

export function disconnect() {
    isActive = false;
    isGracefulDisconnect = true;  // Mark as intentional disconnect (no "Connection lost" toast)
    cleanupSocket();
    updateConnectionStatus('disconnected');
    messageCallback = null;  // Clear callback to prevent memory leaks
}

export function setMessageCallback(callback) {
    messageCallback = callback;
}

export function getStatus() {
    return window.wsConnectionStatus;
}
