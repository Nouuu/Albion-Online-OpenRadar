#Requires AutoHotkey v2.0
#SingleInstance Force

; Window opacity + click-through for any window (made for the OpenRadar players PiP window).
;
;   Ctrl+Alt+Up    : pick the window under the mouse and make it more opaque
;   Ctrl+Alt+Down  : pick the window under the mouse and make it more transparent
;   Ctrl+Alt+T     : toggle click-through on the picked window (clicks go to the game)
;   Ctrl+Alt+R     : reset the picked window (fully opaque, clickable again)
;
; Click-through windows cannot be clicked, so use Ctrl+Alt+T or Ctrl+Alt+R to get control back.

target := 0
alpha := 255          ; 0 = invisible, 255 = opaque
step := 25
clickThrough := false

PickWindow() {
    global target, alpha
    MouseGetPos(, , &id)
    if (id && id != target) {
        target := id
        try alpha := WinGetTransparent(target) || 255
    }
    return target
}

SetAlpha(delta) {
    global alpha
    if !PickWindow()
        return
    alpha := Max(40, Min(255, alpha + delta))   ; never fully invisible
    WinSetTransparent(alpha, "ahk_id " target)
    ToolTip("Opacity " Round(alpha / 255 * 100) "%")
    SetTimer(() => ToolTip(), -900)
}

^!Up:: SetAlpha(step)
^!Down:: SetAlpha(-step)

^!t:: {
    global clickThrough
    if !target {
        if !PickWindow()
            return
    }
    clickThrough := !clickThrough
    if (!WinExist("ahk_id " target)) {
        clickThrough := false
        return
    }
    WinSetExStyle((clickThrough ? "+" : "-") "0x20", "ahk_id " target)   ; WS_EX_TRANSPARENT
    ToolTip(clickThrough ? "Click-through ON" : "Click-through OFF")
    SetTimer(() => ToolTip(), -900)
}

^!r:: {
    global target, alpha, clickThrough
    if (target && WinExist("ahk_id " target)) {
        WinSetExStyle("-0x20", "ahk_id " target)
        WinSetTransparent(255, "ahk_id " target)
    }
    target := 0
    alpha := 255
    clickThrough := false
    ToolTip("Reset")
    SetTimer(() => ToolTip(), -900)
}
