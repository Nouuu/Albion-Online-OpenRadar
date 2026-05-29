package com.albionradar;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * AlbionRadar is the main Android wrapper for the Go gomobile binding.
 * It provides a simple Java API to interact with the radar core.
 */
public class AlbionRadar {
    private static final String TAG = "AlbionRadar";

    static {
        try {
            System.loadLibrary("photonbind");
            Log.i(TAG, "photonbind native library loaded");
        } catch (UnsatisfiedLinkError e) {
            Log.e(TAG, "Failed to load photonbind: " + e.getMessage());
        }
    }

    // Native method signatures (implemented in Go via gomobile bind)
    public native long nativeNewParser();
    public native void nativeSetEventCallback(long parserPtr, long callbackPtr);
    public native void nativeSetRequestCallback(long parserPtr, long callbackPtr);
    public native void nativeSetResponseCallback(long parserPtr, long callbackPtr);
    public native boolean nativeReceivePacket(long parserPtr, byte[] data);
    public native void nativeDeleteParser(long parserPtr);

    // Callbacks interface
    public interface EventCallback {
        void onEvent(int eventCode, String paramsJson);
    }

    public interface RequestCallback {
        void onRequest(int opCode, String paramsJson);
    }

    public interface ResponseCallback {
        void onResponse(int opCode, int returnCode, String paramsJson);
    }

    // Internal state
    private long parserPtr = 0;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private boolean isRunning = false;

    private EventCallback eventCallback;
    private RequestCallback requestCallback;
    private ResponseCallback responseCallback;

    /**
     * Initialize the radar parser.
     * Must be called before any other operations.
     */
    public void initialize() {
        if (parserPtr != 0) {
            Log.w(TAG, "Already initialized");
            return;
        }
        parserPtr = nativeNewParser();
        Log.i(TAG, "Initialized with ptr: " + parserPtr);
    }

    /**
     * Start receiving packets from the network.
     * This method spawns a background thread to listen for UDP packets on port 5056.
     */
    public void start() {
        if (parserPtr == 0) {
            Log.e(TAG, "Not initialized - call initialize() first");
            return;
        }
        isRunning = true;
        Log.i(TAG, "Radar started");
    }

    /**
     * Stop the radar and release resources.
     */
    public void stop() {
        isRunning = false;
        Log.i(TAG, "Radar stopped");
    }

    /**
     * Release all resources.
     * Call this when done with the radar.
     */
    public void release() {
        stop();
        if (parserPtr != 0) {
            nativeDeleteParser(parserPtr);
            parserPtr = 0;
        }
        executor.shutdown();
        Log.i(TAG, "Radar released");
    }

    /**
     * Set callback for event notifications.
     * @param callback the callback to invoke when events are received
     */
    public void setEventCallback(EventCallback callback) {
        this.eventCallback = callback;
    }

    /**
     * Set callback for operation request notifications.
     * @param callback the callback to invoke when requests are received
     */
    public void setRequestCallback(RequestCallback callback) {
        this.requestCallback = callback;
    }

    /**
     * Set callback for operation response notifications.
     * @param callback the callback to invoke when responses are received
     */
    public void setResponseCallback(ResponseCallback callback) {
        this.responseCallback = callback;
    }

    /**
     * Process a raw UDP packet payload.
     * This is called by the network listener when a packet arrives.
     * @param payload raw UDP payload bytes
     * @return true if packet was successfully parsed
     */
    public boolean processPacket(byte[] payload) {
        if (parserPtr == 0) {
            return false;
        }
        return nativeReceivePacket(parserPtr, payload);
    }

    /**
     * Check if the radar is currently active.
     * @return true if running
     */
    public boolean isRunning() {
        return isRunning;
    }

    // Package-private methods called from JNI

    void dispatchEvent(final int eventCode, final String paramsJson) {
        if (eventCallback != null) {
            mainHandler.post(() -> eventCallback.onEvent(eventCode, paramsJson));
        }
    }

    void dispatchRequest(final int opCode, final String paramsJson) {
        if (requestCallback != null) {
            mainHandler.post(() -> requestCallback.onRequest(opCode, paramsJson));
        }
    }

    void dispatchResponse(final int opCode, final int returnCode, final String paramsJson) {
        if (responseCallback != null) {
            mainHandler.post(() -> responseCallback.onResponse(opCode, returnCode, paramsJson));
        }
    }
}