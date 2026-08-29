import QtQuick
import Quickshell
import Quickshell.Wayland

ShellRoot {
    Variants {
        model: Quickshell.screens

        PanelWindow {
            required property var modelData
            screen: modelData

            WlrLayershell.layer: WlrLayer.Background
            WlrLayershell.namespace: "prism-debug-backdrop"
            WlrLayershell.keyboardFocus: WlrKeyboardFocus.None
            exclusionMode: ExclusionMode.Ignore
            anchors { top: true; bottom: true; left: true; right: true }
            color: "#101014"
            mask: Region {}

            Canvas {
                anchors.fill: parent
                property int cellSize: 64

                onPaint: {
                    const context = getContext("2d")
                    context.clearRect(0, 0, width, height)
                    context.fillStyle = "#f4f4f5"
                    for (let y = 0; y < height; y += cellSize) {
                        for (let x = 0; x < width; x += cellSize) {
                            if ((x / cellSize + y / cellSize) % 2 === 0)
                                context.fillRect(x, y, cellSize, cellSize)
                        }
                    }
                }

                onWidthChanged: requestPaint()
                onHeightChanged: requestPaint()
            }

            Rectangle {
                anchors.verticalCenter: parent.verticalCenter
                width: parent.width
                height: 4
                color: "#ff2d55"
            }

            Rectangle {
                anchors.horizontalCenter: parent.horizontalCenter
                width: 4
                height: parent.height
                color: "#ff2d55"
            }
        }
    }
}
