import QtQuick
import Quickshell
import qs.Widgets

NIconButton {
  id: root

  property ShellScreen screen
  property var pluginApi: null

  property string widgetId: ""
  property string section: ""
  property int sectionWidgetIndex: -1
  property int sectionWidgetsCount: 0

  icon: "palette"
  tooltipText: "Prism"

  onClicked: {
    if (pluginApi) {
      pluginApi.togglePanel(screen, root)
    }
  }
}
